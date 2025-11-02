from flask import Blueprint, render_template, request, jsonify, current_app
from flask_login import login_required, current_user
from modules.database import FolderUploadJob, db
from celery_app import celery # Import the global celery instance
import json
import os
from datetime import datetime, timezone # Import datetime and timezone


def _resolve_data_root():
    """Return the shared data root used for uploads (respects DATA_VOLUME_PATH)."""
    from flask import current_app

    candidates = []
    try:
        if current_app:
            candidates.append(current_app.config.get("DATA_VOLUME_PATH"))
    except RuntimeError:
        # Outside app context
        pass
    candidates.append(os.environ.get("DATA_VOLUME_PATH"))
    home_default = os.path.join('/home', 'data')
    candidates.append(home_default)

    for candidate in candidates:
        if not candidate:
            continue
        candidate_path = os.path.abspath(candidate)
        parent_dir = os.path.dirname(candidate_path)
        if parent_dir and not os.path.isdir(parent_dir):
            continue
        try:
            os.makedirs(candidate_path, exist_ok=True)
        except OSError:
            continue
        if os.access(candidate_path, os.W_OK | os.X_OK):
            return candidate_path
    # Fallback to application directory /data if env not set
    fallback = os.path.join(os.path.abspath(os.path.dirname(__file__)), "..", "data")
    return os.path.abspath(fallback)


def _resolve_job_directory(job_id: int) -> str:
    data_root = _resolve_data_root()
    return os.path.join(data_root, "admin_folder_uploads", str(job_id))

admin_folder_upload_bp = Blueprint(
    "admin_folder_upload",
    __name__,
    url_prefix="/admin/folder_upload"
)

@admin_folder_upload_bp.route("/", methods=["GET"])
@login_required
def folder_upload():
    if not current_user.is_admin:
        return "Access denied", 403
    from modules.database import Library
    libraries = Library.query.order_by(Library.name).all()
    # Build a list of (library, knowledge) pairs
    library_knowledge_pairs = []
    for lib in libraries:
        for k in getattr(lib, 'knowledges', []):
            library_knowledge_pairs.append({
                'library_id': lib.library_id,
                'library_name': lib.name,
                'knowledge_id': k.id,
                'knowledge_name': k.name
            })
    return render_template(
        "admin/folder_upload.html",
        library_knowledge_pairs=library_knowledge_pairs
    )

@admin_folder_upload_bp.route("/upload", methods=["POST"])
@login_required
def upload_folder():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403

    # Handle folder upload, file type filters, background/schedule options

    data = request.form.to_dict()
    file_types = data.get("file_types", "")
    background_enabled = data.get("background_enabled", "true").lower() == "true"
    scheduled_time_str = data.get("scheduled_time")
    # Get user's preference for visual grounding for this job
    # Assuming your form has a checkbox like: <input type="checkbox" name="enable_visual_grounding_admin" value="true">
    user_requested_grounding_admin = data.get("enable_visual_grounding_admin", "false").lower() == "true"

    scheduled_time_dt = None

    # Parse the ISO string from JS into a timezone-aware datetime object
    if scheduled_time_str:
        try:
            # Python < 3.11 needs manual handling of 'Z' for UTC
            if scheduled_time_str.endswith('Z'):
                scheduled_time_str = scheduled_time_str[:-1] + '+00:00'
            scheduled_time_dt = datetime.fromisoformat(scheduled_time_str)
            # Ensure it's timezone-aware (should be if fromisoformat parsed '+00:00')
            if scheduled_time_dt.tzinfo is None:
                 # Fallback: Assume UTC if somehow timezone info was lost
                 scheduled_time_dt = scheduled_time_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return jsonify({"error": "Invalid scheduled time format received from client."}), 400

    # Save uploaded files to a per-job directory and build file_list
    uploaded_files = request.files.getlist("folder_files")
    if not uploaded_files or not any(f and f.filename for f in uploaded_files):
        return jsonify({"error": "No files uploaded. Please select at least one file or folder."}), 400

    file_list = []
    # Get library parameters from form
    library_id = data.get("library_id")
    knowledge_id = data.get("knowledge_id")
    # Convert empty string to None for integer fields
    library_id = int(library_id) if library_id else None
    knowledge_id = int(knowledge_id) if knowledge_id else None

    job = FolderUploadJob(
        created_by_user_id=current_user.get_id(),
        file_list="[]",  # Temporary, will update after saving files
        file_types=json.dumps(file_types.split(",")) if file_types else None,
        background_enabled=background_enabled,
        scheduled_time=scheduled_time_dt, # Use the datetime object
        status="pending",
        log="",
        library_id=library_id, # Make sure these are handled if they can be None
        knowledge_id=knowledge_id, # Make sure these are handled if they can be None
        enable_visual_grounding_for_job=user_requested_grounding_admin # Store the preference
    )
    db.session.add(job)
    db.session.commit()

    job_dir = _resolve_job_directory(job.id)
    os.makedirs(job_dir, exist_ok=True)

    for file in uploaded_files:
        if not file or not file.filename:
            continue
        filename = file.filename
        save_path = os.path.join(job_dir, filename)
        # Ensure parent directories exist for nested folders
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        file.save(save_path)
        file_list.append({"filename": filename, "path": save_path})

    # Update job with file_list
    job.file_list = json.dumps(file_list)
    db.session.commit()

    # Schedule Celery task using the imported global instance
    task = celery.send_task(
        "modules.admin_folder_upload.process_folder_upload_task",
        args=[job.id],
        eta=scheduled_time_dt if scheduled_time_dt else None # Use the datetime object for eta
    )

    # Store the task ID and update status
    job.task_id = task.id
    job.status = "scheduled" if scheduled_time_dt else "running" # Check the datetime object
    db.session.commit()

    try:
        return jsonify({
            "job_id": job.id,
            "task_id": task.id,
            "status": job.status
        })
    except Exception as e:
        current_app.logger.error(f"Error creating job response: {str(e)}")
        return jsonify({
            "error": "Upload failed",
            "message": str(e)
        }), 500

@admin_folder_upload_bp.route("/jobs", methods=["GET"])
@login_required
def list_jobs():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    jobs = FolderUploadJob.query.filter_by(created_by_user_id=current_user.get_id()).order_by(FolderUploadJob.created_at.desc()).all()
    result = []
    for job in jobs:
        result.append({
            "id": job.id,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "file_list": job.file_list,
            "file_types": job.file_types,
            "background_enabled": job.background_enabled,
            "scheduled_time": job.scheduled_time.isoformat() if job.scheduled_time else None,
            "status": job.status,
            "log": job.log,
            "task_id": job.task_id # Include task_id
        })
    return jsonify(result)

@admin_folder_upload_bp.route("/job/<int:job_id>/cancel", methods=["POST"])
@login_required
def cancel_job(job_id):
    """Cancel a scheduled or running Celery task and update DB status."""
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403

    job = FolderUploadJob.query.get_or_404(job_id)
    if job.created_by_user_id != current_user.get_id():
         return jsonify({"error": "Not your job"}), 403

    if job.task_id and job.status in ['pending', 'scheduled', 'running']:
        try:
            # Revoke the task - terminate=True attempts to kill running tasks
            celery.control.revoke(job.task_id, terminate=True, signal='SIGKILL')
            job.status = 'revoked'
            job.log = (job.log or "") + f"\nJob revoked by user at {datetime.utcnow().isoformat()} UTC."
            db.session.commit()
            return jsonify({"success": True, "message": f"Job {job_id} cancellation requested."})
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error revoking task {job.task_id} for job {job_id}: {e}")
            return jsonify({"error": f"Failed to revoke task: {e}"}), 500
    elif not job.task_id:
        return jsonify({"error": "Job has no associated task ID."}), 400
    else:
        return jsonify({"error": f"Job cannot be cancelled in status '{job.status}'."}), 400


@admin_folder_upload_bp.route("/job/<int:job_id>", methods=["GET"])
@login_required
def job_details(job_id):
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    job = FolderUploadJob.query.get_or_404(job_id)
    if job.created_by_user_id != current_user.get_id():
        return jsonify({"error": "Not your job"}), 403
    return jsonify({
        "id": job.id,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "file_list": job.file_list,
        "file_types": job.file_types,
        "background_enabled": job.background_enabled,
        "scheduled_time": job.scheduled_time.isoformat() if job.scheduled_time else None,
        "status": job.status,
        "log": job.log
    })

