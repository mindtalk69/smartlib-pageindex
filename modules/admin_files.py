from flask import Blueprint, render_template, flash
from modules.database import UploadedFile, User, build_knowledge_metadata_summary
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
                UploadedFile.is_ocr,
                UploadedFile.knowledge_id,
            )
            .order_by(UploadedFile.upload_time.desc())
            .all()
        )

        knowledge_ids = {row[8] for row in files_data if row[8] is not None}
        metadata_map = build_knowledge_metadata_summary(knowledge_ids)

        def format_metadata(knowledge_id):
            if knowledge_id is None:
                return 'N/A'
            return metadata_map.get(knowledge_id, 'None')

        files = [
            {
                'id': row[0],
                'filename': row[1],
                'file_size': row[2],
                'upload_time': row[3],
                'username': row[4],
                'library_name': row[5],
                'knowledge_name': row[6],
                'is_ocr': row[7],
                'metadata_summary': format_metadata(row[8]),
            }
            for row in files_data
        ]
    except Exception as exc:
        logging.error("Error fetching files: %s", exc)
        flash("Error loading files.", "danger")
        files = []
    return render_template('admin/files.html', files=files)
