import logging
import re
from pathlib import Path

from flask import Blueprint, jsonify, render_template, flash, current_app
from flask_login import login_required

from modules.database import (
    Document,
    LibraryReference,
    UploadedFile,
    User,
    VectorReference,
    VisualGroundingActivity,
    build_knowledge_metadata_summary,
    db,
)
from modules.llm_utils import get_lc_store_path

files_bp = Blueprint('admin_files', __name__, url_prefix='/admin/files')


@files_bp.route('/')
@login_required
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


def _sanitize_collection_name(raw_value: str) -> str:
    candidate = (raw_value or '').strip().replace(' ', '_') or 'documents-vectors'
    if re.match(r'^[A-Za-z0-9._-]{3,512}$', candidate):
        return candidate
    return 'documents-vectors'


def _delete_vectors(doc_ids, user_id, knowledge_id) -> int:
    """Delete vectors via Celery worker to avoid Azure Files sync issues.
    
    Previously this function directly accessed ChromaDB, which caused
    sync issues on Azure when both web and worker containers tried to
    access the same Azure Files mount. Now it delegates to the worker.
    """
    if not doc_ids:
        return 0

    vector_provider = current_app.config.get('VECTOR_STORE_PROVIDER', 'chromadb')
    if vector_provider != 'chromadb':
        logging.info("Vector deletion for provider %s is not implemented.", vector_provider)
        return 0

    try:
        persist_path = get_lc_store_path(user_id=user_id, knowledge_id=knowledge_id)
    except Exception as path_exc:
        logging.error("Unable to resolve vector store path for user %s knowledge %s: %s", user_id, knowledge_id, path_exc)
        return 0

    if not persist_path:
        logging.warning("Vector store path returned None for user %s knowledge %s", user_id, knowledge_id)
        return 0

    persist_dir = Path(persist_path)
    if not persist_dir.exists():
        logging.info("Vector store directory %s does not exist; skipping vector deletion", persist_dir)
        return 0

    collection_name = _sanitize_collection_name(current_app.config.get('CHROMA_COLLECTION_NAME', 'documents-vectors'))

    # Use Celery worker for ChromaDB access to avoid Azure Files sync issues
    try:
        from modules.celery_tasks import delete_document_vectors_via_worker
        
        result = delete_document_vectors_via_worker(
            persist_directory=str(persist_dir),
            collection_name=collection_name,
            doc_ids=doc_ids,
            timeout=30.0,
        )
        
        if result.get("success"):
            deleted_count = result.get("deleted_count", 0)
            logging.info("Deleted %s vector entries via worker from collection %s", deleted_count, collection_name)
            return deleted_count
        else:
            error = result.get("error", "Unknown error")
            logging.error("Worker failed to delete vectors: %s", error)
            return 0
            
    except Exception as delete_exc:
        logging.error("Failed removing vectors for doc_ids %s: %s", doc_ids, delete_exc, exc_info=True)
        # Don't raise - allow file deletion to proceed even if vector deletion fails
        return 0


@files_bp.route('/delete/<int:file_id>', methods=['DELETE'])
@login_required
def delete_file(file_id: int):
    uploaded_file = UploadedFile.query.get(file_id)
    if not uploaded_file:
        logging.warning("Attempt to delete missing file_id %s", file_id)
        return jsonify({"status": "error", "message": "File record not found."}), 404

    try:
        docs = (
            Document.query
            .filter_by(
                source=uploaded_file.original_filename,
                library_id=uploaded_file.library_id,
                knowledge_id=uploaded_file.knowledge_id,
            )
            .all()
        )
        doc_ids = [str(doc.id) for doc in docs]

        vector_removed = 0
        if doc_ids:
            vector_removed = _delete_vectors(doc_ids, uploaded_file.user_id, uploaded_file.knowledge_id)
            for doc in docs:
                db.session.delete(doc)

        VectorReference.query.filter_by(file_id=file_id).delete(synchronize_session=False)
        LibraryReference.query.filter_by(reference_type='file', source_id=file_id).delete(synchronize_session=False)
        VisualGroundingActivity.query.filter_by(file_id=file_id).delete(synchronize_session=False)

        db.session.delete(uploaded_file)
        db.session.commit()

        message = "File deleted successfully."
        if vector_removed:
            message = f"File deleted successfully. Removed {vector_removed} vector chunk(s)."
        logging.info("Admin removed file_id %s", file_id)
        return jsonify({"status": "success", "message": message})
    except Exception as exc:
        logging.error("Failed to delete file_id %s: %s", file_id, exc, exc_info=True)
        db.session.rollback()
        return jsonify({"status": "error", "message": "Failed to delete file."}), 500
