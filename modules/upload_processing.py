import os
import tempfile
import logging
from pathlib import Path
import time
from werkzeug.utils import secure_filename
import tqdm

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat
from langchain_community.document_loaders import AzureAIDocumentIntelligenceLoader
from langchain_docling import DoclingLoader
from langchain_docling.loader import ExportType
from docling.chunking import HybridChunker

# Import MetaExtractor only if available (for ENT edition with visual grounding)
try:
    from langchain_docling.loader import MetaExtractor
    HAS_META_EXTRACTOR = True
except ImportError:
    HAS_META_EXTRACTOR = False
    logging.warning("MetaExtractor not available - visual grounding dl_meta extraction will be limited")
from transformers import AutoTokenizer
from langchain_text_splitters import MarkdownHeaderTextSplitter
# Import the correct Document class from Langchain and alias it
from langchain.docstore.document import Document as LangchainDocument
from modules.ocr_utils import (
    is_image_only_pdf,
    Is_cuda_available,
    clean_markdown_content,
    Get_image_first_page_base64,
    run_rapidocr_on_pdf_all_pages,
)
from uuid import uuid4 # create Id documents
from modules.llm_utils import get_embedding_model_name, classify_document_metadata, classify_document_metadata_multimodal
from modules.database import (
    add_vector_reference,
    add_uploaded_file,
    add_library_reference,
    add_document,
    get_knowledge_by_id,
    add_visual_grounding_activities,
    cleanup_failed_ingestion,
    Library,
    Knowledge,
    Document as DBDocument,
    db,
)
from modules.database import (
    UploadedFile,
    LibraryReference,
    VisualGroundingActivity,
    AppSettings,
    update_url_download,
)
# Import the vector store processing function from the new utility module
from modules.vector_store_utils import process_and_store_chunks

