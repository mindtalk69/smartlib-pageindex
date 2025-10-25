from flask import Blueprint, render_template, flash
from modules.database import UploadedFile, User
import logging

files_bp = Blueprint('admin_files', __name__, url_prefix='/admin/files')

@files_bp.route('/')
def file_management():
    files = []
    try:
        from modules.database import Library, Knowledge
        files_data = (
            UploadedFile.query
            .join(User, UploadedFile.user_id == User.user_id)
            .outerjoin(Library, UploadedFile.library_id == Library.library_id)
            .outerjoin(Knowledge, UploadedFile.knowledge_id == Knowledge.id)
            .with_entities(
                UploadedFile.file_id,
                UploadedFile.original_filename,
                UploadedFile.file_size,
                UploadedFile.upload_time,
                User.username,
                Library.name.label('library_name'),
                Knowledge.name.label('knowledge_name'),
                UploadedFile.is_ocr
            )
            .order_by(UploadedFile.upload_time.desc())
            .all()
        )
        files = [
            {
                'id': f[0], 'filename': f[1], 'file_size': f[2],
                'upload_time': f[3], 'username': f[4],
                'library_name': f[5], 'knowledge_name': f[6],
                'is_ocr': f[7]
            } for f in files_data
        ]
    except Exception as e:
        logging.error(f"Error fetching files: {e}")
        flash("Error loading files.", "danger")
        files = []
    return render_template('admin/files.html', files=files)
