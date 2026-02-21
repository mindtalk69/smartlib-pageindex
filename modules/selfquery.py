import json
import logging
import os
import re
from typing import List, Sequence, Set

from flask import Blueprint, request, jsonify, current_app

# --- Langchain Imports ---
from langchain.chains.query_constructor.schema import AttributeInfo
from langchain.retrievers.self_query.base import SelfQueryRetriever
from langchain_openai import AzureChatOpenAI
from modules.llm_utils import get_llm, get_embedding_function, get_active_language_name
from config import Config

# --- PGVector Import (langchain_postgres) ---
# SQLite version only - skip postgres import
# from langchain_postgres import PGVector
PGVector = None  # Placeholder for SQLite compatibility

# Configure logging
logger = logging.getLogger(__name__)

# --- Flask Blueprint for SelfQuery API ---
selfquery_bp = Blueprint('selfquery', __name__)

from modules.database import get_knowledge_by_id, get_library_by_id

QUESTION_LINE_PATTERN = re.compile(r"^\s*[\-\*\u2022]?\s*(?:\d+[\).:\-]?\s*)?(?P<question>.+\?)\s*$")


def _dedupe_questions(questions: Sequence[str]) -> List[str]:
    seen: Set[str] = set()
    deduped: List[str] = []
    for item in questions:
        if item is None:
            continue
        cleaned = str(item).strip()
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(cleaned)
    return deduped


def _extract_questions_from_text(raw_text: object) -> List[str]:
    if raw_text is None:
        return []

    results: List[str] = []
    text: str = raw_text if isinstance(raw_text, str) else str(raw_text)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            results.extend(str(item).strip() for item in parsed if str(item).strip())
        elif isinstance(parsed, dict):
            maybe_list = parsed.get("questions")
            if isinstance(maybe_list, list):
                results.extend(str(item).strip() for item in maybe_list if str(item).strip())
        if results:
            return _dedupe_questions(results)
    except Exception:
        pass

    for line in text.splitlines():
        match = QUESTION_LINE_PATTERN.match(line)
        if not match:
            continue
        extracted = match.group("question").strip()
        if extracted:
            results.append(extracted)
    if not results:
        quoted = re.findall(r'"([^"\n]+\?)"', text)
        results.extend(quoted)

    return _dedupe_questions(results)


def _request_additional_questions(
    llm,
    context: str,
    language: str,
    existing_questions: Sequence[str],
    amount: int,
) -> List[str]:
    if amount <= 0:
        return []

    existing_list = _dedupe_questions(existing_questions)
    lead_in = ""
    if existing_list:
        existing_preview = " | ".join(existing_list)
        lead_in = (
            "You previously generated the following user starter questions: "
            f"{existing_preview}.\n"
        )

    prompt_parts = [
        lead_in,
        f"The knowledge context is: {context}.\n",
        f"Generate {amount} additional unique and helpful questions in {language}. ",
        "Do not repeat any existing questions. ",
        "Return ONLY a JSON array of the new questions.",
    ]
    prompt = "".join(prompt_parts)

    try:
        response = llm.invoke(prompt)
        candidates = _extract_questions_from_text(getattr(response, "content", response))
    except Exception as exc:
        logger.warning("Failed to request supplemental self-retriever questions: %s", exc, exc_info=True)
        return []

    existing_lower: Set[str] = {q.lower() for q in existing_list}
    filtered: List[str] = []
    for candidate in candidates:
        lowered = candidate.lower()
        if lowered in existing_lower:
            continue
        existing_lower.add(lowered)
        filtered.append(candidate)
        if len(filtered) >= amount:
            break
    return filtered


@selfquery_bp.route('/api/self-retriever-questions', methods=['POST'])
def api_self_retriever_questions():
    """
    API endpoint to generate a list of dynamic self-retriever questions for the current context.
    Expects JSON body: { "knowledge_id": ..., "library_id": ..., "user_id": ... }
    Returns: { "questions": [ ... ] }
    """
    data = request.get_json(force=True)
    knowledge_id = data.get("knowledge_id")
    library_id = data.get("library_id")
    user_id = data.get("user_id")

    # Compose a rich context for the LLM
    context_parts = []
    # Knowledge context
    knowledge = get_knowledge_by_id(int(knowledge_id)) if knowledge_id else None
    if knowledge:
        context_parts.append(f"Knowledge: {knowledge.name}")
        # Related libraries
        if knowledge.libraries:
            libs = ", ".join([lib.name for lib in knowledge.libraries])
            context_parts.append(f"Libraries: {libs}")
        # Related catalogs
        if hasattr(knowledge, "catalogs") and knowledge.catalogs:
            cats = ", ".join([cat.name for cat in knowledge.catalogs])
            context_parts.append(f"Catalogs: {cats}")
        # Related categories
        if hasattr(knowledge, "categories") and knowledge.categories:
            cats = ", ".join([cat.name for cat in knowledge.categories])
            context_parts.append(f"Categories: {cats}")
        # Related groups
        if hasattr(knowledge, "groups") and knowledge.groups:
            grps = ", ".join([grp.name for grp in knowledge.groups])
            context_parts.append(f"Groups: {grps}")
    # Library context
    library = get_library_by_id(int(library_id)) if library_id else None
    if library:
        context_parts.append(f"Library: {library.name}")
    # Product/brand metadata (if present in knowledge or library)
    if knowledge:
        if hasattr(knowledge, "product_model_name_service") and knowledge.product_model_name_service:
            context_parts.append(f"Product: {knowledge.product_model_name_service}")
        if hasattr(knowledge, "brand_manufacturer_organization") and knowledge.brand_manufacturer_organization:
            context_parts.append(f"Brand: {knowledge.brand_manufacturer_organization}")
    if library:
        if hasattr(library, "product_model_name_service") and library.product_model_name_service:
            context_parts.append(f"Product: {library.product_model_name_service}")
        if hasattr(library, "brand_manufacturer_organization") and library.brand_manufacturer_organization:
            context_parts.append(f"Brand: {library.brand_manufacturer_organization}")
    if user_id:
        context_parts.append(f"User ID: {user_id}")
    context_str = "; ".join(context_parts) if context_parts else "No specific context"

    default_language = get_active_language_name()
    language_instruction = f"Generate the questions in {default_language}.\n"

    prompt = "".join([
        "You are an AI assistant helping users explore a knowledge base.\n",
        f"Context: {context_str}\n",
        "Generate 6 diverse, interesting, and helpful questions a user might want to ask about this knowledge/library. ",
        "Questions should cover summary, recent content, topics, authors, languages, catalogs, categories, groups, product, and brand. ",
        language_instruction,
        "Return ONLY a JSON array of 6 questions, e.g.:\n",
        '["Question 1?", "Question 2?", ...]',
        "Do not include any explanations or extra text.",
    ])

    logger.info(f"[self-retriever-questions] LLM prompt context: {context_str}")

    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        raw_content = getattr(response, "content", response)
        logger.info("[self-retriever-questions] LLM raw response: %s", raw_content)

        questions = _extract_questions_from_text(raw_content)
        total_needed = 6
        attempts = 0
        while len(questions) < total_needed and attempts < 2:
            missing = total_needed - len(questions)
            supplemental = _request_additional_questions(
                llm, context_str, default_language, questions, missing
            )
            if not supplemental:
                break
            questions.extend(supplemental)
            attempts += 1

        if not questions:
            supplemental = _request_additional_questions(
                llm, context_str, default_language, [], total_needed
            )
            if supplemental:
                questions.extend(supplemental)

        questions = _dedupe_questions(questions)
        if len(questions) > total_needed:
            questions = questions[:total_needed]
        elif len(questions) < total_needed and questions:
            while len(questions) < total_needed:
                questions.append(questions[-1])
        elif not questions:
            fallback_prompt = "".join([
                f"Generate {total_needed} helpful starter questions in {default_language}. ",
                f"The knowledge context is: {context_str}. ",
                "Return ONLY a JSON array of the questions.",
            ])
            try:
                fallback_response = llm.invoke(fallback_prompt)
                fallback_raw = getattr(fallback_response, "content", fallback_response)
                fallback_questions = _extract_questions_from_text(fallback_raw)
                if fallback_questions:
                    questions = _dedupe_questions(fallback_questions)[:total_needed]
            except Exception as fallback_exc:
                logger.warning(
                    "Final fallback for self-retriever questions failed: %s",
                    fallback_exc,
                    exc_info=True,
                )
                filler = f"{default_language}: further explore this knowledge."
                questions = [filler] * total_needed

        return jsonify({"questions": questions}), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        logger.error(f"Error generating dynamic self-retriever questions: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate questions."}), 500

@selfquery_bp.route('/api/self-retriever', methods=['POST'])
def api_self_retriever():
    """
    API endpoint to run the self retriever with a given question, knowledge_id, library_id, user_id.
    Expects JSON body: { "question": "...", "knowledge_id": ..., "library_id": ..., "user_id": ... }
    """
    data = request.get_json(force=True)
    question = data.get("question", "")
    knowledge_id = data.get("knowledge_id")
    library_id = data.get("library_id")
    user_id = data.get("user_id")

    if not question:
        return jsonify({"error": "Missing required parameter: question"}), 400

    # Build metadata filter dynamically
    filters = {}
    if knowledge_id:
        filters["knowledge_id"] = int(knowledge_id)
    if library_id:
        filters["library_id"] = int(library_id)
    if user_id:
        filters["user_id"] = str(user_id)

    result = example_self_query_postgres(question, filters)
    return jsonify(result)