def process_uploaded_file(
    file_path,
    filename,
    user_id,
    library_id,
    library_name,
    knowledge_id=None,
    enable_visual_grounding=False,
    logger=None,
    app_config=None,
    current_user=None,
    url_download_id=None,
    source_url=None,
):
    """
    Process a single uploaded file for ingestion, chunking, vector store, and metadata.
    Returns a dict with result info (success, message, file_id, etc.).
    """
    logger = logger or logging.getLogger(__name__)
    results = {}
    actual_file_size = os.path.getsize(file_path)
    logger.info(f"Processing file: {filename} for library_id: {library_id}, library_name: {library_name}")
    reference_type = 'url_download' if url_download_id else 'file'

    # --- Visual Grounding Setup ---
    converter = None
    dl_doc_saved = False
    target_json_path_str = None
    dl_doc = None
    saved_dl_meta = None

    from docling.datamodel.pipeline_options import (
        AcceleratorDevice,
        AcceleratorOptions,
        PdfPipelineOptions,
    )

    IS_CUDA = Is_cuda_available()

    if not IS_CUDA:
            accelerator_options = AcceleratorOptions(
                num_threads=8,
                device=AcceleratorDevice.CPU,
                )
    else:
          accelerator_options = AcceleratorOptions(
                     num_threads=8,
                     device=AcceleratorDevice.CUDA,
                     cuda_use_flash_attention2=True)


    logger.info(f"enable_visual_grounding : {enable_visual_grounding}")

    if enable_visual_grounding:

        try:
            # Create PdfPipelineOptions instance for visual grounding
            vg_pipeline_options = PdfPipelineOptions(
                generate_page_images=True,
                images_scale=2.0,
            )
            vg_pipeline_options.accelerator_options = accelerator_options # Explicitly set accelerator options

            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_options=vg_pipeline_options,
                    )
                }
            )
            logger.info(f"Initialized VISUAL GROUNDING DocumentConverter with image generation enabled. CUDA : {IS_CUDA}")
        except Exception as conv_e:
            logger.error(f"Failed to initialize DocumentConverter for visual grounding: {conv_e}", exc_info=True)
    else:

        try:
            pipeline_options = PdfPipelineOptions()
            pipeline_options.accelerator_options = accelerator_options

            converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(
                        pipeline_options=pipeline_options,
                    )
                }
            )
            logger.info(f"Initialized DocumentConverter without image generation. CUDA : {IS_CUDA}") # Corrected log message
        except Exception as conv_e:
            logger.error(f"Failed to initialize DocumentConverter: {conv_e}", exc_info=True) # Corrected log message
            return {'success': False, 'message': f'Failed to initialize document converter: {str(conv_e)}'} # Corrected log message

    # Start Converter - This line seems redundant now as converter is initialized above
    # converter = DocumentConverter()
    # logger.info("Initialized default DocumentConverter")

    # --- PDF/Image-Only Detection ---
    file_ext = os.path.splitext(filename)[1].lower()
    IS_PDF_IMAGE_ONLY = False
    if file_ext == ".pdf":
        IS_PDF_IMAGE_ONLY = is_image_only_pdf(file_path)
    logger.info(f"PDF is image-only: {IS_PDF_IMAGE_ONLY}")

    # --- OCR Settings ---
    IS_AUTO_OCR = False
    IS_ENABLED_OCR = False
    IS_OCR_LOCAL = True
    if app_config and 'AppSettings' in app_config:
        AppSettings = app_config['AppSettings']
        is_auto_ocr_setting = AppSettings.query.filter_by(key='is_auto_ocr').first()
        is_enabled_ocr_setting = AppSettings.query.filter_by(key='is_enabled_ocr').first()
        selected_ocr_setting = AppSettings.query.filter_by(key='ocr_mode').first()
        IS_AUTO_OCR = is_auto_ocr_setting.value == '1' if is_auto_ocr_setting else False
        IS_ENABLED_OCR = (
            is_enabled_ocr_setting.value == '1'
            if is_enabled_ocr_setting
            else bool(app_config.get('IS_ENABLED_OCR', False))
        )
        IS_OCR_LOCAL = (
            selected_ocr_setting.value == 'default'
            if selected_ocr_setting
            else app_config.get('OCR_MODE', 'default') == 'default'
        )
    else:
        IS_AUTO_OCR = bool(app_config.get('IS_AUTO_OCR', False)) if app_config else False
        IS_ENABLED_OCR = bool(app_config.get('IS_ENABLED_OCR', False)) if app_config else False
        IS_OCR_LOCAL = (
            app_config.get('OCR_MODE', 'default') == 'default'
            if app_config
            else True
        )

    # --- Visual Grounding Save DoclingDocument ---
    IS_VISUAL_GROUNDING_COMPLETED = False
    if enable_visual_grounding and converter is not None:
        try:
            #converted_result = converter.convert(source=file_path)
            dl_doc = converter.convert(source=file_path).document
            
            # --- ADD DEBUG PRINTS HERE ---
            logger.debug(f"--- Debugging dl_doc before saving JSON for {filename} (Visual Grounding) ---")
            if hasattr(dl_doc, 'origin') and dl_doc.origin:
                logger.debug(f"dl_doc.origin.binary_hash: {dl_doc.origin.binary_hash}")
            else:
                logger.debug("dl_doc.origin is missing or None.")

            if hasattr(dl_doc, 'pages') and dl_doc.pages is not None and isinstance(dl_doc.pages, list):
                logger.debug(f"Number of pages in dl_doc: {len(dl_doc.pages)}")
                if len(dl_doc.pages) > 0:
                    first_page = dl_doc.pages[0]
                    logger.debug(f"First page object type: {type(first_page)}")
                    if hasattr(first_page, 'size') and first_page.size is not None:
                        logger.debug(f"First page size: {first_page.size}")
                        if hasattr(first_page.size, 'height') and first_page.size.height is not None:
                            logger.debug(f"First page height: {first_page.size.height}")
                        else:
                            logger.debug("First page size object does NOT have 'height' attribute or it is None.")
                    else:
                        logger.debug("First page object does NOT have 'size' attribute or it is None.")
                else:
                    logger.debug("dl_doc.pages is an empty list.")
            else:
                logger.debug("dl_doc object does not have 'pages' attribute, it is None, or it is not a list.")
            logger.debug(f"--- End Debugging dl_doc for {filename} (Visual Grounding) ---")
            # --- END DEBUG PRINTS ---

            # Determine if we should use centralized storage (no user subdirs)
            # ENT: Always centralized (PGVector, metadata-based isolation)
            # BASIC + global mode: Centralized (shared vector store)
            # BASIC + user/knowledge mode: User-specific subdirectories
            app_edition = os.environ.get('APP_EDITION', 'BASIC')
            vector_store_mode = app_config.get('VECTOR_STORE_MODE') if app_config else os.environ.get('VECTOR_STORE_MODE', 'user')

            # Use centralized storage (no subdirectories) for both ENT and BASIC editions
            # This simplifies visual grounding file management across all editions
            use_centralized_storage = (app_edition == 'ENT') or (app_edition == 'BASIC')

            if use_centralized_storage:
                # ENT or BASIC: Use DATA_VOLUME_PATH (Azure-compatible, mounted volume)
                # Centralized storage with no user/knowledge subdirectories for simpler management
                data_volume_path = (app_config.get('DATA_VOLUME_PATH') if app_config else None) or os.environ.get('DATA_VOLUME_PATH', '/home/data')
                data_volume = Path(data_volume_path)  # For path resolution later
                doc_store_base_path = Path(data_volume_path) / 'doc_store'
                logger.info(f"[Visual Grounding] Centralized storage (edition={app_edition}): {doc_store_base_path}")
            else:
                # Fallback for custom configurations (shouldn't reach here for standard BASIC/ENT)
                data_volume = app_config.get('DATA_VOLUME_PATH', 'data') if app_config else 'data'
                doc_store_default = os.path.join(data_volume, 'doc_store')
                doc_store_base_path = Path(app_config.get('VISUAL_GROUNDING_DOC_STORE_PATH', doc_store_default)) if app_config else Path(doc_store_default)
                logger.info(f"[Visual Grounding] Custom storage (edition={app_edition}, mode={vector_store_mode}): {doc_store_base_path}")

            # Determine subdirectory based on mode
            if use_centralized_storage:
                # ENT or global: No subdirectory
                target_dir = doc_store_base_path
            elif vector_store_mode == 'knowledge' and knowledge_id:
                # BASIC + knowledge mode: Use knowledge_id subdirectory
                target_dir = doc_store_base_path / str(knowledge_id)
            else:
                # BASIC + user mode: Use user_id subdirectory
                target_dir = doc_store_base_path / str(user_id)

            binary_hash = dl_doc.origin.binary_hash
            target_json_path = target_dir / f'{binary_hash}.json'

            # Store relative path in DB for portability (Azure vs local)
            # Absolute path: /home/data/doc_store/xxx.json -> Relative: data/doc_store/xxx.json
            target_json_path_abs = str(target_json_path)
            if data_volume and target_json_path_abs.startswith(str(data_volume)):
                # Strip DATA_VOLUME_PATH to get relative path
                target_json_path_str = target_json_path_abs.replace(str(data_volume) + os.sep, 'data/')
            else:
                # Fallback to relative path
                target_json_path_str = f"data/doc_store/{binary_hash}.json"

            target_dir.mkdir(parents=True, exist_ok=True)
            dl_doc.save_as_json(target_json_path)
            dl_doc_saved = True
            saved_dl_meta = {
                'origin': {
                    'binary_hash': binary_hash
                }
            }
            logger.info(f"Saved DoclingDocument for grounding to: {target_json_path_str}")
            IS_VISUAL_GROUNDING_COMPLETED=True          

        except Exception as save_e:
            logger.error(f"Failed to convert/save full document for grounding ({filename}): {save_e}", exc_info=True)
            dl_doc_saved = False
            target_json_path_str = None

    # --- DoclingLoader Logic ---
    docling_export_type_str = app_config.get('DOCLING_EXPORT_TYPE', 'MARKDOWN').upper() if app_config else 'MARKDOWN'
    splits = []
    loaded_docs = []
    chunker = None # Initialize chunker

    # OCR for image-only PDF
    api_endpoint = None
    api_key = None
    is_az_doci = False # Flag to track if Azure Doc Intelligence was used

    # hit azure if IS_OCR_LOCAL = false
    if IS_ENABLED_OCR and IS_AUTO_OCR and app_config and 'AppSettings' in app_config:

        # if visual grounding applied we can not used docintteligence unless it works like schema from docling to display grounding
        if IS_OCR_LOCAL == False:
            AppSettings = app_config['AppSettings']
            api_endpoint_setting = AppSettings.query.filter_by(key='doc_intelligence_endpoint').first()
            api_key_setting = AppSettings.query.filter_by(key='doc_intelligence_key').first()
            api_endpoint = api_endpoint_setting.value if api_endpoint_setting else None
            api_key = api_key_setting.value if api_key_setting else None
            if not api_endpoint:
                api_endpoint = os.getenv("DOC_INTELLIGENCE_ENDPOINT")
            if not api_key:
                api_key = os.getenv("DOC_INTELLIGENCE_KEY")
            if not all([api_endpoint, api_key]):
                logger.error("Azure DOC INTELLIGENCE credentials or endpoints are missing")
            else:
                docling_export_type_str = 'MARKDOWN' # Force markdown for Azure DocInt
                logger.info("Azure DOC INTELLIGENCE credentials found. Will attempt Azure OCR")
        else:
                 # Preparing docling pipeline for local OCR
                from docling.datamodel.pipeline_options import (
                        PdfPipelineOptions,
                        RapidOcrOptions
                    )
                # Configure local OCR for PDFs whenever local OCR is enabled (not only for image-only PDFs)
                pipeline_options = PdfPipelineOptions()
                pipeline_options.accelerator_options = accelerator_options
                # Enable OCR and table structure extraction so Docling runs OCR even if selectable text exists
                pipeline_options.do_ocr = True
                pipeline_options.do_table_structure = True
                pipeline_options.table_structure_options.do_cell_matching = True
                # Prefer RapidOCR for local OCR when available
                try:
                    ocr_options = RapidOcrOptions(force_full_page_ocr=True)
                    logger.info("Configuring local OCR with RapidOCR for PDFs")
                except Exception as ocr_e:
                    ocr_options = None

                if ocr_options:
                    pipeline_options.ocr_options = ocr_options
                    converter = DocumentConverter(
                        format_options={
                            InputFormat.PDF: PdfFormatOption(
                                pipeline_options=pipeline_options,
                            )
                        }
                    )
                    logger.info("Re-initialized converter with local OCR enabled for PDFs.")
                else:
                    logger.error("OCR options unavailable; proceeding without OCR-enabled converter for PDFs.")


    if docling_export_type_str == 'DOC_CHUNKS':
        EMBED_MODEL_ID = get_embedding_model_name()
        tokenizer_model_id = EMBED_MODEL_ID

        # List of known Azure OpenAI embedding model names that are not on HuggingFace
        azure_embedding_models = ["text-embedding-3-small", "text-embedding-3-large"]

        # If the selected model is an Azure model, we can't load its tokenizer from HuggingFace.
        # For the purpose of chunking with HybridChunker, we can use a standard tokenizer
        # as a proxy for token counting. 'bert-base-uncased' is a safe default.
        if EMBED_MODEL_ID in azure_embedding_models:
            logger.info(f"Selected embedding model '{EMBED_MODEL_ID}' is an Azure model. Using 'sentence-transformers/all-MiniLM-L6-v2' as a proxy tokenizer for chunking.")
            tokenizer_model_id = "sentence-transformers/all-MiniLM-L6-v2"
        elif tokenizer_model_id == "all-MiniLM-L6-v2":
            logger.info(f"Selected embedding model is 'all-MiniLM-L6-v2'. Using 'sentence-transformers/all-MiniLM-L6-v2' for tokenizer.")
            tokenizer_model_id = "sentence-transformers/all-MiniLM-L6-v2"

        try:
            tokenizer = AutoTokenizer.from_pretrained(tokenizer_model_id)
        except Exception as tokenizer_err:
            logger.error(f"Failed to load tokenizer '{tokenizer_model_id}': {tokenizer_err}", exc_info=True)
            return {'success': False, 'message': f"Failed to load tokenizer: {tokenizer_err}"}

        chunker = HybridChunker(tokenizer=tokenizer)

        # DOC_CHUNKS export type automatically includes dl_meta in chunk metadata
        # No need to explicitly pass meta_extractor - it's included by default
        loader = DoclingLoader(
            file_path=file_path,
            converter=converter,
            export_type=ExportType.DOC_CHUNKS,
            chunker=chunker
        )
        splits = loader.load()
        logger.info(f"Loaded {len(splits)} chunks using DoclingLoader (DOC_CHUNKS).")

    elif docling_export_type_str == 'MARKDOWN':
        if api_endpoint and api_key:
            try:
                logger.info(f"Attempting to load with Azure Document Intelligence: {filename}")
                loader = AzureAIDocumentIntelligenceLoader(
                    api_endpoint=api_endpoint,
                    api_key=api_key,
                    file_path=file_path,
                    api_model="prebuilt-layout",
                    mode="markdown",
                )
                loaded_docs = loader.load()
                is_az_doci = True # Mark that Azure was successfully used
                logger.info(f"Successfully loaded {len(loaded_docs)} documents using Azure Document Intelligence.")
            except Exception as azure_err:
                is_az_doci = False
                logger.error(f"Failed to load with Azure Document Intelligence: {azure_err}", exc_info=True)
                logger.info("Falling back to DoclingLoader for MARKDOWN export.")
                # Fallback to DoclingLoader
                loader = DoclingLoader(
                    file_path=file_path,
                    converter=converter, # Use the potentially OCR-enabled converter
                    export_type=ExportType.MARKDOWN,
                    # chunker is not used for MARKDOWN export type in DoclingLoader
                )
                loaded_docs = loader.load()
                logger.info(f"Loaded {len(loaded_docs)} documents using DoclingLoader (MARKDOWN fallback).")

        else:
            # Use DoclingLoader directly for MARKDOWN export
            logger.info(f"Using DoclingLoader for MARKDOWN export: {filename}")
            loader = DoclingLoader(
                file_path=file_path,
                converter=converter, # Use the potentially OCR-enabled converter
                export_type=ExportType.MARKDOWN,
                # chunker is not used for MARKDOWN export type in DoclingLoader
            )
            loaded_docs = loader.load()
            logger.info(f"Loaded {len(loaded_docs)} documents using DoclingLoader (MARKDOWN).")


        headers_to_split_on = [
            ("#", "Header_1"),
            ("##", "Header_2"),
            ("###", "Header_3"),
        ]

        # Combine content from loaded docs
        markdown_document = ""
        base_metadata_from_load = {} # Store metadata from the first loaded doc
        if loaded_docs:
            base_metadata_from_load = loaded_docs[0].metadata if hasattr(loaded_docs[0], 'metadata') else {}
            for doc in loaded_docs:
                markdown_document += doc.page_content + "\n\n"

        markdown_document = clean_markdown_content(markdown_document)
        if not markdown_document.strip():
             logger.warning(f"No text content extracted after loading and cleaning for {filename}.")
             # Decide if this should be an error or just a warning
             # return {'success': True, 'warning': 'No text content extracted from the document.'}

        # MD splits based on headers
        markdown_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on, strip_headers=False
        )
        md_header_splits = markdown_splitter.split_text(markdown_document)

        # If header splitting results in no splits, use the original document content
        if not md_header_splits and markdown_document.strip():
             logger.warning("Markdown header splitting resulted in no splits. Using raw content.")
             # Create a single LangchainDocument from the raw content
             md_header_splits = [LangchainDocument(page_content=markdown_document, metadata=base_metadata_from_load)]


        # Char-level splits on header splits
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        chunk_size = 1000
        chunk_overlap = 200
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " "]
        )

        # Split the documents obtained from header splitting
        splits = text_splitter.split_documents(md_header_splits)
        logger.info(f"Split MARKDOWN content into {len(splits)} final chunks.")

    else:
        logger.error(f"Invalid DOCLING_EXPORT_TYPE: {docling_export_type_str}")
        return {'success': False, 'message': 'Invalid server configuration.'}

    if not splits:
        logger.warning(f"No content chunks generated for {filename}.")

        # Attempt OCR fallback using RapidOCR on all pages for PDFs
        fallback_created = False
        try:
            if file_ext == ".pdf":
                try:
                    # Use project defaults tuned for balanced OCR quality and speed:
                    # DPI=200, preprocess=True, threshold=True. GPU usage follows IS_CUDA.
                    pages_ocr = run_rapidocr_on_pdf_all_pages(
                        file_path,
                        languages=['en'],
                        gpu=IS_CUDA,
                        dpi=200,
                        preprocess=True,
                        threshold=True,
                    )
                except Exception as e_pages:
                    logger.error(
                        f"Failed to run multi-page RapidOCR fallback: {e_pages}",
                        exc_info=True,
                    )
                    pages_ocr = []

                if pages_ocr:
                    new_splits = []
                    for page_out in pages_ocr:
                        page_text = page_out.get("text", "") if isinstance(page_out, dict) else ""
                        page_num = page_out.get("page_number") if isinstance(page_out, dict) else None
                        if page_text and page_text.strip():
                            meta = {"source": filename, "library_id": library_id, "library_name": library_name}
                            if page_num:
                                meta["page_number"] = page_num
                            new_splits.append(LangchainDocument(page_content=page_text, metadata=meta))

                    if new_splits:
                        splits = new_splits
                        fallback_created = True
                        logger.info(f"Fallback OCR produced text for {filename}; continuing with {len(splits)} generated chunk(s).")
                    else:
                        logger.warning(f"Fallback OCR produced no usable text for any pages of {filename}.")
                else:
                    logger.info("No OCR pages generated during fallback (empty or error).")
        except Exception as outer_fb_e:
            logger.error(f"Unexpected error during multi-page OCR fallback for {filename}: {outer_fb_e}", exc_info=True)

        # If fallback did not create splits, record upload with zero chunks as before
        if not splits:
            try:
                uploaded_file = UploadedFile(
                    user_id=user_id, original_filename=filename, stored_filename=f"{user_id}_{filename}",
                    file_size=actual_file_size, library_id=library_id, knowledge_id=knowledge_id,
                    is_ocr=IS_PDF_IMAGE_ONLY, is_az_doci=is_az_doci
                )
                db.session.add(uploaded_file)
                db.session.flush()
                file_id = uploaded_file.file_id
                reference_type = 'url_download' if url_download_id else 'file'
                library_ref = LibraryReference(library_id=library_id, user_id=user_id, reference_type=reference_type, source_id=file_id)
                db.session.add(library_ref)
                db.session.commit()
                logger.info(f"Recorded file upload (file_id: {file_id}) despite zero chunks generated.")
                return {'success': True, 'warning': 'No content chunks generated after splitting.', 'file_id': file_id}
            except Exception as db_err:
                db.session.rollback()
                logger.error(f"Failed to record file upload for zero-chunk file {filename}: {db_err}", exc_info=True)
                return {'success': False, 'message': 'Failed to record file upload after processing resulted in zero chunks.'}
        # else: fallback_created is True and splits now contains one or more LangchainDocument; continue processing

   

    # --- Metadata Preparation ---
    processed_splits = []
    # Ensure knowledge_id is always stored as an integer (if possible)
    try:
        knowledge_id_int = int(knowledge_id) if knowledge_id is not None else None
    except Exception:
        knowledge_id_int = knowledge_id # Keep original if conversion fails
    upload_context_metadata = {
        "source": filename,
        "library_id": library_id,
        "library_name": library_name,
        "knowledge_id": knowledge_id_int
    }
    if source_url:
        upload_context_metadata["source_url"] = source_url

    # Use metadata from the first loaded doc if available, otherwise empty dict
    base_metadata_from_load = {}
    if loaded_docs and hasattr(loaded_docs[0], 'metadata'):
        base_metadata_from_load = loaded_docs[0].metadata

    merged_base_metadata = {**base_metadata_from_load, **upload_context_metadata}

    # --- Add Classified Metadata ---
    try:
        
        base64_image = None
        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext == ".pdf":
            base64_image = Get_image_first_page_base64(file_path)
        
        # Get info about document from the first chunk's content
        if splits and hasattr(splits[0], 'page_content'):
            classified_metadata = {}
            if base64_image:
                # Use multimodal classifier if we have an image (i.e., for PDFs)
                classified_metadata = classify_document_metadata_multimodal(image_base64=base64_image, logger_param=logger)
            else:
                # Otherwise, use the text-based classifier for non-PDFs or if image extraction failed
                classified_metadata = classify_document_metadata(document_content_summary=splits[0].page_content, logger_param=logger)

            if 'error' not in classified_metadata:
                # Update base metadata with classified info
                merged_base_metadata.update(classified_metadata)
                logger.info(f"Successfully added classified metadata: {classified_metadata}")

                # --- Inject Brand/Product Info as a Separate Chunk (if MARKDOWN) ---
                # Check if the required keys exist and have non-empty values
                brand_org = classified_metadata.get("brand_manufacturer_organization")
                product_service = classified_metadata.get("product_model_name_service")

                # deploy for all type of documents
                if  brand_org and product_service:
                    new_content = f"{brand_org}\t{product_service}"
                    # Create a new LangchainDocument instance
                    # Use the correct class: LangchainDocument
                    # Inherit metadata from the base document
                    #new_doc_metadata = merged_base_metadata.copy() # Important: use a copy
                    #new_doc = LangchainDocument(page_content=new_content, metadata=new_doc_metadata)
                    # Append the new document to the splits list
                    #splits.append(new_doc)
                    existing_content = splits[0].page_content
                    splits[0].page_content = new_content + "\n\n" + existing_content
                    logger.info(f"Appended brand/product info as a new chunk: '{new_content}'")                
            else:
                logger.warning(f"Metadata classification failed: {classified_metadata.get('error')}")
        else:
             logger.warning("Cannot classify metadata: No splits or first split has no page_content.")

    except Exception as classify_err:
        logger.error(f"Error during metadata classification or chunk injection: {classify_err}", exc_info=True)
        # Continue processing without the extra chunk if classification fails


    # --- Prepare Final Splits with Metadata ---
    for split_doc in splits:
        if not isinstance(split_doc.metadata, dict):
            split_doc.metadata = {}
        # Ensure metadata from the split itself takes precedence over merged base
        current_metadata = {**merged_base_metadata, **split_doc.metadata}
        current_metadata['source'] = filename # Ensure source is always the filename
        if source_url:
            current_metadata['source_url'] = source_url
              
        #--------------------------------
        # Get Page No
        #---------------------------------
        # case from Azure Doc Intelligence
        # get page_no and save to metadata
        if 'pages' in split_doc.metadata:
            page_no = split_doc.metadata['pages'][0]['pageNumber']
            current_metadata['page_number'] = page_no
        #---------------------------------
        # case from docling
        # get page_no and save to metadata
        if 'dl_meta' in split_doc.metadata:
            try:
                # This structure is typical for PDFs processed by Docling.
                # Other file types like Markdown might not have it.
                doc_item = split_doc.metadata['dl_meta']['doc_items']
                page_no = doc_item[0]['prov'][0]['page_no']
                current_metadata['page_number'] = page_no
            except (KeyError, IndexError, TypeError):
                # Gracefully skip if the expected nested structure is not present.
                logger.debug(f"Could not extract page_no from dl_meta for source {filename}. Structure may differ for this file type.")
                pass
        
        #--- end Page No --
        
        # save docling_json_path here
        if dl_doc_saved and target_json_path_str:
            current_metadata['docling_json_path'] = target_json_path_str
        split_doc.metadata = current_metadata
        processed_splits.append(split_doc)

    # --- Add File Record to DB ---
    is_ocr = IS_PDF_IMAGE_ONLY # Use the flag determined earlier
    # is_az_doci flag is set during loading attempt

    # UploadedFile and LibraryReference are imported at module scope to avoid local/unbound issues.
    embedding_function = None
    # Simplified embedding function retrieval
    try:
        from modules.llm_utils import get_embedding_function
        embedding_function = get_embedding_function()
    except Exception as emb_err:
         logger.error(f"Failed to get embedding function: {emb_err}", exc_info=True)
         return {'success': False, 'message': f"Server configuration error (embedding model): {emb_err}"}


    library_ref_id = None

    try:
        uploaded_file = UploadedFile(
            user_id=user_id,
            original_filename=filename,
            stored_filename=f"{user_id}_{filename}", # Consider a more robust storage naming scheme
            file_size=actual_file_size,
            library_id=library_id,
            knowledge_id=knowledge_id_int, # Use the integer version
            is_ocr=is_ocr,
            is_az_doci=is_az_doci
        )
        db.session.add(uploaded_file)
        db.session.flush()  # To get file_id before commit

        file_id = uploaded_file.file_id
        if not file_id:
            logger.error(f"Failed to store file information in the database for {filename}.")
            db.session.rollback()
            return {'success': False, 'message': 'Failed to store file information.'}

        reference_type = 'url_download' if url_download_id else 'file'
        library_ref = LibraryReference(
            library_id=library_id,
            user_id=user_id,
            reference_type=reference_type,
            source_id=file_id
        )
        db.session.add(library_ref)
        db.session.flush()
        library_ref_id = library_ref.reference_id
        logger.info(f"Added file_id {file_id} to library_id {library_id}")

        # --- Vector Store Processing ---
        # Generate UUID objects for the database PK
        new_uuid_objects = [uuid4() for _ in range(len(processed_splits))]
        # Generate string versions for FAISS IDs and metadata
        new_uuid_strings = [str(u) for u in new_uuid_objects]

        grounding_msg = " (Grounding data saved)" if dl_doc_saved else ""

        # --- Save Document Metadata to Document Table ---
        try:

            # Enrich metadata with catalogs, categories, and groups from knowledge_id
            knowledge_obj = get_knowledge_by_id(knowledge_id_int) if knowledge_id_int else None
            catalogs_ids, catalogs_names = [], []
            category_ids, category_names = [], []
            Groups_ids, Groups_name = [], []
            if knowledge_obj:
                catalogs_ids = [cat.id for cat in getattr(knowledge_obj, "catalogs", [])]
                catalogs_names = [cat.name for cat in getattr(knowledge_obj, "catalogs", [])]
                category_ids = [cat.id for cat in getattr(knowledge_obj, "categories", [])]
                category_names = [cat.name for cat in getattr(knowledge_obj, "categories", [])]
                Groups_ids = [grp.group_id for grp in getattr(knowledge_obj, "groups", [])]
                Groups_name = [grp.name for grp in getattr(knowledge_obj, "groups", [])]

            for idx, item in enumerate(processed_splits):
                # Add enriched metadata to the LangchainDocument object's metadata
                item.metadata["catalogs_ids"] = catalogs_ids
                item.metadata["catalogs_names"] = catalogs_names
                item.metadata["category_ids"] = category_ids
                item.metadata["category_names"] = category_names
                item.metadata["Groups_ids"] = Groups_ids
                item.metadata["Groups_name"] = Groups_name
                 # add doc_id in metadata
                item.metadata['doc_id'] = new_uuid_strings[idx]

                # Extract data needed for the DB Document model
                dl_meta = item.metadata.get("dl_meta") # This might be complex, ensure it's JSON serializable
                content_preview = item.page_content[:700] if hasattr(item, 'page_content') else ''
                json_bin_path = item.metadata.get("docling_json_path")

                # Call add_document to save to the 'documents' table
                add_document(
                    id=new_uuid_objects[idx], # Use the generated UUID
                    source=filename,
                    library_id=library_id,
                    knowledge_id=knowledge_id_int,
                    dl_meta=dl_meta, # Pass the potentially complex metadata
                    content_preview=content_preview,
                    docling_json_path=json_bin_path,
                )

            selected_group_id = Groups_ids[0] if Groups_ids else None
            if enable_visual_grounding and IS_VISUAL_GROUNDING_COMPLETED:
                add_visual_grounding_activities(
                    user_id,
                    file_id,
                    status='completed',
                    group_id=selected_group_id,
                )

            logger.info(f"Saved document metadata to Document table for file: {filename}")
        except Exception as meta_e:
            logger.error(f"Failed to save document metadata for {filename}: {meta_e}", exc_info=True)
            # Decide if this is a critical error - maybe rollback? For now, log and continue.
            db.session.rollback()
            return {'success': False, 'message': f"Failed to save document metadata: {meta_e}"}

        try:
            db.session.commit()
        except Exception as commit_err:
            db.session.rollback()
            logger.error(
                "Failed to commit metadata transaction for %s: %s",
                filename,
                commit_err,
                exc_info=True,
            )
            return {'success': False, 'message': f"Failed to persist document metadata: {commit_err}"}

        # --- Add to Vector Store ---
        chunks_count = 0
        try:
            chunks_count = process_and_store_chunks(
                processed_splits,
                user_id,
                embedding_function,
                logger,
                file_id=file_id,
                url_download_id=url_download_id,
                knowledge_id=knowledge_id_int,
                new_uuid_indexes=new_uuid_strings,
            )
            logger.info("Saved %s document chunks to vector store completed", chunks_count)
        except Exception as vector_e:
            logger.error("Failed to save to Vector store: %s", vector_e, exc_info=True)
            try:
                cleanup_failed_ingestion(
                    file_id=file_id,
                    document_ids=new_uuid_objects,
                    library_reference_id=library_ref_id,
                    url_download_id=url_download_id,
                )
            except Exception as cleanup_err:
                logger.error(
                    "Failed to clean up after vector store error for %s: %s",
                    filename,
                    cleanup_err,
                    exc_info=True,
                )
            return {'success': False, 'message': f"Failed to save document vectors: {vector_e}"}

        return {
            'success': True,
            'message': f"Processed successfully ({chunks_count} chunks){grounding_msg}.",
            'file_id': file_id,
        }

    except Exception as proc_e:
        # Catch any other unexpected errors during the DB/vector store phase
        db.session.rollback()
        logger.error(f"Error during final processing/storage for {filename}: {str(proc_e)}", exc_info=True)
        return {'success': False, 'message': f"Error processing content: {str(proc_e)}"}

