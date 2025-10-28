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
    knowledge_libraries_association,
    Library,
    Knowledge,
    db,
    create_url_download,
    update_url_download,
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
        libraries = get_libraries_with_details()
        vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
        return render_template('upload.html', form=form, libraries=libraries, vector_store_setting=vector_store_setting)

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

        library = get_library_with_details(library_id)
        if library is None:
            return jsonify({'success': False, 'message': 'Selected library does not exist.'}), 400

        # Get files from request (handle both 'file' and 'files' for compatibility)
        files = request.files.getlist('files') or request.files.getlist('file')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'success': False, 'message': 'No files selected.'}), 400

        # Get knowledge_id if in knowledge mode
        vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
        print(f"DEBUG: Vector store setting: {vector_store_setting}")
        if vector_store_setting == 'knowledge':
            knowledge_id = request.form.get('knowledge_id') 
            print(f"DEBUG: Knowledge ID from form: {knowledge_id}")
            if not knowledge_id:
                print("DEBUG: Knowledge ID validation failed - empty")
                return jsonify({'success': False, 'message': 'Knowledge mode is mandatory. Please select a knowledge base before downloading.'}), 400
            try:
                knowledge_id = int(knowledge_id)
                print(f"DEBUG: Knowledge ID converted to int: {knowledge_id}")
            except Exception as e:
                print(f"DEBUG: Knowledge ID conversion failed: {e}")
                return jsonify({'success': False, 'message': 'Invalid knowledge base selected.'}), 400
        else:
            first_library_knowledge = (
                Knowledge.query.join(knowledge_libraries_association)
                .filter(knowledge_libraries_association.c.library_id == library_id)
                .first()
            )
            if first_library_knowledge is not None:
                knowledge_id = first_library_knowledge.id
                print(f"DEBUG: Defaulting knowledge_id to library association: {knowledge_id}")

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

                # Add to database
                file_size = temp_file_path.stat().st_size
                stored_filename = f"{uuid4()}_{filename}"
                
                uploaded_file = add_uploaded_file(
                    user_id=current_user.user_id,
                    original_name=filename,
                    stored_name=stored_filename,
                    size=file_size,
                    library_id=library_id,
                    knowledge_id=knowledge_id
                )
                
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
                else:
                    logger.warning("Celery task not available - file uploaded but processing disabled")
                    task_id = 'processing_disabled'
                
                uploaded_files.append({
                    'filename': filename,
                    'file_id': uploaded_file,
                    'task_id': task_id
                })

        return jsonify({
            'success': True, 
            'message': f'Successfully uploaded {len(uploaded_files)} file(s). Processing started.',
            'files': uploaded_files
        })

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

        response = None
        try:
            response = requests.head(raw_url, allow_redirects=True, timeout=5)
            if response.status_code >= 400:
                response.close()
                response = requests.get(raw_url, allow_redirects=True, timeout=5, stream=True)
            status_code = getattr(response, "status_code", None)
            if status_code is None or status_code >= 400:
                return jsonify({'valid': False, 'message': f'URL responded with status code {status_code or "unknown"}.'})
        except requests.RequestException as exc:
            logger.info("URL validation failed for %s: %s", raw_url, exc)
            return jsonify({'valid': False, 'message': 'URL could not be reached.'})
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass

        return jsonify({'valid': True, 'message': 'URL is reachable.'})

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

        library = get_library_with_details(library_id)
        if library is None:
            return jsonify({'success': False, 'message': 'Selected library does not exist.'}), 400

        vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
        if vector_store_setting == 'knowledge':
            if not knowledge_id:
                return jsonify({'success': False, 'message': 'Knowledge mode requires a knowledge selection.'}), 400
            try:
                knowledge_id_int = int(knowledge_id)
            except (TypeError, ValueError):
                return jsonify({'success': False, 'message': 'Invalid knowledge base selected.'}), 400
        else:
            knowledge_obj = (
                Knowledge.query.join(knowledge_libraries_association)
                .filter(knowledge_libraries_association.c.library_id == library_id)
                .first()
            )
            knowledge_id_int = knowledge_obj.id if knowledge_obj is not None else None

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


def allowed_file(filename):

    """Check if the file extension is allowed."""
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md', 'html', 'pptx', 'xlsx', 'csv', 'jpg', 'jpeg', 'png', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS