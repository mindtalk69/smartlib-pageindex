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

                    pages_obj = doc_page_data.get('pages')
                    page_info_obj = None

                    def _matches_page(entry):
                        if not isinstance(entry, dict):
                            return False
                        candidate_keys = ('page_no', 'pageNo', 'page_number', 'pageNumber', 'number', 'index')
                        for key in candidate_keys:
                            if key not in entry:
                                continue
                            value = entry.get(key)
                            if key == 'index' and isinstance(value, int):
                                value = value + 1
                            try:
                                if int(value) == page_no_1_indexed:
                                    return True
                            except (TypeError, ValueError):
                                continue
                        entry_id = entry.get('id') or entry.get('self_ref') or entry.get('ref')
                        if isinstance(entry_id, str):
                            match = re.search(r'(\d+)$', entry_id)
                            if match and int(match.group(1)) == page_no_1_indexed:
                                return True
                        return False

                    if isinstance(pages_obj, dict):
                        page_info_obj = pages_obj.get(str(page_no_1_indexed)) or pages_obj.get(page_no_1_indexed)
                    elif isinstance(pages_obj, list):
                        for entry in pages_obj:
                            if _matches_page(entry):
                                page_info_obj = entry
                                break

                    if isinstance(page_info_obj, dict):
                        size_obj = page_info_obj.get('size') if isinstance(page_info_obj.get('size'), dict) else None
                        if size_obj:
                            page_height = size_obj.get('height')
                        if page_height is None:
                            page_height = (
                                page_info_obj.get('height')
                                or page_info_obj.get('page_height')
                            )
                        if page_height is None and isinstance(page_info_obj.get('image'), dict):
                            page_height = page_info_obj['image'].get('height')
                        if page_height is not None:
                            try:
                                page_height = float(page_height)
                                logging.info(
                                    "[EvidenceUtils] Fetched page_height: %s for page '%s' from %s",
                                    page_height,
                                    page_no_1_indexed,
                                    db_chunk_row.docling_json_path,
                                )
                            except (TypeError, ValueError):
                                logging.warning(
                                    "[EvidenceUtils] Page height value %s for page '%s' in %s is not numeric.",
                                    page_height,
                                    page_no_1_indexed,
                                    db_chunk_row.docling_json_path,
                                )
                                page_height = None
                        else:
                            logging.warning(
                                "[EvidenceUtils] Could not locate page size for page '%s' in %s.",
                                page_no_1_indexed,
                                db_chunk_row.docling_json_path,
                            )
                    else:
                        logging.warning(
                            "[EvidenceUtils] Page data for page '%s' not found in %s (pages_obj type: %s).",
                            page_no_1_indexed,
                            db_chunk_row.docling_json_path,
                            type(pages_obj).__name__,
                        )
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