# --- Celery Task for Asynchronous Single File Processing ---
from celery_app import celery   # Changed to absolute import
from flask import current_app # To get config within task context
# import os # for getpid # Not strictly needed for this simplified version
from celery_app import celery # We only need the celery app instance now
print(f"[{os.getpid()}] modules.upload_processing.py: Imported celery instance. id(celery): {id(celery)}")
# Note: AppSettings is already imported in this file if needed by task_app_config logic

# Modify your existing task decorator to include base=ContextTask
# For example, if it was:
# @celery.task
# It becomes (combine name and base into one decorator):
@celery.task(name="modules.upload_processing.async_process_single_file", bind=True)
def async_process_single_file(self, temp_file_path_from_route, original_filename, user_id, library_id, library_name, knowledge_id_str, enable_visual_grounding_flag, url_download_id=None, source_url=None, content_type=None):
    """
    Celery task to process a single file upload asynchronously.
    This task runs in the background and calls the main process_uploaded_file function.
    """
    # Use a more specific logger for Celery tasks if desired, or use the default task logger
    task_logger = logging.getLogger(f"celery.task.{self.name}")
    task_logger.info(f"Celery task started for: {original_filename}, temp path: {temp_file_path_from_route}")

    # Update state: Starting
    self.update_state(
        state='PROGRESS',
        meta={'filename': original_filename, 'stage': 'Starting...', 'progress': 0}
    )

    if url_download_id:
        update_url_download(url_download_id, status='processing')

    # Construct app_config for process_uploaded_file
    # This requires running within a Flask app context, which should be configured for the Celery app.
    from flask import current_app
    task_app_config = {
        'DOCLING_EXPORT_TYPE': current_app.config.get('DOCLING_EXPORT_TYPE', 'MARKDOWN'),
        'VISUAL_GROUNDING_DOC_STORE_PATH': current_app.config.get('VISUAL_GROUNDING_DOC_STORE_PATH', 'data/doc_store'),
        'AppSettings': AppSettings, # AppSettings model class
    }

    knowledge_id = int(knowledge_id_str) if knowledge_id_str and knowledge_id_str != 'None' else None

    result = {}
    try:
        # Update state: Processing document
        self.update_state(
            state='PROGRESS',
            meta={'filename': original_filename, 'stage': 'Processing document...', 'progress': 10}
        )

        result = process_uploaded_file(
            file_path=temp_file_path_from_route,
            filename=original_filename,
            user_id=user_id,
            library_id=library_id,
            library_name=library_name,
            knowledge_id=knowledge_id,
            enable_visual_grounding=enable_visual_grounding_flag,
            logger=task_logger, # Pass the task's logger
            app_config=task_app_config,
            current_user=None, # current_user is not available/needed here
            url_download_id=url_download_id,
            source_url=source_url,
        )

        if result.get('success'):
            task_logger.info(f"Async processing successful for {original_filename}: {result.get('message')}")

            # Update state: Completed
            self.update_state(
                state='SUCCESS',
                meta={'filename': original_filename, 'stage': 'Completed', 'progress': 100}
            )

            if url_download_id:
                update_url_download(url_download_id, status='success', content_type=content_type)
        else:
            task_logger.error(f"Async processing failed for {original_filename}: {result.get('message')}")

            # Update state: Failed
            self.update_state(
                state='FAILURE',
                meta={
                    'filename': original_filename,
                    'error': result.get('message', 'Processing failed'),
                    'progress': 0
                }
            )

            if url_download_id:
                update_url_download(url_download_id, status='failed', error_message=result.get('message'))
    except Exception as e:
        task_logger.error(f"Exception in async_process_single_file for {original_filename}: {e}", exc_info=True)
        result = {'success': False, 'message': f"Celery task exception: {str(e)}", 'filename': original_filename}

        # Update state: Failed with exception
        self.update_state(
            state='FAILURE',
            meta={
                'filename': original_filename,
                'error': str(e),
                'progress': 0
            }
        )

        if url_download_id:
            update_url_download(url_download_id, status='failed', error_message=str(e))
    finally:
        # Clean up the temporary file passed from the route
        if temp_file_path_from_route:
            temp_path = Path(temp_file_path_from_route)
            if temp_path.exists():
                try:
                    temp_path.unlink()
                    task_logger.info(f"Celery task removed temp file: {temp_file_path_from_route}")
                except OSError as e_remove:
                    task_logger.error(
                        f"Celery task error removing temp file {temp_file_path_from_route}: {e_remove.strerror}"
                    )
            parent_dir = temp_path.parent
            try:
                if parent_dir.is_dir() and not any(parent_dir.iterdir()):
                    parent_dir.rmdir()
                    task_logger.debug(f"Celery task removed empty temp dir: {parent_dir}")
            except OSError as e_remove_dir:
                task_logger.debug(
                    f"Celery task skipped removing temp dir {parent_dir}: {e_remove_dir.strerror}"
                )

    # TODO: Implement a way to notify the user or update status in DB based on 'result'
    return result
