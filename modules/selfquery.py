import logging
import os

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

    prompt = (
        f"You are an AI assistant helping users explore a knowledge base.\n",
        f"Context: {context_str}\n",
        f"Generate 6 diverse, interesting, and helpful questions a user might want to ask about this knowledge/library. ",
        f"Questions should cover summary, recent content, topics, authors, languages, catalogs, categories, groups, product, and brand. ",
        f"{language_instruction}",
        f"Return ONLY a JSON array of 6 questions, e.g.:\n",
        f'["Question 1?", "Question 2?", ...]',
        f"Do not include any explanations or extra text.",
    )

    logger.info(f"[self-retriever-questions] LLM prompt context: {context_str}")

    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        logger.info(f"[self-retriever-questions] LLM raw response: {response.content}")
        import json
        questions = []
        try:
            # Try to parse as JSON array
            questions = json.loads(response.content)
        except Exception:
            # Fallback: extract lines ending with '?'
            questions = [line.strip() for line in response.content.split('\n') if line.strip().endswith('?')]
        # Ensure we have 6 questions
        questions = [q for q in questions if q]
        if len(questions) < 6:
            # Pad with generic questions if needed
            while len(questions) < 6:
                questions.append("What else can I learn from this knowledge/library?")
        return jsonify({"questions": questions[:6]}), 200, {'Content-Type': 'application/json'}
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

def get_self_query_retriever_postgres():
    """
    Sets up and returns a SelfQueryRetriever using PGVector.
    SQLite version - returns None since PGVector is not available.
    """
    logger.warning("PGVector is not available in SQLite version. SelfQueryRetriever for PostgreSQL is disabled.")
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