# Define the Celery task directly using the imported global instance
@celery.task(name="modules.admin_folder_upload.process_folder_upload_task")
def process_folder_upload_task(job_id):
    """
    Background processing logic for admin folder upload jobs.
    For each file in the job, call process_uploaded_file and update job status/log.
    """
    import os
    import datetime
    import traceback
    from modules.upload_processing import process_uploaded_file

    job = FolderUploadJob.query.get(job_id)
    if not job:
        return

    job.status = "running"
    job.log = f"Job started at {datetime.datetime.utcnow().isoformat()} UTC\n"
    db.session.commit()

    # Directory where files are stored for this job
    job_dir = _resolve_job_directory(job_id)
    os.makedirs(job_dir, exist_ok=True)

    # Load file list and file types
    try:
        file_list = json.loads(job.file_list) if job.file_list else []
    except Exception:
        file_list = []
    try:
        file_types = json.loads(job.file_types) if job.file_types else []
    except Exception:
        file_types = []

    results = []
    success_count = 0
    error_count = 0

    for file_info in file_list:
        # file_info should be a dict: {"filename": ..., "path": ...}
        filename = file_info.get("filename")
        file_path = file_info.get("path")
        if not filename or not file_path or not os.path.exists(file_path):
            job.log += f"[{datetime.datetime.utcnow().isoformat()}] Skipped missing file: {filename}\n"
            error_count += 1
            continue

        # Filter by file type if needed
        if file_types:
            ext = os.path.splitext(filename)[1].lower().lstrip(".")
            if ext not in [ft.lower() for ft in file_types]:
                job.log += f"[{datetime.datetime.utcnow().isoformat()}] Skipped file (type not allowed): {filename}\n"
                continue

        try:
            # Copy file to job_dir for processing
            job_file_path = os.path.join(job_dir, filename)
            if file_path != job_file_path:
                import shutil
                shutil.copy2(file_path, job_file_path)
            # Prepare app_config for shared logic
            from modules.database import AppSettings
            app_config = {
                'DOCLING_EXPORT_TYPE': current_app.config.get('DOCLING_EXPORT_TYPE', 'MARKDOWN'),
                'VISUAL_GROUNDING_DOC_STORE_PATH': current_app.config.get('VISUAL_GROUNDING_DOC_STORE_PATH', 'data/doc_store'),
                'AppSettings': AppSettings,
                'DATA_VOLUME_PATH': _resolve_data_root(),
            }
            # Use the stored preference for visual grounding
            enable_visual_grounding = job.enable_visual_grounding_for_job if hasattr(job, 'enable_visual_grounding_for_job') and job.enable_visual_grounding_for_job is not None else False
            current_app.logger.info(f"Job {job_id}, File {filename}: enable_visual_grounding set to {enable_visual_grounding} from job settings.")



            # Look up library name if library_id is set
            library_name = None
            if job.library_id:
                from modules.database import Library
                library = Library.query.get(job.library_id)
                library_name = library.name if library else None

            result = process_uploaded_file(
                file_path=job_file_path,
                filename=filename,
                user_id=job.created_by_user_id,
                library_id=job.library_id,
                library_name=library_name,
                knowledge_id=job.knowledge_id,
                enable_visual_grounding=enable_visual_grounding,
                logger=None,
                app_config=app_config,
                current_user=None,
                url_download_id=None,
                source_url=None,
            )
            results.append(result)
            if result.get("success", False):
                job.log += f"[{datetime.datetime.utcnow().isoformat()}] Success: {filename} - {result.get('message','')}\n"
                success_count += 1
            else:
                job.log += f"[{datetime.datetime.utcnow().isoformat()}] Error: {filename} - {result.get('message','')}\n"
                error_count += 1
            db.session.commit()
        except Exception as e:
            tb = traceback.format_exc()
            job.log += f"[{datetime.datetime.utcnow().isoformat()}] Exception processing {filename}: {str(e)}\n{tb}\n"
            error_count += 1
            db.session.commit()

    # Finalize job status
    if error_count == 0 and success_count > 0:
        job.status = "completed"
    elif success_count > 0:
        job.status = "completed_with_errors"
    else:
        job.status = "failed"
    job.log += f"Job finished at {datetime.datetime.utcnow().isoformat()} UTC. Success: {success_count}, Errors: {error_count}\n"
    db.session.commit()

# Remove the old registration function and call
