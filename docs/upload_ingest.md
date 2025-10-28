
# Document Upload & Ingestion Process in SmartLib

## Overview

SmartLib uses a sophisticated document processing pipeline that integrates docling for document conversion and chunking, Azure Document Intelligence for OCR, and a vector store (Chroma) for efficient retrieval. The system supports various upload methods and has an adaptable architecture that can operate in different vector store modes.

## Upload Methods

The application offers three main methods for adding documents:

1. **File Upload (Batch Upload)**:
   - Allows uploading multiple files simultaneously
   - Supports various document formats: PDF, DOCX, XLSX, PPTX, MD, HTML, CSV, PNG, JPEG, and more
   - Files are processed individually and added to the selected library/knowledge base
   - Optional visual grounding can be enabled during upload (admin only)

2. **URL Download**:
   - Allows downloading content from URLs
   - System validates URLs for accessibility
   - Content is processed similarly to file uploads
   - URLs are downloaded, their content extracted, and then processed through the pipeline

3. **Admin Folder Upload** (Admin feature):
   - Allows administrators to upload entire folders with recursive support
   - Supports scheduled background processing using Celery and RabbitMQ
   - Provides job monitoring and management capabilities

## Processing Pipeline

When documents are uploaded, they go through the following pipeline:

1. **Document Conversion (Docling)**:
   ```python
   from docling.datamodel.base_models import InputFormat
   from docling.datamodel.pipeline_options import PdfPipelineOptions
   from docling.document_converter import DocumentConverter, PdfFormatOption
   
   converter = DocumentConverter(
       format_options={
           InputFormat.PDF: PdfFormatOption(
               pipeline_options=PdfPipelineOptions(
                   generate_page_images=True,
                   images_scale=2.0,
               ),
           )
       }
   )
   ```

   - Docling converts documents to a structured format
   - For PDFs, it can optionally generate page images for visual grounding
   - The converter handles different document formats appropriately

2. **Document Store Creation**:
   ```python
   doc_store = {}
   doc_store_root = Path(mkdtemp())
   for source in SOURCES:
       dl_doc = converter.convert(source=source).document
       file_path = Path(doc_store_root / f"{dl_doc.origin.binary_hash}.json")
       dl_doc.save_as_json(file_path)
       doc_store[dl_doc.origin.binary_hash] = file_path
   ```

   - Converted documents are saved as JSON with a unique hash
   - This enables later visual evidence/grounding features

3. **Document Loading & Chunking**:
   ```python
   from langchain_docling import DoclingLoader
   from docling.chunking import HybridChunker
   
   loader = DoclingLoader(
       file_path=SOURCES,
       converter=converter,
       export_type=ExportType.DOC_CHUNKS,
       chunker=HybridChunker(tokenizer=EMBED_MODEL_ID),
   )
   
   docs = loader.load()
   ```

   - Documents are loaded into the langchain ecosystem using DoclingLoader
   - HybridChunker breaks documents into semantic chunks for better retrieval
   - The chunker ensures document chunks maintain semantic coherence

4. **Vector Store Processing**:
   - Chunks are encoded using the embedding model (usually MiniLM-L6-v2)
   - Vectors are stored in a FAISS index (in user mode) or in Chroma (knowledge/global mode)
   - Metadata is enriched with additional information like library, knowledge base, and grounding data

5. **Optional OCR Processing**:
   - For image-only PDFs, Azure Document Intelligence can be used for OCR
   - This is an admin-configurable option that can be enabled globally

6. **Optional Visual Grounding**:
   - If enabled, docling generates bounding boxes for text regions
   - Visual grounding data is stored along with document metadata
   - This enables highlighting text evidence in the original document during retrieval

## Vector Store Modes

The application supports three different vector store modes that affect how documents are organized and retrieved:

1. **User Mode** (Default):
   - Each user has their own isolated vector store
   - Documents are only accessible to the user who uploaded them
   - Best for privacy-focused deployments
   - Implementation: `faiss_indexes/{user_id}/stores/`

2. **Global Mode**:
   - All documents share a centralized vector store
   - Documents are accessible to all users
   - Best for organization-wide knowledge sharing
   - Implementation: Single Chroma or FAISS store accessed by all users

3. **Knowledge Mode**:
   - Vector stores are organized by knowledge bases/groups
   - Documents are grouped by topic or department
   - Best for team or department-based deployments
   - Implementation: `faiss_indexes/{knowledge_id}/stores/`

## Recent Improvements

According to the RAG improvement plan documents:

