from flask import render_template, request, flash, redirect, url_for, session, jsonify, current_app
from flask import current_app, jsonify, render_template, request
from flask_login import login_required, current_user
from flask_wtf import FlaskForm, CSRFProtect
import os
import mimetypes
from urllib.parse import urlparse
from werkzeug.utils import secure_filename
import logging
from pathlib import Path
from uuid import uuid4

import requests

# Import Celery task wrapper (worker only - web container submits tasks)
try:
    from modules.celery_tasks import submit_file_processing_task
except ImportError:
    submit_file_processing_task = None

# Import database functions
from modules.database import (
    add_uploaded_file,
    get_libraries_with_details,
    get_library_with_details,
    get_catalogs,
    get_categories,
    knowledge_libraries_association,
    Library,
    Knowledge,
    Group,
    db,
    create_url_download,
    update_url_download,
)
from modules.access_control import (
    filter_accessible_knowledges,
    get_user_group_ids,
)

# Import CSRF instance
from extensions import csrf

# Import form class
from flask_wtf.file import FileField, FileRequired

# Configure logging
logger = logging.getLogger(__name__)

class UploadForm(FlaskForm):
    file = FileField('File', validators=[FileRequired()])

def init_upload(app):
    """Initialize upload routes for the Flask app."""
    
    @app.route('/upload', methods=['GET'])
    @login_required
    def upload_page():
        form = UploadForm()
        vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
        user_group_ids = get_user_group_ids(current_user.user_id)
        raw_libraries = get_libraries_with_details()
        libraries = []
        for library in raw_libraries:
            accessible_knowledges = filter_accessible_knowledges(
                getattr(library, 'knowledges', []) or [],
                user_group_ids,
            )
            if vector_store_setting == 'knowledge' and not accessible_knowledges:
                continue
            libraries.append(
                {
                    'library_id': library.library_id,
                    'name': library.name,
                    'description': library.description,
                    'knowledges': accessible_knowledges,
                }
            )
        categories = []
        catalogs = []
        groups = []
        if vector_store_setting == 'knowledge':
            categories = get_categories()
            catalogs = get_catalogs()
            groups = Group.query.order_by(Group.name).all()
        
        # Get OCR mode setting for visual grounding validation
        # 'default' = local OCR (Docling), 'azure' = Azure Document Intelligence
        ocr_mode = 'default'
        try:
            from modules.database import AppSettings
            ocr_setting = AppSettings.query.filter_by(key='ocr_mode').first()
            if ocr_setting and ocr_setting.value:
                ocr_mode = ocr_setting.value
        except Exception as e:
            logger.warning(f"Could not get OCR mode setting: {e}")
        
        return render_template(
            'upload.html',
            form=form,
            libraries=libraries,
            vector_store_setting=vector_store_setting,
            categories=categories,
            catalogs=catalogs,
            groups=groups,
            ocr_mode=ocr_mode,
        )

    @app.route('/upload', methods=['POST'])
    @login_required
    @csrf.exempt  # Temporarily disable CSRF for debugging
    def upload():
        # Debug logging
        print(f"DEBUG: Upload form data: {dict(request.form)}")
        print(f"DEBUG: Upload files: {request.files}")

        # Get library_id and library name from form
        library_id = (
            request.form.get('library_id')
            or request.form.get('library_id_url')
            or request.form.get('library_id_batch')
        )
        raw_library_name = request.form.get('library_name', 'Unknown Library')
        library_name = raw_library_name.split(' — ')[0].strip() if raw_library_name else 'Unknown Library'
        knowledge_id = None

        if not library_id:
            return jsonify({'success': False, 'message': 'Please select a library.'}), 400
            
        try:
            library_id = int(library_id)
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid library selected.'}), 400

        user_group_ids = get_user_group_ids(current_user.user_id)
        library = get_library_with_details(library_id)
        if library is None:
            return jsonify({'success': False, 'message': 'Selected library does not exist.'}), 400

        library_knowledges = list(getattr(library, 'knowledges', []) or [])
        vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
        enforce_group_permissions = vector_store_setting != 'user'

        if enforce_group_permissions:
            accessible_library_knowledges = filter_accessible_knowledges(
                library_knowledges,
                user_group_ids,
            )
        else:
            accessible_library_knowledges = library_knowledges

        library_knowledge_ids = {item.id for item in library_knowledges}
        accessible_knowledge_ids = (
            {item.id for item in accessible_library_knowledges}
            if enforce_group_permissions
            else library_knowledge_ids
        )

        # Get files from request (handle both 'file' and 'files' for compatibility)
        files = request.files.getlist('files') or request.files.getlist('file')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'success': False, 'message': 'No files selected.'}), 400

        # Get knowledge_id if in knowledge mode
        print(f"DEBUG: Vector store setting: {vector_store_setting}")
        if vector_store_setting == 'knowledge':
            knowledge_id = request.form.get('knowledge_id')
            print(f"DEBUG: Knowledge ID from form: {knowledge_id}")
            if not knowledge_id:
                print("DEBUG: Knowledge ID validation failed - empty")
                return jsonify(
                    {
                        'success': False,
                        'message': 'Knowledge mode is mandatory. Please select a knowledge base before downloading.',
                    }
                ), 400
            try:
                knowledge_id = int(knowledge_id)
                print(f"DEBUG: Knowledge ID converted to int: {knowledge_id}")
            except Exception as exc:
                print(f"DEBUG: Knowledge ID conversion failed: {exc}")
                return jsonify({'success': False, 'message': 'Invalid knowledge base selected.'}), 400

            if knowledge_id not in library_knowledge_ids:
                return jsonify({'success': False, 'message': 'Selected knowledge is not linked to the chosen library.'}), 400
            if enforce_group_permissions and knowledge_id not in accessible_knowledge_ids:
                return jsonify({'success': False, 'message': 'You do not have permission to use the selected knowledge base.'}), 403

            if db.session.get(Knowledge, knowledge_id) is None:
                return jsonify({'success': False, 'message': 'Selected knowledge does not exist.'}), 400
        else:
            if (
                enforce_group_permissions
                and library_knowledges
                and not accessible_library_knowledges
            ):
                return jsonify({'success': False, 'message': 'You do not have permission to upload to the selected library.'}), 403
            if enforce_group_permissions and accessible_library_knowledges:
                knowledge_id = accessible_library_knowledges[0].id
                print(f"DEBUG: Defaulting knowledge_id to accessible knowledge: {knowledge_id}")
            else:
                knowledge_id = None

        # Process each file
        uploaded_files = []
        for file in files:
            if file and file.filename != '':
                # Validate file
                print(f"DEBUG: Checking file: filename='{file.filename}', allowed={allowed_file(file.filename) if file.filename else False}")
                if not file.filename or not allowed_file(file.filename):
                    print(f"DEBUG: File validation failed for: {file.filename}")
                    return jsonify({'success': False, 'message': f'File type not allowed or invalid filename: {file.filename}'}), 400

                # Save file temporarily
                filename = secure_filename(file.filename)
                base_temp_dir = Path(current_app.config.get('UPLOAD_TEMP_DIR', os.path.join(current_app.root_path, 'data', 'tmp_uploads')))
                temp_dir = base_temp_dir / str(uuid4())
                temp_dir.mkdir(parents=True, exist_ok=True)
                temp_file_path = temp_dir / filename
                file.save(str(temp_file_path))
                
                # Force sync to disk for Azure Files consistency
                # Azure Files is an SMB mount that has propagation delays between containers.
                # Without explicit fsync, the worker may not see the file immediately.
                try:
                    with open(str(temp_file_path), 'rb') as f:
                        os.fsync(f.fileno())
                    logger.debug(f"File synced to disk: {temp_file_path}")
                except OSError as sync_err:
                    logger.warning(f"fsync failed for {temp_file_path}: {sync_err}")
                
                # Verify file exists after save+sync
                if not temp_file_path.exists():
                    logger.error(f"File not found after save+sync: {temp_file_path}")
                    return jsonify({'success': False, 'message': f'File save failed for {filename}'}), 500
                
                file_size = temp_file_path.stat().st_size
                logger.info(f"File saved successfully: {temp_file_path} ({file_size} bytes)")


                # NOTE: Don't call add_uploaded_file() here!
                # The Celery worker (process_uploaded_file) creates the DB record
                # after cleanup_duplicate_file() runs. Creating it here caused
                # duplicate rows in /admin/files.
                
                # Submit processing task to Celery worker
                enable_visual_grounding = request.form.get('enable_visual_grounding') == 'true'
                
                # Submit async task to worker using wrapper
                task_id = None
                if submit_file_processing_task:
                    task_id = submit_file_processing_task(
                        temp_file_path=str(temp_file_path),
                        filename=filename,
                        user_id=current_user.user_id,
                        library_id=library_id,
                        library_name=library_name,
                        knowledge_id_str=str(knowledge_id) if knowledge_id else None,
                        enable_visual_grounding_flag=enable_visual_grounding,
                        url_download_id=None,
                        source_url=None,
                        content_type=None,
                    )
                
                if task_id:
                    logger.info(f"Submitted Celery task {task_id} for processing {filename}")

                    # Register task in Redis for status tracking
                    try:
                        import redis
                        import json
                        from datetime import datetime, timezone
                        broker_url = os.environ.get('CELERY_BROKER_URL')
                        if broker_url:
                            redis_client = redis.from_url(broker_url)
                            task_key = f"user:{current_user.user_id}:upload_tasks"
                            task_meta_key = f"user:{current_user.user_id}:upload_task_meta"
                            
                            # Add task ID to the task list
                            redis_client.rpush(task_key, task_id)
                            redis_client.expire(task_key, 86400)  # 24 hours
                            
                            # Store task metadata (filename, creation time) for status display
                            task_meta = {
                                'filename': filename,
                                'created_at': datetime.now(timezone.utc).isoformat()
                            }
                            redis_client.hset(task_meta_key, task_id, json.dumps(task_meta))
                            redis_client.expire(task_meta_key, 86400)  # 24 hours
                            
                            logger.debug(f"Registered task {task_id} for user {current_user.user_id} with filename {filename}")
                        else:
                            logger.warning("CELERY_BROKER_URL not set, skipping task registration")
                    except Exception as e:
                        logger.error(f"Failed to register task in Redis: {e}")
                else:
                    logger.warning("Celery task not available - file uploaded but processing disabled")
                    task_id = 'processing_disabled'
                
                uploaded_files.append({
                    'filename': filename,
                    'task_id': task_id
                })

        return jsonify({
            'success': True, 
            'message': f'Successfully uploaded {len(uploaded_files)} file(s). Processing started.',
            'files': uploaded_files
        })

    @app.route('/api/check-duplicates', methods=['POST'])
    @login_required
    @csrf.exempt
    def check_duplicates():
        """Check if any of the submitted filenames already exist in the target library/knowledge.
        
        This allows the UI to show a confirmation dialog before replacing existing files.
        """
        from modules.database import UploadedFile
        
        data = request.get_json(silent=True) or {}
        filenames = data.get('filenames', [])
        library_id = data.get('library_id')
        knowledge_id = data.get('knowledge_id')
        
        if not filenames:
            return jsonify({'duplicates': []})
        
        if not library_id:
            return jsonify({'duplicates': [], 'error': 'Library ID required'}), 400
        
        try:
            library_id = int(library_id)
        except (TypeError, ValueError):
            return jsonify({'duplicates': [], 'error': 'Invalid library ID'}), 400
        
        # Convert knowledge_id if provided
        knowledge_id_int = None
        if knowledge_id and knowledge_id not in ('', 'null', 'None'):
            try:
                knowledge_id_int = int(knowledge_id)
            except (TypeError, ValueError):
                pass
        
        duplicates = []
        for filename in filenames:
            # Query for existing file with same name in same library/knowledge
            query = UploadedFile.query.filter_by(
                original_filename=filename,
                library_id=library_id,
            )
            
            if knowledge_id_int is not None:
                query = query.filter_by(knowledge_id=knowledge_id_int)
            
            existing = query.first()
            if existing:
                duplicates.append({
                    'filename': filename,
                    'file_id': existing.file_id,
                    'upload_time': existing.upload_time.isoformat() if existing.upload_time else None,
                })
        
        logger.info(f"[CheckDuplicates] Found {len(duplicates)} duplicate(s) for {len(filenames)} file(s)")
        return jsonify({'duplicates': duplicates})

    @app.route('/validate_url', methods=['POST'])
    @login_required
    def validate_url():
        """Validate that a submitted URL is usable for ingestion."""
        payload = request.get_json(silent=True) or {}
        raw_url = (payload.get('url') or '').strip()
        if not raw_url:
            return jsonify({'valid': False, 'message': 'URL is required.'}), 400

        parsed = urlparse(raw_url)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            return jsonify({'valid': False, 'message': 'Only absolute HTTP or HTTPS URLs are allowed.'})

        # Use shorter timeout for faster validation (3s instead of 5s)
        # Only use HEAD request - no GET fallback to save time
        response = None
        try:
            response = requests.head(raw_url, allow_redirects=True, timeout=3)
            status_code = response.status_code
            # Accept any non-error response (including 403/405 which some servers return for HEAD)
            if status_code < 500:
                return jsonify({'valid': True, 'message': f'URL is reachable (status: {status_code}).'})
            else:
                return jsonify({'valid': False, 'message': f'Server error: {status_code}'})
        except requests.Timeout:
            # If HEAD times out, still consider it potentially valid (server might be slow)
            logger.info("URL validation HEAD timeout for %s, considering valid", raw_url)
            return jsonify({'valid': True, 'message': 'URL timed out but may still be valid.'})
        except requests.RequestException as exc:
            logger.info("URL validation failed for %s: %s", raw_url, exc)
            return jsonify({'valid': False, 'message': 'URL could not be reached.'})
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass

    @app.route('/process_url', methods=['POST'])
    @login_required
    def process_url():
        data = request.get_json(silent=True) or {}
        raw_url = (data.get('url') or '').strip()
        library_id = data.get('library_id')
        library_name = data.get('library_name') or 'Unknown Library'
        knowledge_id = data.get('knowledge_id')
        if knowledge_id in (None, '', 'null'):
            knowledge_id = None

        if not raw_url:
            return jsonify({'success': False, 'message': 'URL is required.'}), 400

        try:
            parsed = urlparse(raw_url)
        except Exception:
            parsed = None
        if not parsed or parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            return jsonify({'success': False, 'message': 'Only absolute HTTP or HTTPS URLs are allowed.'}), 400

        if not library_id:
            return jsonify({'success': False, 'message': 'Library is required.'}), 400
        try:
            library_id = int(library_id)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': 'Invalid library selected.'}), 400

        user_group_ids = get_user_group_ids(current_user.user_id)
        library = get_library_with_details(library_id)
        if library is None:
            return jsonify({'success': False, 'message': 'Selected library does not exist.'}), 400

        library_knowledges = list(getattr(library, 'knowledges', []) or [])
        vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
        enforce_group_permissions = vector_store_setting != 'user'

        if enforce_group_permissions:
            accessible_library_knowledges = filter_accessible_knowledges(
                library_knowledges,
                user_group_ids,
            )
        else:
            accessible_library_knowledges = library_knowledges

        library_knowledge_ids = {item.id for item in library_knowledges}
        accessible_knowledge_ids = (
            {item.id for item in accessible_library_knowledges}
            if enforce_group_permissions
            else library_knowledge_ids
        )

        if vector_store_setting == 'knowledge':
            if not knowledge_id:
                return jsonify({'success': False, 'message': 'Knowledge mode requires a knowledge selection.'}), 400
            try:
                knowledge_id_int = int(knowledge_id)
            except (TypeError, ValueError):
                return jsonify({'success': False, 'message': 'Invalid knowledge base selected.'}), 400
            if knowledge_id_int not in library_knowledge_ids:
                return jsonify({'success': False, 'message': 'Selected knowledge is not linked to the chosen library.'}), 400
            if enforce_group_permissions and knowledge_id_int not in accessible_knowledge_ids:
                return jsonify({'success': False, 'message': 'You do not have permission to use the selected knowledge base.'}), 403
            if db.session.get(Knowledge, knowledge_id_int) is None:
                return jsonify({'success': False, 'message': 'Selected knowledge does not exist.'}), 400
        else:
            if (
                enforce_group_permissions
                and library_knowledges
                and not accessible_library_knowledges
            ):
                return jsonify({'success': False, 'message': 'You do not have permission to use the selected library.'}), 403
            knowledge_id_int = (
                accessible_library_knowledges[0].id
                if enforce_group_permissions and accessible_library_knowledges
                else None
            )

        filename = os.path.basename(parsed.path) or 'downloaded_document'
        if '.' not in filename:
            filename = f"{filename}.html"

        download_response = None
        temp_dir = None
        temp_file_path = None
        content_type = 'unknown'
        try:
            download_response = requests.get(raw_url, stream=True, timeout=15)
            download_response.raise_for_status()
            content_type = download_response.headers.get('Content-Type', 'unknown') or 'unknown'
            if '.' not in filename:
                mime_ext = None
                if content_type and content_type != 'unknown':
                    mime_ext = mimetypes.guess_extension(content_type.split(';')[0].strip())
                if mime_ext:
                    filename = f"{filename}{mime_ext}"

            sanitized_name = secure_filename(filename)
            base_temp_dir = Path(current_app.config.get('UPLOAD_TEMP_DIR', os.path.join(current_app.root_path, 'data', 'tmp_uploads')))
            temp_dir = base_temp_dir / str(uuid4())
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_file_path = temp_dir / sanitized_name

            with open(temp_file_path, 'wb') as temp_file:
                for chunk in download_response.iter_content(chunk_size=8192):
                    if chunk:
                        temp_file.write(chunk)
                # Force sync to disk for Azure Files consistency
                temp_file.flush()
                os.fsync(temp_file.fileno())
            
            # Verify file exists and log size
            if temp_file_path.exists():
                file_size = temp_file_path.stat().st_size
                logger.info(f"URL download saved successfully: {temp_file_path} ({file_size} bytes)")
            else:
                logger.error(f"URL download file not found after save+sync: {temp_file_path}")
                return jsonify({'success': False, 'message': 'File save failed after download'}), 500

        except requests.RequestException as exc:
            if download_response is not None:
                download_response.close()
            return jsonify({'success': False, 'message': f'Failed to download URL: {exc}'}), 400

        finally:
            if download_response is not None:
                download_response.close()

        download_id = create_url_download(
            user_id=current_user.user_id,
            url=raw_url,
            status='queued',
            content_type=content_type,
            library_id=library_id,
            knowledge_id=knowledge_id_int,
        )

        task_id = None
        result = None
        try:
            task_scheduled = False
            if submit_file_processing_task:
                task_id = submit_file_processing_task(
                    temp_file_path=str(temp_file_path),
                    filename=temp_file_path.name,
                    user_id=current_user.user_id,
                    library_id=library_id,
                    library_name=library_name,
                    knowledge_id_str=str(knowledge_id_int) if knowledge_id_int is not None else None,
                    enable_visual_grounding_flag=False,
                    url_download_id=download_id,
                    source_url=raw_url,
                    content_type=content_type,
                )
                task_scheduled = bool(task_id)

                # Register task in Redis for status tracking
                if task_id:
                    try:
                        import redis
                        import json
                        from datetime import datetime, timezone
                        broker_url = os.environ.get('CELERY_BROKER_URL')
                        if broker_url:
                            redis_client = redis.from_url(broker_url)
                            task_key = f"user:{current_user.user_id}:upload_tasks"
                            task_meta_key = f"user:{current_user.user_id}:upload_task_meta"
                            
                            # Add task ID to the task list
                            redis_client.rpush(task_key, task_id)
                            redis_client.expire(task_key, 86400)  # 24 hours
                            
                            # Store task metadata (filename/URL, creation time) for status display
                            task_meta = {
                                'filename': temp_file_path.name,
                                'created_at': datetime.now(timezone.utc).isoformat()
                            }
                            redis_client.hset(task_meta_key, task_id, json.dumps(task_meta))
                            redis_client.expire(task_meta_key, 86400)  # 24 hours
                            
                            logger.debug(f"Registered URL download task {task_id} for user {current_user.user_id}")
                        else:
                            logger.warning("CELERY_BROKER_URL not set, skipping task registration")
                    except Exception as e:
                        logger.error(f"Failed to register task in Redis: {e}")

            if not task_scheduled:
                from modules.upload_processing import process_uploaded_file
                result = process_uploaded_file(
                    file_path=str(temp_file_path),
                    filename=temp_file_path.name,
                    user_id=current_user.user_id,
                    library_id=library_id,
                    library_name=library_name,
                    knowledge_id=knowledge_id_int,
                    enable_visual_grounding=False,
                    url_download_id=download_id,
                    source_url=raw_url,
                )
                if result.get('success'):
                    update_url_download(download_id, status='success', content_type=content_type)
                    if temp_dir and temp_dir.exists():
                        for child in temp_dir.iterdir():
                            child.unlink(missing_ok=True)
                        try:
                            temp_dir.rmdir()
                        except OSError:
                            pass
                    task_id = None
                else:
                    update_url_download(download_id, status='failed', error_message=result.get('message'))
                    raise RuntimeError(result.get('message'))

        except Exception as exc:
            update_url_download(download_id, status='failed', error_message=str(exc))
            if temp_dir and temp_dir.exists():
                for child in temp_dir.iterdir():
                    child.unlink(missing_ok=True)
                try:
                    temp_dir.rmdir()
                except OSError:
                    pass
            return jsonify({'success': False, 'message': f'Failed to process URL: {exc}'}), 500

        if task_id:
            update_url_download(download_id, status='processing')
            response_payload = {
                'success': True,
                'message': 'URL queued for processing.',
                'task_id': task_id,
                'download_id': download_id,
            }
        else:
            if isinstance(result, dict) and 'message' in result:
                success_message = result['message']
            else:
                success_message = 'URL processed successfully.'
            response_payload = {
                'success': True,
                'message': success_message,
                'download_id': download_id,
            }

        return jsonify(response_payload)

    @app.route('/api/upload-status', methods=['GET'])
    @login_required
    def upload_status_api():
        """Get status of all upload tasks for current user."""
        from celery.result import AsyncResult
        from celery_app import celery
        import redis
        from datetime import datetime, timezone
        import json

        try:
            broker_url = os.environ.get('CELERY_BROKER_URL')
            if not broker_url:
                logger.warning("CELERY_BROKER_URL not set")
                return jsonify({'tasks': []})
            redis_client = redis.from_url(broker_url)
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            return jsonify({'tasks': []})

        # Get task IDs from Redis for this user
        task_key = f"user:{current_user.user_id}:upload_tasks"
        task_meta_key = f"user:{current_user.user_id}:upload_task_meta"
        try:
            task_ids = redis_client.lrange(task_key, 0, -1)
            logger.info(f"[UploadStatus] Found {len(task_ids)} task IDs in Redis for user {current_user.user_id}")
        except Exception as e:
            logger.error(f"Failed to get task list from Redis: {e}")
            return jsonify({'tasks': []})

        # Get task metadata (creation times, filenames)
        try:
            task_meta_raw = redis_client.hgetall(task_meta_key)
            task_meta = {}
            for k, v in task_meta_raw.items():
                key = k.decode('utf-8') if isinstance(k, bytes) else k
                try:
                    task_meta[key] = json.loads(v.decode('utf-8') if isinstance(v, bytes) else v)
                except (json.JSONDecodeError, AttributeError):
                    task_meta[key] = {}
        except Exception as e:
            logger.debug(f"No task metadata found: {e}")
            task_meta = {}

        tasks = []
        tasks_to_remove = []
        meta_to_remove = []
        current_time = datetime.now(timezone.utc)

        for task_id in task_ids:
            task_id_str = task_id.decode('utf-8') if isinstance(task_id, bytes) else task_id
            logger.debug(f"[UploadStatus] Processing task_id: {task_id_str}")

            try:
                result = AsyncResult(task_id_str, app=celery)
                logger.debug(f"[UploadStatus] Task {task_id_str} - State: {result.state}, Info type: {type(result.info)}")

                # Get task metadata (contains filename and creation time)
                meta = task_meta.get(task_id_str, {})
                stored_filename = meta.get('filename', 'Unknown')
                created_at_str = meta.get('created_at')
                
                # Parse creation time
                task_age_seconds = 0
                if created_at_str:
                    try:
                        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        task_age_seconds = (current_time - created_at).total_seconds()
                    except (ValueError, AttributeError):
                        task_age_seconds = 0

                # Check for orphaned PENDING tasks - only remove if older than 5 minutes
                # This gives workers time to pick up new tasks in batch uploads
                ORPHAN_GRACE_PERIOD_SECONDS = 300  # 5 minutes
                if result.state == 'PENDING' and result.info is None:
                    if task_age_seconds > ORPHAN_GRACE_PERIOD_SECONDS:
                        logger.warning(f"Removing orphaned PENDING task {task_id_str} (age: {task_age_seconds:.0f}s)")
                        tasks_to_remove.append(task_id_str)
                        meta_to_remove.append(task_id_str)
                        continue  # Skip adding to tasks list
                    else:
                        # Task is new, keep it and show with stored filename
                        logger.debug(f"[UploadStatus] Keeping new PENDING task {task_id_str} (age: {task_age_seconds:.0f}s)")
                        tasks.append({
                            'task_id': task_id_str,
                            'status': 'PENDING',
                            'filename': stored_filename,
                            'info': {'stage': 'Queued'}
                        })
                        continue

                # Build task info
                task_info = {
                    'task_id': task_id_str,
                    'status': result.state,
                    'filename': stored_filename,  # Use stored filename as fallback
                    'info': {}
                }

                # Extract info from result (overrides stored filename if available)
                if isinstance(result.info, dict):
                    result_filename = result.info.get('filename')
                    if result_filename and result_filename != 'Unknown':
                        task_info['filename'] = result_filename
                    task_info['info'] = {
                        'stage': result.info.get('stage'),
                        'progress': result.info.get('progress'),
                        'error': result.info.get('error') or result.info.get('message')
                    }

                tasks.append(task_info)

                # Mark old completed tasks for removal (older than 1 hour)
                if result.state in ['SUCCESS', 'FAILURE']:
                    # Get result timestamp if available
                    if hasattr(result, 'date_done') and result.date_done:
                        age = current_time - result.date_done
                        if age.total_seconds() > 3600:  # 1 hour
                            tasks_to_remove.append(task_id_str)
                            meta_to_remove.append(task_id_str)

            except Exception as e:
                logger.error(f"Failed to get status for task {task_id_str}: {e}")
                # Remove invalid task IDs
                tasks_to_remove.append(task_id_str)
                meta_to_remove.append(task_id_str)

        # Clean up old/invalid tasks
        if tasks_to_remove:
            logger.info(f"[UploadStatus] Cleaning up {len(tasks_to_remove)} tasks from Redis")
            for task_id_str in tasks_to_remove:
                try:
                    redis_client.lrem(task_key, 0, task_id_str)
                except Exception as e:
                    logger.error(f"Failed to remove task {task_id_str}: {e}")
            
            # Clean up metadata
            for task_id_str in meta_to_remove:
                try:
                    redis_client.hdel(task_meta_key, task_id_str)
                except Exception as e:
                    logger.debug(f"Failed to remove task meta {task_id_str}: {e}")

        logger.info(f"[UploadStatus] Returning {len(tasks)} tasks to client")
        return jsonify({'tasks': tasks})

    @app.route('/api/upload-status/<task_id>/dismiss', methods=['POST'])
    @login_required
    def dismiss_upload_task(task_id):
        """Dismiss a completed task from the user's task list."""
        import redis

        try:
            broker_url = os.environ.get('CELERY_BROKER_URL')
            if not broker_url:
                return jsonify({'success': False, 'error': 'CELERY_BROKER_URL not set'}), 500
            redis_client = redis.from_url(broker_url)
            task_key = f"user:{current_user.user_id}:upload_tasks"
            redis_client.lrem(task_key, 0, task_id)
            logger.info(f"User {current_user.user_id} dismissed task {task_id}")
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"Failed to dismiss task {task_id}: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500


def allowed_file(filename):

    """Check if the file extension is allowed."""
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md', 'html', 'pptx', 'xlsx', 'csv', 'jpg', 'jpeg', 'png', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS