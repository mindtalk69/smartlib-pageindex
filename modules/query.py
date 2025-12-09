# query.py

import os, logging
import io  # For image buffer
import json  # For parsing bbox
import asyncio
import inspect
import importlib
from functools import lru_cache
from lark.exceptions import UnexpectedCharacters, UnexpectedToken
from extensions import db

from pathlib import Path # Added for path checking
from PIL import Image, ImageDraw, ImageStat # For drawing bounding boxes and analyzing image stats

from flask import request, jsonify, flash, redirect, url_for, current_app, session, send_file, Response, stream_with_context # Added Response back
from extensions import csrf
# from starlette.responses import StreamingResponse # Remove Starlette's StreamingResponse
from flask_login import login_required, current_user
from uuid import uuid4 # For generating conversation_id if not provided
from modules.database import add_message, get_library_with_details, Knowledge, MessageHistory
from modules.database import Document as DB_Document
from langchain_core.messages import HumanMessage, AIMessage # <-- Import the agentic workflow
from modules.llm_utils import get_active_prompt_content, get_active_language_name, get_llm # Added get_llm
# from modules.agent import invoke_agent_graph  # <-- MOVED TO WORKER ONLY
from modules.celery_tasks import invoke_agent_via_worker, resume_agent_via_worker, wake_worker
from modules.access_control import (
    filter_accessible_knowledges,
    get_user_group_ids,
    knowledge_is_accessible,
)
from werkzeug.exceptions import BadRequest, Unauthorized, InternalServerError # Import exceptions
from typing import Any, Dict, List, Optional
logging.basicConfig(level=logging.INFO)

THRESHOLD_CLIPPING = 200 # Character limit for text clipping
def clip_text(text, threshold=THRESHOLD_CLIPPING):
    return f"{text[:threshold]}..." if len(text) > threshold else text


@lru_cache(maxsize=1)
def _resolve_docling_document_cls():
    for module_path in (
        "docling_core.types.doc.document",
        "docling.datamodel.document",
    ):
        try:
            module = importlib.import_module(module_path)
            doc_cls = getattr(module, "DoclingDocument", None)
            if doc_cls is not None:
                return doc_cls
        except ImportError:
            continue
    raise RuntimeError(
        "DoclingDocument is unavailable. Install docling-core (or docling) in the web environment to enable visual evidence previews."
    )


def _load_docling_document(json_path: Path):
    DoclingDocument = _resolve_docling_document_cls()
    return DoclingDocument.load_from_json(json_path)


def _fetch_document_record(document_id_str: str):
    """Resolve a Document row regardless of UUID string formatting."""
    import uuid

    try:
        doc_uuid = uuid.UUID(document_id_str)
    except (ValueError, TypeError):
        return None

    candidates = []
    for candidate in (doc_uuid, doc_uuid.hex, document_id_str.replace('-', '')):
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    for candidate in candidates:
        try:
            record = db.session.get(DB_Document, candidate)
        except Exception:
            record = None
        if record is not None:
            return record

    string_candidates = [candidate for candidate in candidates if isinstance(candidate, str)]
    if string_candidates:
        return DB_Document.query.filter(DB_Document.id.in_(string_candidates)).first()

    return None

# --- Helper generators for streaming responses ---
def _stream_cancellation_event_for_resume():
    """Generator that yields a cancellation SSE payload for resume endpoints."""
    yield f"data: {json.dumps({'type': 'cancellation', 'status': 'cancelled', 'message': 'Action not performed by user choice.'})}\n\n"


def is_uncertain_response(response):
    """Check if response indicates uncertainty"""
    uncertainty_phrases = [
        "i don't know",
        "i do not know", 
        "no information available",
        "information not found",
        "unable to answer",
        "cannot answer",
        "Saya tidak tahu.",
    ]
    response_lower = response.lower()
    is_uncertain = any(phrase in response_lower for phrase in uncertainty_phrases)
    if is_uncertain:
        logging.info(f"Response detected as uncertain: '{response[:100]}...'")
        matching_phrases = [phrase for phrase in uncertainty_phrases if phrase in response_lower]
        logging.info(f"Matching uncertainty phrases: {matching_phrases}")
    return is_uncertain

def generate_follow_up_questions(query_text, answer_text, context_docs, chat_history):
    """Generate follow-up questions based on the conversation context and answer."""
    try:
        from modules.llm_utils import get_llm
        llm_instance = get_llm()
        logging.info(f"Calling LLM to generate follow-up questions for: {query_text}")
        language = get_active_language_name()
        followup_prompt_content = get_active_prompt_content(
            "followup_question",
            fallback=None
        )
        if followup_prompt_content:
            try:
                system_prompt = followup_prompt_content.format(language=language)
            except Exception as e:
                current_app.logger.warning(f"Failed to format followup_question prompt from llm_prompts, using fallback. Error: {e}")
                system_prompt = (
                    f"You are a helpful assistant that generates follow-up questions based on a conversation.\n\n"
                    f"Your task is to generate 3 relevant follow-up questions that the user might want to ask next.\n"
                    f"The questions should be diverse, interesting, and help the user explore the topic further.\n\n"
                    f"IMPORTANT: Return ONLY the questions in a valid JSON array format like this:\n"
                    f'["Question 1?", "Question 2?", "Question 3?"]\n\n'
                    f"Do not include any explanations, introductions, or additional text outside the JSON array.\n"
                    f"Please generate the questions in {language}."
                )
        else:
            system_prompt = (
                f"You are a helpful assistant that generates follow-up questions based on a conversation.\n\n"
                f"Your task is to generate 3 relevant follow-up questions that the user might want to ask next.\n"
                f"The questions should be diverse, interesting, and help the user explore the topic further.\n\n"
                f"IMPORTANT: Return ONLY the questions in a valid JSON array format like this:\n"
                f'["Question 1?", "Question 2?", "Question 3?"]\n\n'
                f"Do not include any explanations, introductions, or additional text outside the JSON array.\n"
                f"Please generate the questions in {language}."
            )

        user_prompt = (
            f"User's question: {query_text}\n\n"
            f"Answer provided: {answer_text}\n\n"
            f"Context information: {str(context_docs)[:1000]}\n\n"
            f"Previous conversation: {str(chat_history)[:1000]}\n\n"
            f"Generate 3 follow-up questions in {language}:"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = llm_instance.invoke(messages)
        response_text = response.content
        logging.info(f"Raw LLM response for follow-up questions: {response_text}")

        try:
            import json
            if not response_text.strip().startswith('['):
                import re
                json_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)
                    logging.info(f"Extracted JSON array from response: {response_text}")
            questions = json.loads(response_text)
            if isinstance(questions, list):
                questions = [str(q) for q in questions if q]
                questions = [q if q.endswith('?') else f"{q}?" for q in questions]
                logging.info(f"Successfully parsed JSON questions: {questions[:3]}")
                return questions[:3]
        except Exception as json_error:
            logging.warning(f"Failed to parse JSON from LLM response: {json_error}")

        questions = []
        for line in response_text.split('\n'):
            line = line.strip()
            if line and (line.endswith('?') or line.startswith('- ') or line.startswith('"') or line.startswith("'")):
                clean_line = line.lstrip('0123456789.- \"\"').rstrip("'\"").strip()
                if clean_line and clean_line not in questions:
                    if not clean_line.endswith('?'):
                        clean_line += '?'
                    questions.append(clean_line)
                    if len(questions) >= 3:
                        break

        logging.info(f"Extracted questions using line-by-line method: {questions}")
        return questions
    except Exception as e:
        logging.warning(f"Error generating follow-up questions: {e}", exc_info=True)
        return []


def _update_message_history_entry(message_id: Optional[int], result: Dict[str, Any]) -> None:
    if not message_id or not isinstance(result, dict):
        return

    try:
        message_obj = db.session.get(MessageHistory, message_id)
    except AttributeError:
        message_obj = MessageHistory.query.filter_by(message_id=message_id).first()

    if not message_obj:
        logging.warning("MessageHistory entry %s not found for update", message_id)
        return

    answer = result.get("answer")
    if answer is not None:
        message_obj.answer = answer

    message_obj.citations = json.dumps(result.get("citations", []))
    message_obj.usage_metadata = json.dumps(result.get("usage_metadata", {}))
    message_obj.suggested_questions = json.dumps(result.get("suggested_questions", []))
    message_obj.structured_query = result.get("structured_query")

    try:
        db.session.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logging.error("Failed to update MessageHistory %s: %s", message_id, exc)
        db.session.rollback()


def init_query(app):

    
    @csrf.exempt
    @app.route('/api/query', methods=['GET', 'POST'])
    def api_query():
        # --- DEBUG LOG ---
        logging.info(f"Received request for /api/query. Raw data: {request.data}")
        # --- END DEBUG LOG ---
        logging.info("DEBUG: /api/query endpoint called")
        
        api_key = request.headers.get('X-API-KEY') or request.args.get('api_key')
        expected_api_key = current_app.config.get('API_KEY')

        authenticated = False
        if expected_api_key:
            if api_key and api_key == expected_api_key:
                authenticated = True
                logging.debug("Authenticated via API Key.")
            elif api_key:                
                logging.error(f"Invalid API key provided.")
                raise Unauthorized("Invalid API key")
            else:
                if current_user.is_authenticated:
                    authenticated = True
                    logging.debug("Authenticated via User Session (API Key not provided).")
                else:
                    logging.error("Authentication failed: API Key configured but not provided, and user not logged in.")
                    raise Unauthorized("Authentication required")
        else:
            if current_user.is_authenticated:
                authenticated = True
                logging.debug("Authenticated via User Session (API Key not configured).")
            else:
                logging.error("Authentication failed: API Key not configured and user not logged in.")
                raise InternalServerError("Internal server error during authentication")

        if not authenticated:
            logging.error("Internal authentication logic error.")
            raise InternalServerError("Internal server error during authentication")
        
        # --- FIX: Always expect JSON body for POST, get data first ---
        data = request.get_json()
        if not data:
            logging.error("Failed to parse JSON or empty request body received.")
            # For early errors like this before streaming logic, raising an HTTP exception is cleaner
            raise BadRequest("Missing JSON request body")
        
        # --- DEBUG LOG ---
        logging.info(f"Parsed JSON data: {data}")
        # --- END DEBUG LOG ---

        # --- Conversation ID Management ---
        conversation_id = data.get('conversation_id')
        new_conversation_id_generated = False
        if not conversation_id:
            conversation_id = str(uuid4())
            new_conversation_id_generated = True
            logging.info(f"No conversation_id provided by client, generated new one: {conversation_id}")
        else:
            logging.info(f"Using conversation_id from client: {conversation_id}")
        
        # --- Get parameters from the parsed JSON data ---
        query_text = data.get('query')
        thread_id = data.get('thread_id') # Get thread_id if sent
        stream_flag = (
            data.get("stream", False) # Get stream flag from JSON
            # Also check args/headers for backward compatibility or alternative methods if needed
            or request.args.get("stream", "false").lower() == "true"
            or request.headers.get("X-Stream-Answers", "false").lower() == "true"
        )
        library_id_filter = data.get('library_id') # Get filters from JSON
        knowledge_id_filter = data.get('knowledge_id')
        category_id_filter = data.get('category_id') # Assuming you might add this later
        image_base64 = data.get('image_base64') # New: Get image data
        image_mime_type = data.get('image_mime_type') # New: Get image MIME type

        # Image persistence via server-side files
        if image_base64:
            import base64
            image_folder = Path(current_app.instance_path) / 'session_images'
            image_folder.mkdir(parents=True, exist_ok=True)
            image_data = base64.b64decode(image_base64)
            image_path = image_folder / f"{conversation_id}.img"
            with open(image_path, 'wb') as _f:
                _f.write(image_data)
            # Persist file path and mime in session when available (keeps compatibility with web UI sessions)
            try:
                session[f"{conversation_id}_image_path"] = str(image_path)
                session[f"{conversation_id}_image_mime_type"] = image_mime_type
            except Exception:
                # Session may not be available for some API clients; still file is written and will be used as fallback
                logging.debug("Session unavailable while saving image path; using file fallback only.")
        else:
            # First try: read path stored in the user's session (web UI flows)
            image_path_str = session.get(f"{conversation_id}_image_path") if session is not None else None
            saved_mime = session.get(f"{conversation_id}_image_mime_type") if session is not None else None

            # Fallback: if session doesn't have it (API clients that don't preserve cookies),
            # try the file written to instance/session_images/<conversation_id>.img
            if not image_path_str:
                image_folder = Path(current_app.instance_path) / 'session_images'
                fallback_path = image_folder / f"{conversation_id}.img"
                if fallback_path.exists():
                    image_path_str = str(fallback_path)
                    # If we don't have saved mime from session, attempt a reasonable default
                    saved_mime = saved_mime or image_mime_type or "image/png"

            if image_path_str and os.path.exists(image_path_str) and saved_mime:
                with open(image_path_str, 'rb') as _f:
                    _data_bytes = _f.read()
                import base64
                image_base64 = base64.b64encode(_data_bytes).decode('utf-8')
                image_mime_type = saved_mime
        # New: Get uploaded file/clipboard data
        uploaded_file_content = data.get('uploaded_file_content')
        uploaded_file_type = data.get('uploaded_file_type') # e.g., "csv", "excel_base64"
        uploaded_file_name = data.get('uploaded_file_name')
        clipboard_data_tsv = data.get('clipboard_data_tsv')
        # Get search strategy - support both new 'search_strategy' field and legacy 'mmr' boolean
        search_strategy = data.get('search_strategy')
        if search_strategy is None:
            # Check for legacy 'mmr' boolean field
            mmr_legacy = data.get('mmr')
            if mmr_legacy is not None:
                search_strategy = 'mmr' if mmr_legacy else 'similarity'
            else:
                search_strategy = current_app.config.get('DEFAULT_SEARCH_STRATEGY', 'mmr')  # Configurable default
        search_strategy = search_strategy.lower()
        if not query_text:
            logging.error("No 'query' field found in parsed JSON data.") # Updated log message
            from werkzeug.exceptions import BadRequest
            raise BadRequest("Please enter a query.")

        # --- Load Chat History from Database (Token-Aware) ---
        # If clipboard data is present, prioritize it or handle accordingly
        if clipboard_data_tsv and not uploaded_file_content:
            uploaded_file_content = clipboard_data_tsv
            uploaded_file_type = "tsv"
            logging.info("Processing data from clipboard (assumed TSV).")
        
        # --- DB Operations for Streaming: Create placeholder AI message ---
        db_message_id_for_stream = None
        if stream_flag:
            try:
                placeholder_ai_msg = MessageHistory(
                    user_id=current_user.user_id,
                    thread_id=conversation_id, # Use conversation_id which is guaranteed
                    # Ensure message_text is not None
                    message_text=query_text if query_text else "[User query for streaming response]", 
                    answer="[Streaming...]",
                )
                db.session.add(placeholder_ai_msg)
                db.session.flush() # Get the auto-generated message_id
                db_message_id_for_stream = placeholder_ai_msg.message_id
                # Corrected log to use conversation_id for clarity, matching what's saved to DB
                logging.info(f"[API Query Stream] Created placeholder AI DB message with message_id: {db_message_id_for_stream} for DB thread_id (using conversation_id): {conversation_id}")
            except Exception as e_db_ph:
                logging.error(f"Error creating placeholder DB message for streaming: {e_db_ph}", exc_info=True)

        from modules.database import get_user_messages_serialized
        import tiktoken
        MODEL_CONTEXT_WINDOW = 4096
        HISTORY_TOKEN_BUDGET = 3000
        encoding = tiktoken.get_encoding("cl100k_base")
        def count_message_tokens(msg):
            return len(encoding.encode(msg.content))
        raw_history = get_user_messages_serialized(current_user.user_id, limit=30, thread_id=thread_id)  # Get more, will trim by tokens
        chat_history_messages = []
        total_tokens = 0
        omitted_count = 0
        for msg in reversed(raw_history):
            if msg.get("role") == "user" and msg.get("message"):
                m = HumanMessage(content=msg["message"])
            elif msg.get("role") == "agent" and msg.get("message"):
                m = AIMessage(content=msg["message"])
            else:
                continue
            msg_tokens = count_message_tokens(m)
            if total_tokens + msg_tokens > HISTORY_TOKEN_BUDGET:
                omitted_count += 1
                continue
            chat_history_messages.insert(0, m)
            total_tokens += msg_tokens
        if omitted_count > 0:
            summary_msg = HumanMessage(content=f"[Summary of previous {omitted_count} messages omitted for token limit.]")
            chat_history_messages.insert(0, summary_msg)
        logging.debug(f"Loaded token-limited chat history from DB: {chat_history_messages} (total tokens: {total_tokens})")

        # --- Build vector store config for agentic workflow (with access control) ---
        vector_store_mode = current_app.config.get('VECTOR_STORE_MODE', 'user')
        enforce_group_permissions = vector_store_mode != 'user'
        user_group_ids = get_user_group_ids(current_user.user_id)

        def _is_empty(value) -> bool:
            return value in (None, "", "null")

        library_obj = None
        library_id_int = None
        library_knowledges: List[Knowledge] = []
        accessible_library_knowledges: List[Knowledge] = []

        if not _is_empty(library_id_filter):
            try:
                library_id_int = int(library_id_filter)
            except (TypeError, ValueError):
                raise BadRequest("Invalid library selected.")
            library_id_filter = library_id_int
            library_obj = get_library_with_details(library_id_int)
            if library_obj is None:
                raise BadRequest("Selected library does not exist.")
            library_knowledges = list(getattr(library_obj, 'knowledges', []) or [])
            if enforce_group_permissions:
                accessible_library_knowledges = filter_accessible_knowledges(
                    library_knowledges,
                    user_group_ids,
                )
            else:
                accessible_library_knowledges = library_knowledges
            if (
                enforce_group_permissions
                and library_knowledges
                and not accessible_library_knowledges
            ):
                return jsonify({'error': 'You do not have permission to query the selected library.'}), 403
        else:
            library_id_filter = None

        knowledge_id_int = None
        if vector_store_mode == 'user':
            knowledge_id_filter = None
        elif not _is_empty(knowledge_id_filter):
            try:
                knowledge_id_int = int(knowledge_id_filter)
            except (TypeError, ValueError):
                raise BadRequest("Invalid knowledge base selected.")
            knowledge_obj = db.session.get(Knowledge, knowledge_id_int)
            if knowledge_obj is None:
                raise BadRequest("Selected knowledge does not exist.")
            if enforce_group_permissions and not knowledge_is_accessible(knowledge_obj, user_group_ids):
                return jsonify({'error': 'You do not have permission to query the selected knowledge base.'}), 403
            if library_obj:
                linked_ids = {kn.id for kn in library_knowledges}
                if knowledge_id_int not in linked_ids:
                    return jsonify({'error': 'Selected knowledge is not linked to the chosen library.'}), 400
        else:
            if vector_store_mode == 'knowledge':
                candidate_knowledges = accessible_library_knowledges
                if not candidate_knowledges:
                    if library_obj and enforce_group_permissions:
                        return jsonify({'error': 'You do not have permission to query the selected library.'}), 403
                    candidate_knowledges = filter_accessible_knowledges(
                        Knowledge.query.all(),
                        user_group_ids,
                    ) if enforce_group_permissions else list(Knowledge.query.all())
                if enforce_group_permissions and not candidate_knowledges:
                    return jsonify({'error': 'No accessible knowledge bases available for querying.'}), 403
                if candidate_knowledges:
                    knowledge_id_int = candidate_knowledges[0].id
            elif (
                enforce_group_permissions
                and library_obj
                and accessible_library_knowledges
            ):
                knowledge_id_int = accessible_library_knowledges[0].id
        knowledge_id_filter = knowledge_id_int

        if category_id_filter in ("", "null"):
            category_id_filter = None

        vector_store_config = {
            "mode": vector_store_mode,
            "backend": current_app.config.get('VECTOR_STORE_PROVIDER', 'chromadb'),
            "user_id": current_user.get_id(),
            "knowledge_id": knowledge_id_filter,
            "library_id": library_id_filter,
            "category_id": category_id_filter,
            "search_strategy": search_strategy,
        }

        # --- Call the agentic workflow ---
        extra_kwargs: Dict[str, Any] = {}
        if stream_flag and db_message_id_for_stream:
            extra_kwargs["db_message_id_for_stream"] = db_message_id_for_stream
            extra_kwargs["user_id_for_stream"] = current_user.get_id()

        # Wake worker before ChromaDB queries to handle Azure App Service cold starts
        # This ensures the worker is active and can access the shared Azure Files mount
        if vector_store_config.get("backend") == "chromadb":
            wake_worker(timeout=5.0)  # Quick ping, don't block long

        task_timeout = current_app.config.get('AGENT_TASK_TIMEOUT', 120)

        agent_common_kwargs = {
            "query": query_text,
            "chat_history": chat_history_messages,
            "vector_store_config": vector_store_config,
            "image_base64": image_base64,
            "image_mime_type": image_mime_type,
            "uploaded_file_content": uploaded_file_content,
            "uploaded_file_type": uploaded_file_type,
            "uploaded_file_name": uploaded_file_name,
            "conversation_id": conversation_id,
        }

        if stream_flag:
            def _update_placeholder_with_error(error_text: str) -> None:
                if not db_message_id_for_stream:
                    return
                _update_message_history_entry(
                    db_message_id_for_stream,
                    {
                        "answer": error_text,
                        "citations": [],
                        "usage_metadata": {},
                        "suggested_questions": [],
                    },
                )

            def _serialize_error_event(
                message_text: str, status_code: int | str = 500
            ) -> str:
                try:
                    status_int = int(status_code)
                except (TypeError, ValueError):  # pragma: no cover - defensive
                    status_int = 500
                payload = {
                    "type": "error",
                    "message": message_text,
                    "status_code": status_int,
                }
                if db_message_id_for_stream:
                    payload["db_message_id"] = db_message_id_for_stream
                return f"data: {json.dumps(payload)}\n\n"

            def _stream_agent_response():
                """Stream agent response via Redis pub/sub with Celery worker."""
                import uuid
                from modules.celery_tasks import offload_streaming_agent_task
                from modules.stream_bus import RedisStreamBus

                # Generate unique stream ID
                stream_id = str(uuid.uuid4())

                try:
                    # Offload to Celery worker (fire-and-forget)
                    task_id = offload_streaming_agent_task(
                        stream_id=stream_id,
                        query=query_text,
                        chat_history=chat_history_messages,
                        vector_store_config=vector_store_config,
                        image_base64=image_base64,
                        image_mime_type=image_mime_type,
                        uploaded_file_content=uploaded_file_content,
                        uploaded_file_type=uploaded_file_type,
                        uploaded_file_name=uploaded_file_name,
                        conversation_id=conversation_id,
                        extra_kwargs=extra_kwargs,
                    )

                    if not task_id:
                        error_text = "Failed to offload streaming task to worker."
                        logging.error(error_text)
                        _update_placeholder_with_error(error_text)
                        yield _serialize_error_event(error_text, status_code=503)
                        return

                    logging.info(f"[Stream] Offloaded to Celery task {task_id}, stream_id={stream_id}")

                    # Listen to Redis stream
                    bus = RedisStreamBus()
                    heartbeat_interval = current_app.config.get('STREAM_HEARTBEAT_SECONDS', 15)
                    idle_timeout = current_app.config.get('STREAM_IDLE_TIMEOUT_SECONDS', 300)

                    import time
                    last_chunk_time = time.time()
                    heartbeat_count = 0

                    for chunk in bus.listen(stream_id):
                        if chunk is None:
                            # Heartbeat - check timeout
                            elapsed = time.time() - last_chunk_time
                            if elapsed > idle_timeout:
                                error_text = f"Stream timed out after {elapsed:.1f}s of inactivity."
                                logging.warning(f"[Stream {stream_id}] {error_text}")
                                _update_placeholder_with_error(error_text)
                                yield _serialize_error_event(error_text, status_code=504)
                                bus.discard(stream_id)
                                return

                            # Send heartbeat to keep connection alive
                            heartbeat_count += 1
                            if heartbeat_count % 3 == 0:  # Every ~45s
                                yield ": heartbeat\n\n"
                            continue

                        # Reset timeout on chunk received
                        last_chunk_time = time.time()

                        # Forward chunk to client
                        if chunk:
                            yield chunk if isinstance(chunk, str) else str(chunk)

                    logging.info(f"[Stream {stream_id}] Completed successfully")

                except Exception as exc:
                    error_text = f"Streaming error: {str(exc)}"
                    logging.error(f"[Stream] {error_text}", exc_info=True)
                    _update_placeholder_with_error(error_text)
                    yield _serialize_error_event(error_text)

            return Response(
                stream_with_context(_stream_agent_response()),
                status=200,
                headers={"Content-Type": "text/event-stream"},
                mimetype="text/event-stream",
            )

        agent_result = invoke_agent_via_worker(
            query=query_text,
            chat_history=chat_history_messages,
            vector_store_config=vector_store_config,
            stream=False,
            image_base64=image_base64,
            image_mime_type=image_mime_type,
            uploaded_file_content=uploaded_file_content,
            uploaded_file_type=uploaded_file_type,
            uploaded_file_name=uploaded_file_name,
            conversation_id=conversation_id,
            timeout=task_timeout,
            extra_kwargs=extra_kwargs,
        )

        def _worker_unavailable_response(status_code: int = 503):
            error_msg_local = "Agent worker is unavailable. Please ensure the worker container is running."
            logging.error(error_msg_local)
            if stream_flag:
                def _stream_agent_error():
                    payload = {
                        "type": "error",
                        "message": error_msg_local,
                        "status_code": status_code,
                    }
                    if db_message_id_for_stream:
                        payload["db_message_id"] = db_message_id_for_stream
                    yield f"data: {json.dumps(payload)}\n\n"
                return Response(
                    stream_with_context(_stream_agent_error()),
                    status=status_code,
                    headers={"Content-Type": "text/event-stream"},
                    mimetype="text/event-stream",
                )
            return jsonify({
                "error": error_msg_local,
                "status_code": status_code,
                "type": "agent_unavailable",
            }), status_code

        if agent_result is None:
            return _worker_unavailable_response()

        if isinstance(agent_result, dict) and agent_result.get("type") == "error":
            message = agent_result.get("message", "Agent worker returned an error")
            status_code = agent_result.get("status_code", 500)
            logging.error("Agent worker error: %s", message)
            if stream_flag:
                def _stream_agent_error_message():
                    payload = {
                        "type": "error",
                        "message": message,
                        "status_code": status_code,
                    }
                    if db_message_id_for_stream:
                        payload["db_message_id"] = db_message_id_for_stream
                    yield f"data: {json.dumps(payload)}\n\n"
                return Response(
                    stream_with_context(_stream_agent_error_message()),
                    status=status_code,
                    headers={"Content-Type": "text/event-stream"},
                    mimetype="text/event-stream",
                )
            return jsonify({"error": message, "status_code": status_code}), status_code

        # Non-streaming path: persist final answer and respond synchronously
        message_id = add_message(
            user_id=current_user.user_id,
            message_text=query_text,
            answer=agent_result.get("answer"),
            citations=agent_result.get("citations", []),
            usage_metadata=agent_result.get("usage_metadata", {}),
            suggested_questions=agent_result.get("suggested_questions", []),
            thread_id=conversation_id,
            structured_query=agent_result.get("structured_query"),
        )

        agent_result_response = dict(agent_result)
        agent_result_response["message_id"] = message_id
        agent_result_response["conversation_id"] = conversation_id
        return jsonify(agent_result_response)



    # --- NEW Endpoint to Resume Agent ---
    @app.route('/api/resume_rag', methods=['POST'])
    @login_required
    def api_resume_rag():
        data = request.get_json()
        # --- ADDED CHECK: Ensure JSON body exists ---
        if data is None:
            logging.error("Failed to parse JSON or empty request body received.") # More specific log
            raise BadRequest("Missing JSON request body")
        thread_id = data.get('thread_id')
        confirmation = data.get('confirmation') # Expect 'yes' or 'no'
        stream_flag = data.get('stream', False) # Check if original request was streaming
        image_base64 = data.get('image_base64') # Get image data if resuming with new image
        image_mime_type = data.get('image_mime_type') # Get image MIME type
        conversation_id = data.get('conversation_id') # Get conversation_id for resume context

        # Image persistence via server-side files (resume)
        if image_base64:
            import base64
            image_folder = Path(current_app.instance_path) / 'session_images'
            image_folder.mkdir(parents=True, exist_ok=True)
            image_data = base64.b64decode(image_base64)
            image_path = image_folder / f"{conversation_id}.img"
            with open(image_path, 'wb') as _f:
                _f.write(image_data)
            session[f"{conversation_id}_image_path"] = str(image_path)
            session[f"{conversation_id}_image_mime_type"] = image_mime_type
        else:
            image_path_str = session.get(f"{conversation_id}_image_path")
            saved_mime = session.get(f"{conversation_id}_image_mime_type")
            if image_path_str and os.path.exists(image_path_str) and saved_mime:
                with open(image_path_str, 'rb') as _f:
                    _data_bytes = _f.read()
                import base64
                image_base64 = base64.b64encode(_data_bytes).decode('utf-8')
                image_mime_type = saved_mime
       
        
        if not thread_id :
            raise BadRequest("Missing thread_id")
        if not confirmation:
            raise BadRequest("Missing confirmation")

        if confirmation == 'no':
            if stream_flag:
                cancel_headers = {"Content-Type": "text/event-stream"}
                return Response(stream_with_context(_stream_cancellation_event_for_resume()), status=200, headers=cancel_headers, mimetype="text/event-stream")
            return jsonify({"status": "cancelled", "message": "Action not performed by user choice."})

        # For streaming resume, create a placeholder DB message first
        db_message_id_for_resume = None
        if stream_flag:
            try:
                placeholder_resume_msg = MessageHistory(
                    user_id=current_user.user_id,
                    thread_id=conversation_id,
                    message_text="[User initiated resume for streaming]",
                    answer="[Resuming stream...]"
                )
                db.session.add(placeholder_resume_msg)
                db.session.flush()
                db_message_id_for_resume = placeholder_resume_msg.message_id
                logging.info(
                    "[Streaming Resume] Created placeholder AI DB message with message_id: %s for conversation_id: %s",
                    db_message_id_for_resume,
                    conversation_id,
                )
            except Exception as e_db_resume_ph:  # pragma: no cover - defensive
                logging.error("Error creating placeholder DB message for streaming resume: %s", e_db_resume_ph, exc_info=True)

        def _resume_worker_unavailable(status_code: int = 503):
            message = "Agent worker is unavailable. Please ensure the worker container is running."
            logging.error(message)
            if stream_flag:
                def _stream_resume_error():
                    error_event = {
                        "type": "error",
                        "message": message,
                        "status_code": status_code,
                        "db_message_id": db_message_id_for_resume,
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
                return Response(
                    stream_with_context(_stream_resume_error()),
                    status=status_code,
                    headers={"Content-Type": "text/event-stream"},
                    mimetype="text/event-stream",
                )
            return jsonify({"error": message, "status_code": status_code}), status_code

        user_id_for_stream = current_user.get_id()

        if stream_flag:
            def _update_resume_placeholder_with_error(message_text: str) -> None:
                if not db_message_id_for_resume:
                    return
                _update_message_history_entry(
                    db_message_id_for_resume,
                    {
                        "answer": message_text,
                        "citations": [],
                        "usage_metadata": {},
                        "suggested_questions": [],
                    },
                )

            def _serialize_resume_error_event(message_text: str, status_code: int | str = 500) -> str:
                try:
                    status_int = int(status_code)
                except (TypeError, ValueError):
                    status_int = 500
                payload = {
                    "type": "error",
                    "message": message_text,
                    "status_code": status_int,
                }
                if db_message_id_for_resume:
                    payload["db_message_id"] = db_message_id_for_resume
                return f"data: {json.dumps(payload)}\n\n"

            def _stream_resume_response():
                try:
                    from modules.agent import resume_agent_graph
                except Exception as import_err:
                    logging.error(
                        "Streaming resume requested but agent graph unavailable: %s",
                        import_err,
                        exc_info=True,
                    )
                    error_text = "Streaming resume is temporarily unavailable."
                    _update_resume_placeholder_with_error(error_text)
                    yield _serialize_resume_error_event(error_text)
                    return

                resume_kwargs = {
                    "thread_id": thread_id,
                    "confirmation": confirmation,
                    "stream": True,
                    "image_base64": image_base64,
                    "image_mime_type": image_mime_type,
                    "conversation_id": conversation_id,
                    "user_id_for_stream": user_id_for_stream,
                }
                if db_message_id_for_resume:
                    resume_kwargs["db_message_id_for_stream"] = db_message_id_for_resume

                try:
                    streaming_result = resume_agent_graph(**resume_kwargs)
                except Exception as resume_err:
                    logging.error(
                        "Error starting streaming resume: %s",
                        resume_err,
                        exc_info=True,
                    )
                    error_text = "Error starting streaming resume."
                    _update_resume_placeholder_with_error(error_text)
                    yield _serialize_resume_error_event(error_text)
                    return

                if inspect.isasyncgen(streaming_result):
                    loop = asyncio.new_event_loop()
                    try:
                        asyncio.set_event_loop(loop)
                        async_iterator = streaming_result.__aiter__()
                        while True:
                            try:
                                chunk = loop.run_until_complete(async_iterator.__anext__())
                            except StopAsyncIteration:
                                break
                            if chunk is not None:
                                yield chunk if isinstance(chunk, str) else str(chunk)
                    except Exception as stream_err:
                        logging.error(
                            "Error while streaming resume output: %s",
                            stream_err,
                            exc_info=True,
                        )
                        error_text = "Streaming resume interrupted due to an internal error."
                        _update_resume_placeholder_with_error(error_text)
                        yield _serialize_resume_error_event(error_text)
                    finally:
                        try:
                            if hasattr(streaming_result, "aclose"):
                                loop.run_until_complete(streaming_result.aclose())
                        except Exception as close_err:
                            logging.debug(
                                "Error closing streaming resume generator: %s",
                                close_err,
                                exc_info=True,
                            )
                        asyncio.set_event_loop(None)
                        loop.close()
                    return

                if isinstance(streaming_result, dict):
                    if streaming_result.get("type") == "error":
                        error_text = streaming_result.get(
                            "message", "Agent worker returned an error"
                        )
                        status_code = streaming_result.get("status_code", 500)
                        _update_resume_placeholder_with_error(error_text)
                        yield _serialize_resume_error_event(error_text, status_code=status_code)
                        return

                    if db_message_id_for_resume:
                        _update_message_history_entry(
                            db_message_id_for_resume,
                            streaming_result,
                        )

                    metadata = {}
                    if db_message_id_for_resume:
                        metadata["message_id"] = str(db_message_id_for_resume)
                    if conversation_id:
                        metadata["conversation_id"] = conversation_id
                    if metadata:
                        metadata_event = {
                            "type": "metadata_update",
                            "metadata": metadata,
                        }
                        yield f"data: {json.dumps(metadata_event)}\n\n"

                    final_payload = dict(streaming_result)
                    if conversation_id:
                        final_payload["conversation_id"] = conversation_id
                    if db_message_id_for_resume:
                        final_payload["message_id"] = db_message_id_for_resume
                    end_event = {"type": "end_of_stream", "data": final_payload}
                    yield f"data: {json.dumps(end_event)}\n\n"
                    return

                logging.error(
                    "Streaming resume invocation returned unexpected type: %s",
                    type(streaming_result),
                )
                error_text = "Streaming resume failed due to unexpected response type."
                _update_resume_placeholder_with_error(error_text)
                yield _serialize_resume_error_event(error_text)

            return Response(
                stream_with_context(_stream_resume_response()),
                status=200,
                headers={"Content-Type": "text/event-stream"},
                mimetype="text/event-stream",
            )

        try:
            extra_kwargs = {}
            if db_message_id_for_resume:
                extra_kwargs["db_message_id_for_stream"] = db_message_id_for_resume
                extra_kwargs["user_id_for_stream"] = user_id_for_stream

            resume_result = resume_agent_via_worker(
                thread_id=thread_id,
                confirmation=confirmation,
                stream=stream_flag,
                image_base64=image_base64,
                image_mime_type=image_mime_type,
                conversation_id=conversation_id,
                extra_kwargs=extra_kwargs,
            )

            if resume_result is None:
                return _resume_worker_unavailable()

            if isinstance(resume_result, dict) and resume_result.get("type") == "error":
                error_message = resume_result.get("message", "Resuming failed.")
                status_code = resume_result.get("status_code", 500)
                logging.error("Agent resume error: %s", error_message)
                return jsonify({"error": error_message, "status_code": status_code}), status_code

            if isinstance(resume_result, dict) and "answer" in resume_result:
                final_answer = resume_result.get("answer", "Resumed operation completed.")
                resumed_ai_msg_id = add_message(
                    user_id=current_user.user_id,
                    message_text=f"[Resumed from HIL for thread {thread_id}]",
                    answer=final_answer,
                    citations=resume_result.get("citations", []),
                    usage_metadata=resume_result.get("usage_metadata", {}),
                    suggested_questions=resume_result.get("suggested_questions", []),
                    thread_id=thread_id,
                    structured_query=resume_result.get("structured_query"),
                )
                response_payload = dict(resume_result)
                response_payload["message_id"] = resumed_ai_msg_id
                if conversation_id:
                    response_payload["conversation_id"] = conversation_id
                return jsonify(response_payload)

            return jsonify({"error": "Non-streaming resume did not return expected data."}), 500
        except Exception as e:  # pragma: no cover - defensive
            logging.error("Error resuming agent workflow for thread %s: %s", thread_id, e, exc_info=True)
            if stream_flag:
                def _stream_exception_error_on_resume():
                    error_event = {
                        "type": "error",
                        "message": f"Error resuming query processing: {str(e)}",
                        "status_code": 500,
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
                return Response(
                    stream_with_context(_stream_exception_error_on_resume()),
                    status=500,
                    headers={"Content-Type": "text/event-stream"},
                    mimetype="text/event-stream",
                )
            return jsonify({"error": f"Error resuming query processing: {str(e)}"}), 500

    @app.route('/api/get_document_chunk', methods=['GET'])
    @login_required
    def get_document_chunk():
        """
        Returns the content for a specific document chunk. If possible, it will return
        the content of the entire page where the chunk is located for better context.
        """
        from modules.database import Document as DB_Document
        import uuid

        document_id_str = request.args.get('document_id')
        if not document_id_str:
            return jsonify({"error": "Missing document_id parameter"}), 400

        try:
            # Validate the UUID format first
            uuid.UUID(document_id_str)
        except ValueError:
            return jsonify({"error": "Invalid document_id format"}), 400

        try:
            trigger_chunk = _fetch_document_record(document_id_str)
            if not trigger_chunk:
                return jsonify({"error": "Document chunk not found"}), 404

            source_filename = trigger_chunk.source
            page_number = None

            # Try to extract page number from the trigger chunk's metadata
            try:
                if trigger_chunk.dl_meta and 'doc_items' in trigger_chunk.dl_meta and trigger_chunk.dl_meta['doc_items']:
                    page_number = trigger_chunk.dl_meta['doc_items'][0]['prov'][0]['page_no']
            except (KeyError, IndexError, TypeError):
                logging.debug(f"Could not extract page_no from dl_meta for chunk {document_id_str}.")
                pass

            # If we have a source and page number, try to fetch the whole page
            if source_filename and page_number is not None:
                logging.info(f"Fetching full page content for source '{source_filename}', page {page_number}.")
                all_source_chunks = DB_Document.query.filter_by(source=source_filename).all()

                page_chunks = []
                for chunk in all_source_chunks:
                    try:
                        chunk_page_no = chunk.dl_meta['doc_items'][0]['prov'][0]['page_no']
                        if chunk_page_no == page_number:
                            page_chunks.append(chunk)
                    except (KeyError, IndexError, TypeError, AttributeError):
                        continue

                def get_bbox_top(chunk):
                    try:
                        return chunk.dl_meta['doc_items'][0]['prov'][0]['bbox']['t']
                    except (KeyError, IndexError, TypeError, AttributeError):
                        return float('inf')

                page_chunks.sort(key=get_bbox_top)

                if page_chunks:
                    full_page_content = "\n\n".join(chunk.content_preview for chunk in page_chunks)
                    return jsonify({"content": full_page_content, "source": f"{source_filename} (Page {page_number})"})

            # Fallback to returning just the single chunk's content
            logging.info(f"Falling back to single chunk content for chunk_id {document_id_str}.")
            content = trigger_chunk.content_preview or "Content preview is not available for this chunk."
            source = trigger_chunk.source or "Unknown Source"
            if page_number is not None:
                source = f"{source} (Page {page_number})"

            return jsonify({
                "content": content,
                "source": source
            })
        except Exception as e:
            logging.error(f"Error fetching document chunk {document_id_str}: {e}", exc_info=True)
            return jsonify({"error": "An internal error occurred while fetching the document chunk."}), 500

    # --- The rest of the endpoints (api_message_metadata, get_document_meta, get_visual_evidence) remain unchanged ---

    @app.route('/api/message_metadata', methods=['GET'])
    @login_required
    def api_message_metadata():
        message_id = request.args.get('message_id')
        if not message_id:
            return jsonify({"error": "Missing message_id parameter"}), 400
        from modules.database import MessageHistory
        try:
            try:
                msg_id_int = int(message_id)
            except Exception:
                return jsonify({"error": "Invalid message_id parameter"}), 400
            msg = MessageHistory.query.filter_by(message_id=msg_id_int, user_id=current_user.get_id()).first()
            if not msg:
                return jsonify({"error": "Message not found"}), 404
            import json
            return jsonify({
                "citations": json.loads(msg.citations) if msg.citations else [],
                "usage_metadata": json.loads(msg.usage_metadata) if msg.usage_metadata else None,
                "suggested_questions": json.loads(msg.suggested_questions) if msg.suggested_questions else [],
                "structured_query": msg.structured_query # <<< ADDED: Return structured query
            })
        except Exception as e:
            logging.error(f"Error fetching message metadata: {e}")
            return jsonify({"error": "Error fetching message metadata"}), 500

    @app.route('/api/document_meta', methods=['GET'])
    @login_required
    def get_document_meta():
        from modules.database import Document as DB_Document
        import uuid
        document_id = request.args.get('document_id')
        if not document_id:
            return jsonify({"error": "Missing document_id parameter"}), 400
        doc_obj = _fetch_document_record(document_id)
        if not doc_obj:
            return jsonify({"error": "Document not found"}), 404
        page = None
        snippet = ""
        if doc_obj.dl_meta and isinstance(doc_obj.dl_meta, dict):
            doc_items = doc_obj.dl_meta.get("doc_items", [])
            if doc_items and "prov" in doc_items[0] and doc_items[0]["prov"]:
                prov = doc_items[0]["prov"][0]
                page = prov.get("page_no")
            if doc_items and "text" in doc_items[0]:
                snippet = doc_items[0]["text"][:120]
        return jsonify({
            "source": doc_obj.source,
            "page": page,
            "snippet": snippet
        })

    @app.route('/api/visual_evidence', methods=['GET'])
    @login_required
    def get_visual_evidence():
        from modules.database import Document as DB_Document
        import uuid

        document_id = request.args.get('document_id')
        docling_json_path_rel = request.args.get('docling_json_path')
        page_no_str = request.args.get('page_no')
        bbox_json = request.args.get('bbox')

        if document_id:
            try:
                doc_obj = _fetch_document_record(document_id)
                if not doc_obj:
                    return jsonify({"error": "Document not found in database."}), 404
                docling_json_path_rel = doc_obj.docling_json_path
                dl_meta = doc_obj.dl_meta
                if dl_meta and isinstance(dl_meta, dict):
                    doc_items = dl_meta.get("doc_items", [])
                    if doc_items and "prov" in doc_items[0] and doc_items[0]["prov"]:
                        prov = doc_items[0]["prov"][0]
                        if not page_no_str:
                            page_no_str = str(prov.get("page_no"))
                        if not bbox_json:
                            bbox_json = json.dumps(prov.get("bbox"))
            except Exception as e:
                logging.error(f"Error fetching document from DB for visual evidence: {e}")
                return jsonify({"error": "Error fetching document from database."}), 500

        if not all([docling_json_path_rel, page_no_str, bbox_json]):
            return jsonify({"error": "Missing required parameters (docling_json_path, page_no, bbox)"}), 400

        try:
            page_no = int(page_no_str)
        except ValueError:
            return jsonify({"error": "Invalid page_no parameter"}), 400

        try:
            bbox_dict = json.loads(bbox_json)
            if not all(k in bbox_dict for k in ['l', 't', 'r', 'b']):
                raise ValueError("Invalid bbox structure")
        except (json.JSONDecodeError, ValueError) as e:
            logging.error(f"Invalid bbox JSON received: {bbox_json} - Error: {e}")
            return jsonify({"error": f"Invalid bbox parameter: {e}"}), 400

        try:
            if ".." in docling_json_path_rel:
                logging.error(f"Invalid relative path detected: {docling_json_path_rel}")
                return jsonify({"error": "Invalid document path."}), 400

            # Resolve relative paths using DATA_VOLUME_PATH
            doc_json_path = Path(docling_json_path_rel)
            if not doc_json_path.is_absolute():
                # Check if path starts with "data/" - if so, replace with DATA_VOLUME_PATH
                if docling_json_path_rel.startswith('data/'):
                    # Strip "data/" prefix and prepend DATA_VOLUME_PATH
                    relative_part = docling_json_path_rel[5:]  # Remove "data/" prefix
                    doc_json_path = Path(current_app.config['DATA_VOLUME_PATH']) / relative_part
                else:
                    # Fallback: resolve relative to app root
                    doc_json_path = Path(current_app.root_path) / docling_json_path_rel

            doc_json_path_str = str(doc_json_path)

            if not doc_json_path.exists():
                logging.error(f"DoclingDocument JSON not found at path: {doc_json_path_str} (relative path provided: {docling_json_path_rel})")
                return jsonify({"error": "Source document data not found."}), 404

            logging.info(f"Loading DoclingDocument from: {doc_json_path_str} (Using relative path: {docling_json_path_rel})")
            dl_doc = _load_docling_document(doc_json_path)


        except (ImportError, RuntimeError) as e:
            logging.error(f"Failed to resolve DoclingDocument: {e}. Is docling installed correctly?")
            return jsonify({"error": "Server configuration error (Docling library)."}), 500
        except Exception as e:
            logging.error(f"Error loading DoclingDocument using relative path {docling_json_path_rel}: {e}", exc_info=True)
            return jsonify({"error": "Error loading source document data."}), 500

        try:
            if page_no not in dl_doc.pages:
                logging.error(f"Invalid page number {page_no} requested for document at {docling_json_path_rel} (Available page keys: {list(dl_doc.pages.keys())})")
                return jsonify({"error": "Invalid page number."}), 400

            page = dl_doc.pages[page_no]

            if not page.image or not hasattr(page.image, 'pil_image'):
                logging.error(f"Page {page_no} in document at {docling_json_path_rel} does not contain image data.")
                return jsonify({"error": "Image data not available for this page."}), 404

            img = page.image.pil_image.copy()
            page_height = page.size.height
            page_width = page.size.width

        except Exception as e:
            logging.error(f"Error accessing page image for doc at {docling_json_path_rel}, page {page_no}: {e}", exc_info=True)
            return jsonify({"error": "Error accessing page image."}), 500

        try:
            l_bl = bbox_dict['l']
            t_bl = bbox_dict['t']
            r_bl = bbox_dict['r']
            b_bl = bbox_dict['b']

            l_tl = l_bl
            t_tl = page_height - t_bl
            r_tl = r_bl
            b_tl = page_height - b_bl

            norm_l = l_tl / page_width
            norm_t = t_tl / page_height
            norm_r = r_tl / page_width
            norm_b = b_tl / page_height

            thickness = 4
            padding = thickness + 2
            draw_l = round(norm_l * img.width - padding)
            draw_r = round(norm_r * img.width + padding)
            draw_t = round(norm_t * img.height - padding)
            draw_b = round(norm_b * img.height + padding)

            draw_l = max(0, draw_l)
            draw_t = max(0, draw_t)
            draw_r = min(img.width - 1, draw_r)
            draw_b = min(img.height - 1, draw_b)

            outline_color = (255, 0, 0)
            try:
                if draw_r > draw_l and draw_b > draw_t:
                    box_region = img.crop((draw_l, draw_t, draw_r, draw_b))
                    avg_color = ImageStat.Stat(box_region).mean
                    if len(avg_color) >= 3:
                        luminance = (0.299 * avg_color[0] + 0.587 * avg_color[1] + 0.114 * avg_color[2])
                        luminance_threshold = 128
                        if luminance < luminance_threshold:
                            outline_color = (255, 255, 0)
                        else:
                            outline_color = (0, 0, 0)
                        logging.debug(f"Calculated luminance: {luminance}, using outline color: {outline_color}")
                    else:
                        logging.warning(f"Could not determine average color for bbox region (avg_color: {avg_color}). Defaulting outline to red.")
                else:
                    logging.warning(f"Invalid box dimensions for cropping ({draw_l},{draw_t},{draw_r},{draw_b}). Defaulting outline to red.")
            except Exception as stat_err:
                logging.warning(f"Error calculating image stats for bbox: {stat_err}. Defaulting outline to red.")

            draw = ImageDraw.Draw(img)
            draw.rectangle(
                xy=(draw_l, draw_t, draw_r, draw_b),
                outline=outline_color,
                width=thickness,
            )
            logging.info(f"Drew bounding box on page {page_no} for doc at {docling_json_path_rel}")

        except Exception as e:
            logging.error(f"Error drawing bounding box for doc at {docling_json_path_rel}, page {page_no}: {e}", exc_info=True)
            return jsonify({"error": "Error processing image."}), 500

        try:
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)

            return send_file(
                img_buffer,
                mimetype='image/png',
                as_attachment=False
            )
        except Exception as e:
            logging.error(f"Error sending image for doc at {docling_json_path_rel}, page {page_no}: {e}", exc_info=True)
            return jsonify({"error": "Error sending image."}), 500

    # --- Simple confirmation endpoint for HIL web-search flow ---
    @app.route('/api/confirm_web_search', methods=['POST'])
    @login_required
    def api_confirm_web_search():
        """
        Lightweight endpoint to confirm/resume a previously interrupted HIL flow.
        Expects JSON body:
          {
            "thread_id": "<thread id returned earlier>",
            "confirmation": "yes" | "no",
            "conversation_id": "<optional conversation id>",
            "stream": false,                # optional, defaults to false
            "image_base64": "<optional>",   # optional image to include when resuming
            "image_mime_type": "<optional>"
          }

        If confirmation == "yes" this will call resume_agent_graph(...) (non-streaming) to continue
        the workflow (which will perform the web search). If "no", returns cancelled response.
        """
        data = request.get_json()
        if data is None:
            logging.error("confirm_web_search: missing JSON body")
            raise BadRequest("Missing JSON request body")

        thread_id = data.get("thread_id")
        confirmation = data.get("confirmation")
        conversation_id = data.get("conversation_id")
        stream_flag = data.get("stream", False)
        image_base64 = data.get("image_base64")
        image_mime_type = data.get("image_mime_type")

        if not thread_id:
            raise BadRequest("Missing thread_id")
        if not confirmation:
            raise BadRequest("Missing confirmation")

        if confirmation == 'no':
            # User declined web search
            if stream_flag:
                def _cancel_stream():
                    yield f"data: {json.dumps({'type': 'cancellation', 'status': 'cancelled', 'message': 'User declined web search.'})}\n\n"
                return Response(stream_with_context(_cancel_stream()), status=200, headers={"Content-Type": "text/event-stream"}, mimetype="text/event-stream")
            else:
                return jsonify({"status": "cancelled", "message": "User declined web search."})

        # confirmation == 'yes'
        user_id_for_stream = current_user.get_id()

        if stream_flag:
            def _serialize_resume_error_event(message_text: str, status_code: int | str = 500) -> str:
                try:
                    status_int = int(status_code)
                except (TypeError, ValueError):
                    status_int = 500
                payload = {
                    "type": "error",
                    "message": message_text,
                    "status_code": status_int,
                }
                return f"data: {json.dumps(payload)}\n\n"

            def _stream_resume_response():
                try:
                    from modules.agent import resume_agent_graph
                except Exception as import_err:
                    logging.error(
                        "Streaming resume requested but agent graph unavailable: %s",
                        import_err,
                        exc_info=True,
                    )
                    yield _serialize_resume_error_event("Streaming resume is temporarily unavailable.")
                    return

                resume_kwargs = {
                    "thread_id": thread_id,
                    "confirmation": confirmation,
                    "stream": True,
                    "image_base64": image_base64,
                    "image_mime_type": image_mime_type,
                    "conversation_id": conversation_id,
                    "user_id_for_stream": user_id_for_stream,
                }

                try:
                    streaming_result = resume_agent_graph(**resume_kwargs)
                except Exception as resume_err:
                    logging.error(
                        "Error starting streaming resume: %s",
                        resume_err,
                        exc_info=True,
                    )
                    yield _serialize_resume_error_event("Error starting streaming resume.")
                    return

                if conversation_id:
                    metadata_event = {
                        "type": "metadata_update",
                        "metadata": {"conversation_id": conversation_id},
                    }
                    yield f"data: {json.dumps(metadata_event)}\n\n"

                if inspect.isasyncgen(streaming_result):
                    loop = asyncio.new_event_loop()
                    try:
                        asyncio.set_event_loop(loop)
                        async_iterator = streaming_result.__aiter__()
                        while True:
                            try:
                                chunk = loop.run_until_complete(async_iterator.__anext__())
                            except StopAsyncIteration:
                                break
                            if chunk is not None:
                                yield chunk if isinstance(chunk, str) else str(chunk)
                    except Exception as stream_err:
                        logging.error(
                            "Error while streaming resume output: %s",
                            stream_err,
                            exc_info=True,
                        )
                        yield _serialize_resume_error_event(
                            "Streaming resume interrupted due to an internal error."
                        )
                    finally:
                        try:
                            if hasattr(streaming_result, "aclose"):
                                loop.run_until_complete(streaming_result.aclose())
                        except Exception as close_err:
                            logging.debug(
                                "Error closing streaming resume generator: %s",
                                close_err,
                                exc_info=True,
                            )
                        asyncio.set_event_loop(None)
                        loop.close()
                    return

                if isinstance(streaming_result, dict):
                    if streaming_result.get("type") == "error":
                        error_message = streaming_result.get("message", "Resuming failed.")
                        status_code = streaming_result.get("status_code", 500)
                        yield _serialize_resume_error_event(error_message, status_code=status_code)
                        return

                    final_payload = dict(streaming_result)
                    if conversation_id:
                        final_payload["conversation_id"] = conversation_id
                    end_event = {"type": "end_of_stream", "data": final_payload}
                    yield f"data: {json.dumps(end_event)}\n\n"
                    return

                logging.error(
                    "Streaming resume invocation returned unexpected type: %s",
                    type(streaming_result),
                )
                yield _serialize_resume_error_event(
                    "Streaming resume failed due to unexpected response type."
                )

            return Response(
                stream_with_context(_stream_resume_response()),
                status=200,
                headers={"Content-Type": "text/event-stream"},
                mimetype="text/event-stream",
            )

        try:
            resume_result = resume_agent_via_worker(
                thread_id=thread_id,
                confirmation=confirmation,
                stream=stream_flag,
                image_base64=image_base64,
                image_mime_type=image_mime_type,
                conversation_id=conversation_id,
            )

            if resume_result is None:
                message = "Agent worker is unavailable. Please ensure the worker container is running."
                logging.error(message)
                return jsonify({"error": message, "status_code": 503}), 503

            if isinstance(resume_result, dict) and resume_result.get("type") == "error":
                error_message = resume_result.get("message", "Resuming failed.")
                status_code = resume_result.get("status_code", 500)
                logging.error("confirm_web_search worker error: %s", error_message)
                return jsonify({"error": error_message, "status_code": status_code}), status_code

            if isinstance(resume_result, dict):
                response_payload = dict(resume_result)
                if conversation_id:
                    response_payload["conversation_id"] = conversation_id
                return jsonify(response_payload)

            logging.error("confirm_web_search: unexpected resume result type: %s", type(resume_result))
            return jsonify({"error": "Unexpected resume result."}), 500
        except Exception as e:
            logging.error(f"Error while confirming/resuming web search for thread {thread_id}: {e}", exc_info=True)
            if stream_flag:
                def _stream_unhandled_error():
                    error_event = {
                        "type": "error",
                        "message": f"Error resuming web search: {str(e)}",
                        "status_code": 500,
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
                return Response(
                    stream_with_context(_stream_unhandled_error()),
                    status=500,
                    headers={"Content-Type": "text/event-stream"},
                    mimetype="text/event-stream",
                )
            return jsonify({"error": f"Error resuming web search: {str(e)}"}), 500
