from flask import render_template, request, flash, redirect, url_for, session, jsonify, current_app
from flask_login import login_required, current_user
from flask_wtf import FlaskForm, CSRFProtect
import os
from werkzeug.utils import secure_filename
import tempfile
import logging
from pathlib import Path
from uuid import uuid4

# Import Celery task wrapper (worker only - web container submits tasks)
try:
    from modules.celery_tasks import submit_file_processing_task
except ImportError:
    submit_file_processing_task = None

# Import database functions
from modules.database import (
    add_uploaded_file, get_libraries_with_details, 
    Library, Knowledge, db
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
        knowledge_id = 0

        if not library_id:
            return jsonify({'success': False, 'message': 'Please select a library.'}), 400
            
        try:
            library_id = int(library_id)
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid library selected.'}), 400

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
                temp_dir = tempfile.mkdtemp()
                temp_file_path = os.path.join(temp_dir, filename)
                file.save(temp_file_path)

                # Add to database
                file_size = os.path.getsize(temp_file_path)
                stored_filename = f"{uuid4()}_{filename}"
                
                uploaded_file = add_uploaded_file(
                    user_id=current_user.user_id,
                    original_name=filename,
                    stored_name=stored_filename,
                    size=file_size,
                    library_id=library_id
                )
                
                # Submit processing task to Celery worker
                enable_visual_grounding = request.form.get('enable_visual_grounding') == 'true'
                
                # Submit async task to worker using wrapper
                task_id = None
                if submit_file_processing_task:
                    task_id = submit_file_processing_task(
                        temp_file_path=temp_file_path,
                        filename=filename,
                        user_id=current_user.user_id,
                        library_id=library_id,
                        library_name=library_name,
                        knowledge_id_str=str(knowledge_id) if knowledge_id else None,
                        enable_visual_grounding_flag=enable_visual_grounding
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

def allowed_file(filename):
    """Check if the file extension is allowed."""
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md', 'html', 'pptx', 'xlsx', 'csv', 'jpg', 'jpeg', 'png', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS