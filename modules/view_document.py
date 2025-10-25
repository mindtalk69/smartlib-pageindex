from flask import Blueprint, abort, current_app, render_template
from .database import db, Library, Document
from .llm_utils import get_lc_store_path, get_embedding_model_name
from modules.celery_tasks import fetch_document_chunks
import logging
import uuid


view_document_bp = Blueprint('view_document', __name__)

@view_document_bp.route('/view_document/<int:library_id>/<path:document_id>')
def view_document(library_id, document_id):
    """
    Retrieves and displays the content of a specific document from a library.
    """
    # --- Start of corrected function ---
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        abort(400, description="Invalid document ID format.")

    doc = db.session.get(Document, doc_uuid)
    if not doc:
        abort(404, description="Document metadata not found in database.")

    library = db.session.get(Library, library_id)
    if not library:
        abort(404, description="Library not found.")

    knowledge_id = doc.knowledge_id
    user_id = library.created_by_user_id

    base_collection_name = current_app.config.get('CHROMA_COLLECTION_NAME', 'documents-vectors')
    persist_directory = None
    try:
        embedding_model_id = get_embedding_model_name()
        sanitized_model_id = embedding_model_id.replace('/', '_').replace('-', '_')
        collection_name = f"{base_collection_name}_{sanitized_model_id}"
        logging.info(f"Viewing document from dynamic ChromaDB collection: {collection_name}")
    except Exception as e:
        logging.warning(f"Could not get embedding model name for dynamic collection name during document view, falling back to static. Error: {e}")
        collection_name = base_collection_name

    logging.info(f"Attempting to view document '{document_id}' from library '{collection_name}' (ID: {library_id}).")

    try:
        persist_directory_obj = get_lc_store_path(user_id=user_id, knowledge_id=knowledge_id)
        if not persist_directory_obj:
            abort(500, "Could not determine vector store path.")
        persist_directory = str(persist_directory_obj)

        result = fetch_document_chunks(persist_directory, collection_name, str(document_id))
        if not result:
            logging.warning("Vector worker did not return chunks for document %s", document_id)
            abort(503, description="Vector worker unavailable. Please ensure the worker container is running.")

        documents = result.get('documents') or []
        metadatas = result.get('metadatas') or []
        if not documents:
            logging.warning(f"Document with doc_id '{document_id}' not found in collection '{collection_name}'.")
            abort(404, description=f"Document content not found in vector store for ID '{document_id}'.")

        logging.info(f"Successfully retrieved {len(documents)} chunks for document '{document_id}'.")
        document_chunks = []
        for i, content in enumerate(documents):
            metadata = metadatas[i] if i < len(metadatas) else {}
            page_number = metadata.get('page_number')
            if not page_number and metadata.get('pages'):
                try:
                    page_number = metadata['pages'][0]['pageNumber']
                except (KeyError, IndexError, TypeError):
                    page_number = 'N/A'
            if page_number is None:
                page_number = 'N/A'
            document_chunks.append({'content': content, 'page': page_number, 'metadata': metadata})

        try:
            document_chunks.sort(key=lambda x: int(x['page']) if isinstance(x['page'], (int, float)) or (isinstance(x['page'], str) and x['page'].isdigit()) else float('inf'))
        except (ValueError, TypeError):
            pass

        source = doc.source or "Unknown Source"
        return render_template('view_document.html',
                               document={'name': source, 'content': '', 'chunks': document_chunks, 'id': document_id},
                               library_id=library_id)

    except ValueError as e:
        if "does not exist" in str(e):
            logging.error(
                "Vector collection '%s' not found in '%s'. Error: %s",
                collection_name,
                persist_directory,
                e,
            )
            abort(404, description=f"Collection '{collection_name}' not found. You may need to re-ingest documents with the current embedding model.")
        else:
            logging.error(f"A value error occurred while fetching document '{document_id}': {str(e)}", exc_info=True)
            abort(500, description="An internal error occurred.")
    except Exception as e:
        logging.error(f"An error occurred while fetching document '{document_id}': {str(e)}", exc_info=True)
        abort(500, description="An internal error occurred.")
    # --- End of corrected function ---

def init_view_document(app):
    app.register_blueprint(view_document_bp)
