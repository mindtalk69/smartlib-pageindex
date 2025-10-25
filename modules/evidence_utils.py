from modules.database import get_document_for_citations
from uuid import UUID
import json
from typing import Optional, Tuple
import logging

# Cache for (raw_bbox_obj, page_height) to avoid repeated DB/file access
_visual_info_cache = {}

def get_visual_info_for_chunk(chunk_id_str: str, page_no_1_indexed: int):
    """
    Fetches the raw bbox object from the chunk's specific dl_meta and its page height.
    Returns (raw_bbox_object, page_height) or (None, None) if not found.
    raw_bbox_object is like {"l": ..., "t": ..., "r": ..., "b": ...}
    """
    logging.debug(f"[EvidenceUtils] Called with chunk_id_str='{chunk_id_str}', page_no_1_indexed={page_no_1_indexed}")
    
    if not chunk_id_str or page_no_1_indexed is None:
        logging.debug("[EvidenceUtils] Returning early due to missing chunk_id_str or page_no_1_indexed.")
        return None, None

    # Cache key based on chunk_id and page_no
    cache_key = (chunk_id_str, page_no_1_indexed)
    if cache_key in _visual_info_cache:
        logging.debug(f"[EvidenceUtils] Returning cached info for {cache_key}")
        return _visual_info_cache[cache_key]

    raw_bbox_obj = None
    page_height = None

    try:
        chunk_id_uuid = UUID(chunk_id_str)
        # get_document_for_citations should fetch the row for this specific chunk_id
        db_chunk_row = get_document_for_citations(chunk_id_uuid) 
        
        if db_chunk_row:
            # 1. Get page height from the docling_json_path (path to original document's page info)
            if db_chunk_row.docling_json_path:
                try:
                    with open(db_chunk_row.docling_json_path, 'r') as f:
                        doc_page_data = json.load(f)

                    # Expect "pages" to be an object/dictionary keyed by page number (as string)
                    if 'pages' in doc_page_data and isinstance(doc_page_data['pages'], dict):
                        pages_dict = doc_page_data['pages']
                        page_key_str = str(page_no_1_indexed) # Page numbers are keys as strings

                        if page_key_str in pages_dict:
                            page_info_obj = pages_dict[page_key_str]
                            if isinstance(page_info_obj, dict) and 'size' in page_info_obj and isinstance(page_info_obj['size'], dict):
                                page_height = page_info_obj['size'].get('height')
                                logging.info(f"[EvidenceUtils] Fetched page_height: {page_height} for page '{page_key_str}' from {db_chunk_row.docling_json_path}")
                            else:
                                logging.warning(f"[EvidenceUtils] Page object for page '{page_key_str}' in {db_chunk_row.docling_json_path} is malformed or missing 'size' object with 'height'.")
                        else:
                            logging.warning(f"[EvidenceUtils] Page key '{page_key_str}' (for page_no_1_indexed: {page_no_1_indexed}) not found in 'pages' object in {db_chunk_row.docling_json_path}. Available page keys: {list(pages_dict.keys())}. No page_height set.")
                    else:
                        logging.warning(f"[EvidenceUtils] 'pages' key in {db_chunk_row.docling_json_path} is missing or not an object/dictionary. No page_height set.")
                except Exception as e_json:
                    logging.error(f"[EvidenceUtils] Error reading/parsing {db_chunk_row.docling_json_path}: {e_json}", exc_info=True)
            
            # 2. Get bbox from the chunk-specific dl_meta
            chunk_dl_meta = db_chunk_row.dl_meta
            if chunk_dl_meta and isinstance(chunk_dl_meta, dict) and \
               chunk_dl_meta.get('doc_items') and isinstance(chunk_dl_meta['doc_items'], list) and \
               len(chunk_dl_meta['doc_items']) > 0:
                first_item = chunk_dl_meta['doc_items'][0]
                if first_item.get('prov') and isinstance(first_item['prov'], list) and len(first_item['prov']) > 0:
                    first_prov = first_item['prov'][0]
                    # Verify page number if needed, though it should match page_no_1_indexed for this chunk
                    if first_prov.get('page_no') == page_no_1_indexed:
                        raw_bbox_obj = first_prov.get('bbox')
                        logging.info(f"[EvidenceUtils] Extracted raw_bbox_obj: {raw_bbox_obj} from chunk's dl_meta for chunk_id {chunk_id_str}")
                    else:
                        logging.warning(f"[EvidenceUtils] Page number mismatch in chunk's dl_meta. Expected {page_no_1_indexed}, got {first_prov.get('page_no')}")
        else:
            logging.warning(f"[EvidenceUtils] Chunk row not found in DB for chunk_id {chunk_id_uuid}")
    except Exception as e:
        logging.error(f"Error in _get_visual_info_for_chunk for {cache_key}: {e}", exc_info=True)

    _visual_info_cache[cache_key] = (raw_bbox_obj, page_height)
    return raw_bbox_obj, page_height