1. **Vector Store Optimization**:
   - The system now uses Langchain's `FAISS.save_local`/`load_local` to persist and load the full vector store
   - This eliminates the inefficient rebuilding of the vector store on every query
   - Implementation: `faiss_indexes/{user_id}/stores/`

2. **Metadata Enrichment**:
   ```json
   {
     "schema_name": "docling_core.transforms.chunker.DocMeta",
     "version": "1.0.0",
     "doc_items": [
       {
         "self_ref": "#/texts/1",
         "prov": [
           {
             "page_no": 1,
             "bbox": { "l": 39.3, "t": 140.6, "r": 559.0, "b": 85.6, "coord_origin": "BOTTOMLEFT" },
             "charspan": [0, 380]
           }
         ]
       }
     ],
     "origin": {
       "mimetype": "application/pdf",
       "binary_hash": 6399133110736973633,
       "filename": "MAP FOLDER-01.pdf"
     }
   }
   ```
   
   - Each chunk is now enriched with additional metadata
   - This includes library, knowledge, category, catalog, and docling metadata
   - Enables more precise filtering and better visual grounding

3. **Retrieval Enhancements**:
   - MMR (Maximum Marginal Relevance) can be used for more diverse search results
   - Implemented as `search_type="mmr"` in the retriever configuration
   - Adjustable `k` parameter for controlling the number of retrieved documents

## Code Flow for Document Upload

1. **User Selects Library/Knowledge**:
   - The UI shows available libraries based on user permissions and vector store mode
   - In knowledge mode, users select both a knowledge base and library
   - This selection determines where the document will be stored

2. **File Upload Process**:
   - Files are selected via the web UI
   - Frontend JavaScript sends files to the `/upload` endpoint
   - Optional parameters like visual grounding are included

3. **Backend Processing (`modules/upload.py`)**:
   - Files are received and validated
   - The `process_files` function handles the main processing
   - Docling converter is configured based on file type and options
   - Visual grounding is applied if enabled
   - Document is converted, chunked, and added to the vector store

4. **Vector Store Update**:
   - The vector store is updated with the new document chunks
   - In user mode: `FAISS.save_local(folder_path=f'faiss_indexes/{user_id}/stores/')`
   - In knowledge mode: Store is organized by knowledge base
   - In global mode: Added to the central store

5. **Status Reporting**:
   - Progress and results are reported back to the UI
   - Successful uploads show in the user's library

## Technical Implementation Notes

1. **Database Schema**:
   - Documents are tracked in multiple tables:
     - `uploaded_files` - Basic file metadata
     - `libraries` - Document organization units
     - `knowledges` - Higher-level organization (contains libraries)
     - `vector_references` - Links to vector embeddings

2. **Vector Storage Options**:
   - SQLite in development with fallback types
   - PostgreSQL in production with native vector types via `pgvector`
   - Conditional code paths handle both backends

3. **Visual Grounding Implementation**:
   ```python
   for doc_item in meta.doc_items:
       if doc_item.prov:
           prov = doc_item.prov[0]  # first provenance item
           page_no = prov.page_no
           page = dl_doc.pages[prov.page_no]
           img = page.image.pil_image
           bbox = prov.bbox.to_top_left_origin(page_height=page.size.height)
           # Draw bounding box on image
   ```
   
   - Visual grounding links text to specific regions in document pages
   - Bounding box coordinates are stored and used for visualization
   - Frontend can display highlighted evidence in the original document

## Integration with Chat Interface

Once documents are uploaded and indexed, they become available through:

1. **Library Selection Dropdown**:
   - Users can select specific libraries to search in
   - This filters which documents are considered during retrieval

2. **Knowledge Base Selection** (in knowledge mode):
   - Users can select specific knowledge bases
   - This further filters the document scope

3. **Citations in Chat Responses**:
   - When the system answers a query, it provides citations to source documents
   - Citations can include visual evidence if grounding was enabled
   - Clicking on citations shows the original text or displays visual evidence

This integration creates a complete RAG (Retrieval-Augmented Generation) pipeline from document upload to chat response with evidence.

## Summary

SmartLib's document upload and ingestion process is a comprehensive pipeline that:

1. Handles multiple file formats and upload methods
2. Processes documents using docling for conversion and chunking
3. Supports optional features like visual grounding and OCR
4. Organizes documents in different vector store modes for flexibility
5. Enriches documents with metadata for better retrieval
6. Integrates seamlessly with the chat interface for evidence-based responses

This system combines document understanding, vector search, and LLM capabilities to create an effective knowledge retrieval system.