# --- Define Metadata Structure (Keep as is - looks good) ---
metadata_field_info = [
    AttributeInfo(
        name="source",
        description="The original filename of the document",
        type="string",
    ),
    AttributeInfo(
        name="library_id",
        description="The numeric ID of the library the document belongs to",
        type="integer",
    ),
    AttributeInfo(
        name="library_name",
        description="The name of the library the document belongs to",
        type="string",
    ),
    AttributeInfo(
        name="knowledge_id",
        description="The numeric ID of the knowledge base item the document is associated with",
        type="integer",
    ),
    AttributeInfo(
        name="document_type",
        description="The type or category of the document (e.g., 'Datasheet', 'Manual', 'Invoice', 'Report')",
        type="string",
    ),
    AttributeInfo(
        name="main_subject_topic",
        description="A brief summary of the main subject or topic of the document content",
        type="string",
    ),
    AttributeInfo(
        name="language",
        description="The primary language the document is written in (e.g., 'Indonesian', 'English', 'German')",
        type="string",
    ),
    AttributeInfo(
        name="catalogs_names",
        description="A list of catalog names the document belongs to. Used for filtering documents within specific catalogs.",
        type="list[string]",
    ),
    AttributeInfo(
        name="category_names",
        description="A list of category names assigned to the document. Used for filtering by category.",
        type="list[string]",
    ),
    AttributeInfo(
        name="Groups_name",
        description="A list of group names associated with the document, often related to access or department.",
        type="list[string]",
    ),
]

document_content_description = "Content chunks from various documents."

def get_self_query_retriever():
    """
    Sets up and returns a SelfQueryRetriever.
    Returns None for BASIC edition.
    """
    return None, None

def _replace_contain_with_ilike(obj):
    """
    Recursively replace any occurrence of '$contain' with '$ilike' in a filter dict.
    """
    if isinstance(obj, dict):
        new_obj = {}
        for k, v in obj.items():
            new_key = "$ilike" if k == "$contain" else k
            new_obj[new_key] = _replace_contain_with_ilike(v)
        return new_obj
    elif isinstance(obj, list):
        return [_replace_contain_with_ilike(item) for item in obj]
    else:
        return obj

def _filter_out_no_filter(obj):
    """
    Recursively replace any occurrence of "NO_FILTER" with None in a filter dict.
    """
    if isinstance(obj, dict):
        new_obj = {}
        for k, v in obj.items():
            if isinstance(v, str) and v == "NO_FILTER":
                new_obj[k] = None
            else:
                new_obj[k] = _filter_out_no_filter(v)
        return new_obj
    elif isinstance(obj, list):
        return [_filter_out_no_filter(item) for item in obj]
    elif isinstance(obj, str) and obj == "NO_FILTER":
        return None
    else:
        return obj

def example_self_query_postgres(user_query: str, filters: dict = None):
    """
    Uses SelfQueryRetriever with PostgresVector and dynamic metadata filters.

    Args:
        user_query: The natural language query from the user.
        filters: Dict of metadata filters (e.g., knowledge_id, library_id, user_id).

    Returns:
        dict: A dictionary containing the query and results or an error message.
    """
    try:
        retriever, vectorstore = get_self_query_retriever_postgres()
        if not retriever:
            return {"error": "Failed to initialize retriever."}

        # Patch filters: replace $contain with $ilike
        patched_filters = _replace_contain_with_ilike(filters) if filters else None

        # Remove/replace "NO_FILTER" with None
        if patched_filters:
            patched_filters = _filter_out_no_filter(patched_filters)
            # If the filter is just "NO_FILTER" or None, set to None
            if patched_filters == "NO_FILTER" or patched_filters is None:
                patched_filters = None

        # Pass patched filters to retriever.invoke if present
        if patched_filters:
            results = retriever.invoke(user_query, filters=patched_filters)
        else:
            results = retriever.invoke(user_query)

        formatted_results = []
        for doc in results:
            metadata = doc.metadata if hasattr(doc, 'metadata') else {}
            formatted_results.append({
                "content": doc.page_content if hasattr(doc, 'page_content') else str(doc),
                "metadata": metadata
            })

        return {"query": user_query, "results": formatted_results}
    except Exception as e:
        logger.error(f"Error during self-query execution with PostgresVector: {e}", exc_info=True)
        return {"error": "An error occurred during the query process."}
