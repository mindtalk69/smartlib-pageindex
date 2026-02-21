from flask import Blueprint, abort, current_app, render_template
from sqlalchemy import select
from .database import db, Library, Document, knowledge_libraries_association
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
        logging.warning("Document metadata not found for %s; attempting vector-store fallback.", document_id)

    library = db.session.get(Library, library_id)
    if not library:
        abort(404, description="Library not found.")

    knowledge_id = doc.knowledge_id if doc else None
    user_id = library.created_by_user_id

    vector_mode = current_app.config.get('VECTOR_STORE_MODE', 'user')
    if knowledge_id is None and vector_mode == 'knowledge':
        fallback_knowledge = None
        try:
            stmt = select(knowledge_libraries_association.c.knowledge_id).where(
                knowledge_libraries_association.c.library_id == library.library_id
            )
            result = db.session.execute(stmt).first()
            if result is not None:
                fallback_knowledge = result[0]
        except Exception as assoc_err:
            logging.error(
                "Failed to resolve knowledge fallback for library %s: %s",
                library.library_id,
                assoc_err,
            )
        if fallback_knowledge is None:
            logging.error(
                "Unable to resolve knowledge ID for document %s in knowledge mode.",
                document_id,
            )
            abort(404, description="Knowledge scope not found for this document.")
        knowledge_id = fallback_knowledge

    # Get collection name based on vector store provider
    import os
    vector_provider = os.environ.get('VECTOR_STORE_PROVIDER', 'sqlite-vec')

    # Collection name configuration based on provider
    if vector_provider == 'pgvector':
        base_collection_name = current_app.config.get('PGVECTOR_COLLECTION_NAME', 'documents_vectors')
    elif vector_provider == 'chromadb':
        # Legacy ChromaDB support (backward compatibility only)
        base_collection_name = current_app.config.get('CHROMA_COLLECTION_NAME', 'documents-vectors')
    else:
        # sqlite-vec uses table name, not collection name
        base_collection_name = current_app.config.get('SQLITE_VECTOR_TABLE_NAME', 'document_vectors')

    persist_directory = None

    logging.info(f"[ViewDocument] Using vector provider: {vector_provider}, collection: {base_collection_name}")

    collection_candidates = []
    try:
        embedding_model_id = get_embedding_model_name()
        sanitized_model_id = embedding_model_id.replace('/', '_').replace('-', '_')
        dynamic_name = f"{base_collection_name}_{sanitized_model_id}"
        if dynamic_name != base_collection_name:
            collection_candidates.append(dynamic_name)
    except Exception as e:
        logging.warning(
            "Could not resolve embedding-specific collection name; will retry with base collection. Error: %s",
            e,
        )

    collection_candidates.append(base_collection_name)
    collection_candidates = list(dict.fromkeys(collection_candidates))

    logging.info(
        "Attempting to view document '%s' from library %s using candidate collections: %s",
        document_id,
        library_id,
        collection_candidates,
    )

    selected_collection = None
    try:
        persist_directory_obj = get_lc_store_path(user_id=user_id, knowledge_id=knowledge_id)
        if not persist_directory_obj:
            abort(500, "Could not determine vector store path.")
        persist_directory = str(persist_directory_obj)

        documents = []
        metadatas = []
        selected_collection = None
        worker_unavailable = False

        for candidate in collection_candidates:
            logging.info(
                "Requesting chunks for document '%s' from collection '%s' at '%s'.",
                document_id,
                candidate,
                persist_directory,
            )
            result = fetch_document_chunks(persist_directory, candidate, str(document_id))
            if result is None:
                worker_unavailable = True
                logging.warning(
                    "Vector worker returned no payload for document %s (collection %s)",
                    document_id,
                    candidate,
                )
                continue

            documents = result.get('documents') or []
            metadatas = result.get('metadatas') or []
            if documents:
                selected_collection = candidate
                break
            logging.info(
                "Collection '%s' did not contain document '%s'; trying next candidate.",
                candidate,
                document_id,
            )

        if not documents:
            if worker_unavailable:
                abort(503, description="Vector worker unavailable. Please ensure the worker container is running.")
            logging.warning(
                "Unable to locate document '%s' in any collection %s at '%s'.",
                document_id,
                collection_candidates,
                persist_directory,
            )
            abort(404, description=f"Document content not found in vector store for ID '{document_id}'.")

        resolved_collection = selected_collection or collection_candidates[-1]
        logging.info(
            "Successfully retrieved %d chunks for document '%s' from collection '%s'.",
            len(documents),
            document_id,
            resolved_collection,
        )
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

        if doc and doc.source:
            source = doc.source
        else:
            source = library.name or "Unknown Source"
        return render_template('view_document.html',
                               document={'name': source, 'content': '', 'chunks': document_chunks, 'id': document_id},
                               library_id=library_id)

    except ValueError as e:
        if "does not exist" in str(e):
            target_collection = selected_collection or collection_candidates[-1]
            logging.error(
                "Vector collection '%s' not found in '%s'. Error: %s",
                target_collection,
                persist_directory,
                e,
            )
            abort(404, description=f"Collection '{target_collection}' not found. You may need to re-ingest documents with the current embedding model.")
        else:
            logging.error(f"A value error occurred while fetching document '{document_id}': {str(e)}", exc_info=True)
            abort(500, description="An internal error occurred.")
    except Exception as e:
        logging.error(f"An error occurred while fetching document '{document_id}': {str(e)}", exc_info=True)
        abort(500, description="An internal error occurred.")
    # --- End of corrected function ---

def init_view_document(app):
    app.register_blueprint(view_document_bp)
