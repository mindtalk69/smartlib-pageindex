import os
import folium
import base64 # For encoding map image
import io # For image bytes
from geopy.geocoders import Nominatim
from modules.llm_utils import get_llm, get_embedding_function, get_lc_store_path, get_active_language_name
from langchain_community.tools import GoogleSerperResults
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage
import json
import re
from langchain_core.tools import tool, Tool # Keep Tool
from modules.database import MessageHistory as DB_MessageHistory, db # For DB ops
# Remove create_react_agent_lc as we'll use direct LLM binding
from langchain import hub
from langchain_core.agents import AgentAction, AgentFinish # Import Pydantic BaseModel and Field
from langchain_core.documents import Document # Import Pydantic BaseModel and Field
from langgraph.graph import StateGraph, END
from modules.callbacks import UsageMetadataCallbackHandler # Import Usage Callback from our new file
from pydantic import BaseModel, Field # Import Pydantic BaseModel and Field
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode
from langchain.chains.query_constructor.base import AttributeInfo
#import pandas as pd # For type hinting active_dataframe
from langchain.retrievers.self_query.base import SelfQueryRetriever
from langchain_openai import AzureChatOpenAI
from langchain_chroma import Chroma

try:
    from chromadb.errors import InternalError as ChromaInternalError
except ImportError:  # pragma: no cover - optional dependency guard
    ChromaInternalError = None

agent_db_session = db.session

from dotenv import load_dotenv
from typing import TypedDict, Optional, Tuple, List, Dict, Any, Callable, Annotated, Sequence, Union, TypedDict
import operator
from langchain_postgres.vectorstores import DistanceStrategy # Import DistanceStrategy
from langgraph.errors import GraphInterrupt # Import GraphInterrupt
import asyncio # Keep asyncio
import logging
from uuid import uuid4 # Import uuid4
from threading import Lock


# Import shared RAG field info and filter patching from selfquery.py
from modules.selfquery import (
    metadata_field_info,
    document_content_description,
    get_self_query_retriever_postgres,
    _replace_contain_with_ilike,
    _filter_out_no_filter,
)
from langchain_core.messages import ToolCall, AIMessage, ToolMessage # Import ToolMessage
from langchain_core.prompts import PromptTemplate
from langgraph.checkpoint.base import Checkpoint # Import Checkpoint for resume
from langchain_core.output_parsers.json import JsonOutputParser
from pathlib import Path # Add Path for directory handling
from toolkits.pandas_tools import load_data_to_dataframe, get_pandas_repl_tool # Import pandas tools
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from webdriver_manager.chrome import ChromeDriverManager

import time # For adding delays
import io # For DataFrame info buffer
from .dataframe_agent import create_dataframe_agent_graph, DataFrameAgentState # Import new agent

from .evidence_utils import get_visual_info_for_chunk # Import from your new module

# --- HIL Confirmation Tracking ---

_hil_confirmed_threads: set[str] = set()
_hil_confirmed_lock = Lock()

def _mark_thread_hil_confirmed(thread_id: Optional[str]) -> None:
    if not thread_id:
        return
    thread_key = str(thread_id)
    with _hil_confirmed_lock:
        _hil_confirmed_threads.add(thread_key)

def _consume_thread_hil_confirmation(thread_id: Optional[str]) -> bool:
    if not thread_id:
        return False
    thread_key = str(thread_id)
    with _hil_confirmed_lock:
        if thread_key in _hil_confirmed_threads:
            _hil_confirmed_threads.remove(thread_key)
            return True
    return False

# --- State Definitions ---

class RAGAgentState(TypedDict):
    input: str
    chat_history: List[BaseMessage]
    messages: Annotated[Sequence[BaseMessage], operator.add]
    intermediate_steps: Annotated[Sequence[Tuple[AgentAction, str]], operator.add]
    vector_store_config: dict
    retrieved_context: List[Document]
    final_answer: Optional[str]
    structured_query: Optional[str]
    formatted_response: Optional[Dict[str, Any]]
     # Add keys for adaptive RAG
    grade_decision: Optional[str] # 'yes' or 'no' based on document relevance
    generation_context_source: Optional[str] # 'retrieved' or 'web_search' or 'none'
    search_results: Optional[str] # To store web search results if needed
    error: Optional[str]
    image_base64: Optional[str] # New: For multimodal input
    image_mime_type: Optional[str] # New: MIME type for the image
    usage_metadata: Optional[dict] # Add key for token usage
    
class SupervisorState(TypedDict):   
    input: str
    chat_history: List[BaseMessage]
    vector_store_config: dict
    messages: Annotated[Sequence[BaseMessage], operator.add] # <<< ADD THIS LINE
    next: Optional[str] 
    # --- MODIFIED: Image state handling ---
    current_turn_image_base64: Optional[str] # Image provided in the current API call
    current_turn_image_mime_type: Optional[str]
    persisted_image_base64: Optional[str] # Image from a previous turn in the conversation
    persisted_image_mime_type: Optional[str]
    # --- END MODIFICATION ---
    agent_output: Optional[Any]
    # These fields are for passing uploaded file info to the appropriate agent (e.g., DataFrame_Agent)
    uploaded_file_content: Optional[str]
    uploaded_file_type: Optional[str]
    uploaded_file_name: Optional[str] # To store the original filename
    # Persist DataFrame Agent's key state here for conversation continuity
    df_agent_active_dataframe_json: Optional[str] 
    df_agent_is_active_session: Optional[bool] # New: Track if a DF session is ongoing
    df_agent_dataframe_summary: Optional[str]
     # Store multiple loaded DataFrames
    loaded_dataframes: Optional[Dict[str, Dict[str, Any]]] # Key: df_id, Value: {"json": str, "summary": str, "name": str, "columns": List[str], "dtypes": Dict[str,str]}
    active_dataframe_id: Optional[str] # ID of the currently active one for DataFrame_Agent tools
    df_agent_is_active_session: Optional[bool] # True if any DF is loaded and active
    current_turn_usage_metadata: Optional[Dict[str, Any]] # To store usage for the current interaction
    thread_id: Optional[str]

# DataFrameAgentState is now imported from dataframe_agent.py
# class DataFrameAgentState(TypedDict):
#     input: str
#     chat_history: List[BaseMessage] 
#     messages: Annotated[Sequence[BaseMessage], operator.add] 
#     uploaded_file_content: Optional[str] 
#     uploaded_file_type: Optional[str]    
#     active_dataframe_json: Optional[str] 
#     dataframe_summary: Optional[str]     
#     final_answer: Optional[str]          


if os.getenv('SERPER_API_KEY'):
    search = GoogleSerperResults()
else:
    search = None
from flask import current_app, url_for, has_request_context


# --- Helper function for map image generation ---
def _generate_map_image_and_link(folium_map: folium.Map, map_filename_prefix: str = "map") -> Dict[str, Optional[str]]:
    """
    Saves a Folium map to HTML, generates a PNG image, base64 encodes it,
    and returns a dictionary with link, image data, and MIME type.
    """
    map_filename_html = f"{map_filename_prefix}_{uuid4()}.html"
    map_output_dir = Path(current_app.config.get('MAP_PUBLIC_DIR', os.path.join(current_app.root_path, 'static', 'maps')))
    map_output_dir.mkdir(parents=True, exist_ok=True)
    save_path_html = map_output_dir / map_filename_html

    folium_map.save(str(save_path_html))

    try:
        if has_request_context():
            map_url_html = url_for('serve_generated_map', filename=map_filename_html, _external=False)
        else:
            raise RuntimeError("No request context available for url_for")
    except RuntimeError as url_exc:
        base_url = current_app.config.get('EXTERNAL_BASE_URL')
        if base_url:
            map_url_html = f"{base_url.rstrip('/')}/generated-maps/{map_filename_html}"
        else:
            map_url_html = f"/generated-maps/{map_filename_html}"
        logging.debug(
            "Falling back to manual generated-map URL for %s due to %s",
            map_filename_html,
            url_exc,
        )

    logging.info(f"Saved HTML map to {save_path_html}, URL: {map_url_html}")

    map_image_base64 = None
    map_image_mime_type = None
    if current_app.config.get('MAP_GENERATE_PNG', True):
        try:
            chrome_options = ChromeOptions()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--window-size=800,700")
            chrome_options.add_argument("--hide-scrollbars")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")

            driver = webdriver.Chrome(
                service=ChromeService(ChromeDriverManager().install()),
                options=chrome_options,
            )
            try:
                driver.get(f"file:///{save_path_html.resolve()}")
                time.sleep(2)
                img_data_bytes = driver.get_screenshot_as_png()
            finally:
                driver.quit()

            map_image_base64 = base64.b64encode(img_data_bytes).decode('utf-8')
            map_image_mime_type = "image/png"
            logging.info(f"Successfully generated PNG image for map {map_filename_html}.")
        except Exception as e:
            logging.error(f"Failed to generate PNG image for map {map_filename_html}: {e}", exc_info=True)
            logging.warning("Ensure Selenium and a webdriver (geckodriver/chromedriver) are installed and in your PATH.")
    else:
        logging.info("MAP_GENERATE_PNG disabled; skipping PNG generation for map %s.", map_filename_html)

    markdown_link = f'<a href="{map_url_html}" target="_blank" rel="noopener">Open Interactive Map</a>'
    return {
        "map_link": markdown_link,
        "map_image_base64": map_image_base64,
        "map_image_mime_type": map_image_mime_type,
        "html_map_url": map_url_html
    }
    
@tool("get_latitude_longitude_by_name_place")
def get_latitude_longitude_by_name_place(place_name:str) -> Tuple[float, float]:
    """Gets the latitude and longitude coordinates for a given place name (e.g., city, landmark, region)."""
    try:
        geolocator = Nominatim(user_agent="flaskrag3_map_tool")
        location = geolocator.geocode(place_name)
        if location:
            logging.info(f"Geocoded '{place_name}' to ({location.latitude}, {location.longitude})")
            return location.latitude, location.longitude
        else:
            logging.warning(f"Could not geocode place name: {place_name}")
            raise ValueError(f"Could not find coordinates for '{place_name}'.")
    except Exception as e:
        logging.error(f"Error during geocoding for '{place_name}': {e}")
        raise ValueError(f"Error finding coordinates: {e}")

@tool("generate_map_link")
def generate_map_link(latitude: float, longitude: float) -> Dict[str, Optional[str]]:
    """
    Generates an interactive map centered at the given latitude and longitude,
    saves it to the static folder, generates a PNG image, and returns a dictionary
    containing the markdown link, base64 encoded image, and image MIME type.
    """
    try:
        mymap = folium.Map(location=[latitude, longitude], zoom_start=13)
        folium.Marker([latitude, longitude], popup=f"Lat: {latitude}, Lon: {longitude}").add_to(mymap)
        return _generate_map_image_and_link(mymap, map_filename_prefix=f"map_{latitude}_{longitude}")
    except Exception as e:
        logging.error(f"Error generating or saving map: {e}", exc_info=True)
        # Return dict with error indication or None for image fields
        return {"map_link": "Error: Could not generate map.", "map_image_base64": None, "map_image_mime_type": None, "html_map_url": None}

@tool("generate_map_link_by_string_coordinates")
def generate_map_link_by_string_coordinates(string_coordinates: str) -> Dict[str, Optional[str]]:
    """
    Generates an interactive map centered at the given latitude and longitude,
    saves it to the static folder, and returns a markdown link to view it.
    """
    # --- Define Map Tools ---
    from modules.map_utils import parse_dms_string
    
    try:
       latitude, longitude = parse_dms_string(string_coordinates)
       mymap = folium.Map(location=[latitude, longitude], zoom_start=13)
       folium.Marker([latitude, longitude], popup=f"Lat: {latitude}, Lon: {longitude}").add_to(mymap)
       return _generate_map_image_and_link(mymap, map_filename_prefix=f"map_coords_{uuid4().hex[:6]}")
    except Exception as e:
        logging.error(f"Error generating or saving map: {e}", exc_info=True)
        return {"map_link": "Error: Could not generate map from string coordinates.", "map_image_base64": None, "map_image_mime_type": None, "html_map_url": None}

llm = None
llm_with_map_tools = None # <<< Define globally, initialize as None
llm_initialized = False # Flag to track initialization
map_tools = [get_latitude_longitude_by_name_place, generate_map_link, generate_map_link_by_string_coordinates]


SYS_MSG_SUPERVISOR = """You are a supervisor routing queries to specialized agents. Available agents:
1. RAG_Agent: For questions requiring information from our document database (e.g., product specs, manuals, company policies).
2. DataFrame_Agent: For analyzing uploaded files (CSV, Excel) or pasted tabular data. Use this if the query involves summarizing, filtering, or asking questions about a data table provided by the user.
3. Map_Agent: ONLY for requests to display a map, get coordinates for a place, or use string coordinates to show a map.
4. Search_Agent: ONLY for general knowledge not in our documents and not related to maps or data file analysis.
5. ChitChat_Agent: For casual conversation, greetings, or simple non-factual interactions.


STRICT ROUTING RULES:
1. Route to RAG_Agent if query is about documents/knowledge base OR if an image is provided for analysis:
   - Query mentions any document, or knowledge base content (unless it's a data file explicitly for analysis by DataFrame_Agent).
   - Query contains product/model names (e.g., "Kijang", "Zenix", "Voxy") and asks for stored information about them.
   - Query could potentially be answered by our internal documents.
   - An image is provided with the query and the user asks to describe, analyze, or understand the image.
   - Example: "All-New Kijang specs" → RAG_Agent
   - Example: "API documentation" → RAG_Agent
   - Example: "What is this a picture of?" (with image) → RAG_Agent

2. ONLY route to Map_Agent when:
   - Query explicitly asks for a map, location, latitude, or longitude
   - Example: "show map of Jakarta", "coordinates for Eiffel Tower" -> Map_Agent 
   - When query contains text latitude or langitude coordinates, use generate_map_link_by_string_coordinates tool -> Map_Agent
   - Example: display Coordinates: Latitude 05° 55' 13" S, Longitude 107° 42' 38" E" -> Map_Agent

3. Route to DataFrame_Agent if:
   - User asks to analyze an uploaded file (e.g., "analyze this CSV", "what's in this Excel file?"). This is high priority if a file was just uploaded.
   - User asks to analyze pasted table data.
           - **A DataFrame session is currently active (the system state indicates `df_agent_is_active_session` is true). If the query asks to find, count, list, filter, calculate, or describe something that could plausibly exist within tabular data (e.g., mentions columns, values, departments, employees, sales, products within the data), YOU MUST PRIORITIZE DataFrame_Agent.**
   - The user's query is an explicit follow-up question about data that was just analyzed by the DataFrame_Agent (e.g., "now find...", "what about...").
   - Example: "Summarize the attached CSV" → DataFrame_Agent
   - Example: "What are the top products in this pasted data?" → DataFrame_Agent
   - Example (follow-up): "Now find the average price." (after a CSV was analyzed) → DataFrame_Agent
   - Example (follow-up, if DF session active): "What about the maximum?" → DataFrame_Agent
   - Example (follow-up, if DF session active): "oldest person in this data?" → DataFrame_Agent

4. ONLY route to Search_Agent when:
   - Query is clearly about external/public knowledge
   - Explicitly requests web/search results
   
5. Examples:
   - Completely unrelated to our documents, data file analysis, or map requests.
   - "current weather" → Search_Agent
   - "current weather in London" → Search_Agent
5. Route to ChitChat_Agent for:
   - "hi" → ChitChat_Agent

IMPORTANT: When in doubt, ALWAYS choose RAG_Agent over Search_Agent.
If the user provides a file (CSV/Excel) or pastes data for analysis, route to DataFrame_Agent.
Respond ONLY with the agent name (RAG_Agent, DataFrame_Agent, Map_Agent, Search_Agent, or ChitChat_Agent)."""

REACT_AGENT_PROMPT = hub.pull("hwchase17/react")

# --- Function to Initialize LLMs ---
def initialize_llms():
    """Initializes the global llm and llm_with_map_tools variables."""
    global llm, llm_with_map_tools, llm_initialized
    if llm_initialized:
        return

    from flask import current_app
    with current_app.app_context():
        try:
            print("Initializing LLM (streaming-enabled)...")
            llm = get_llm(streaming=True)
            print("LLM Initialized.")
            # Bind map tools immediately after base LLM is ready
            llm_with_map_tools = llm.bind_tools(map_tools)
            print("LLM with Map Tools Initialized.")
            llm_initialized = True
        except Exception as e:
            logging.error(f"FATAL: Error initializing LLMs: {e}", exc_info=True)
            raise RuntimeError("Failed to initialize LLMs.") from e



# Define input schema for the tool using Pydantic
class RetrieveContextInput(BaseModel): # No PydanticField alias needed here if Field is from pydantic
    query: str = Field(description="The user query to retrieve context for")
    config: dict = Field(default={}, description="Configuration dictionary for vector store access")

# LoadDataInput and load_data_to_active_dataframe_tool are now in dataframe_agent.py

def _build_explicit_metadata_filters(config: dict) -> dict:
    """Build guaranteed metadata filters from config."""
    filters = {}
    if config.get('knowledge_id'):
        filters['knowledge_id'] = int(config['knowledge_id'])
    if config.get('library_id'):
        filters['library_id'] = int(config['library_id'])
    if config.get('category_id'):
        filters['category_id'] = int(config['category_id'])
    
    logging.info(f"[RAG Filter] Built explicit filters: {filters}")
    return filters

def perform_retrieval(query: str, tool_call_config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute vector store retrieval using the provided configuration."""
    start_time = time.perf_counter()
    retrieval_mode = "unknown"

    vector_provider = current_app.config.get('VECTOR_STORE_PROVIDER', 'chromadb')
    app_default_vector_store_mode = current_app.config.get('VECTOR_STORE_MODE', 'user')

    logging.info(
        f"--- Retrieving context for query: '{query}' with tool_call_config: {tool_call_config}, "
        f"configured VECTOR_STORE_PROVIDER: {vector_provider}, "
        f"app_default_vector_store_mode: {app_default_vector_store_mode} ---"
    )

    user_id = tool_call_config.get('user_id')
    knowledge_id = tool_call_config.get('knowledge_id')
    library_id = tool_call_config.get('library_id')
    mode_for_operation = tool_call_config.get('mode', app_default_vector_store_mode)
    search_strategy = tool_call_config.get('search_strategy', 'similarity')
    k_docs = tool_call_config.get('k', 4)

    embed_func = get_embedding_function()
    llm_instance = get_llm()

    store = None
    if vector_provider == 'pgvector':
        from langchain_postgres import PGVector
        connection_string = current_app.config.get('PGVECTOR_CONNECTION_STRING')
        collection_name = current_app.config.get('PGVECTOR_COLLECTION_NAME', 'langchain_vectors')
        if not connection_string:
            logging.error("PGVECTOR_CONNECTION_STRING not configured.")
            return {"documents": [], "structured_query": "PGVector not configured.", "error": "PGVector not configured."}

        logging.info(f"[PGVector DEBUG] Using connection: {connection_string[:30]}..., collection: {collection_name}")
        try:
            store = PGVector(
                connection_string=connection_string,
                embeddings=embed_func,
                collection_name=collection_name,
                use_jsonb=True,
                distance_strategy=DistanceStrategy.COSINE
            )
        except Exception as e:
            logging.error(f"[PGVector DEBUG] Error initializing PGVector: {e}")
            return {"documents": [], "structured_query": "Error initializing PGVector.", "error": str(e)}
    elif vector_provider == 'chromadb':
        mode_to_pass = None
        if knowledge_id:
            mode_to_pass = 'knowledge'
        elif mode_for_operation == 'global':
            mode_to_pass = 'global'
        elif library_id and not user_id:
            mode_to_pass = None
        elif user_id:
            mode_to_pass = 'user'
        else:
            mode_to_pass = mode_for_operation

        persist_dir = get_lc_store_path(user_id, knowledge_id, mode_to_pass)
        if not persist_dir or not os.path.exists(persist_dir):
            logging.warning(f"Chroma directory not found or path is None: {persist_dir}. Retrieval will likely fail.")
            return {
                "documents": [],
                "structured_query": "Vector store not found.",
                "error": f"Vector store not found at {persist_dir}."
            }
        chroma_collection_name = current_app.config.get('CHROMA_COLLECTION_NAME', 'documents-vectors')
        import re

        def sanitize_collection_name(name: str) -> str:
            cleaned = name.strip()
            cleaned = re.sub(r'\s+', '_', cleaned)
            if not re.match(r'^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{1,510}[a-zA-Z0-9])$', cleaned):
                raise ValueError(f"Invalid Chroma collection name: {cleaned}")
            return cleaned

        if chroma_collection_name:
            chroma_collection_name = sanitize_collection_name(chroma_collection_name)

        chroma_kwargs = {
            "embedding_function": embed_func,
            "persist_directory": str(persist_dir),
            "collection_name": chroma_collection_name,
        }
        store = Chroma(**chroma_kwargs)
    else:
        logging.error(f"Unsupported VECTOR_STORE_PROVIDER: {vector_provider}")
        return {"documents": [], "structured_query": "Unsupported vector store provider.", "error": f"Unsupported vector store provider: {vector_provider}"}

    explicit_filters = _build_explicit_metadata_filters(tool_call_config)
    has_explicit_filters = bool(explicit_filters)

    structured_query_string = "Direct similarity search with explicit filters" if has_explicit_filters else "SelfQueryRetriever with LLM-generated filters"

    try:
        if has_explicit_filters:
            logging.info(f"[RAG] Using DIRECT similarity search with guaranteed filters: {explicit_filters}")
            retrieval_mode = "direct_filters"

            if vector_provider == 'pgvector':
                search_kwargs = {'k': k_docs, 'filter': explicit_filters}
            elif vector_provider == 'chromadb':
                if len(explicit_filters) > 1:
                    chroma_filter = {'$and': [{k: v} for k, v in explicit_filters.items()]}
                else:
                    chroma_filter = explicit_filters
                search_kwargs = {'k': k_docs, 'filter': chroma_filter}

            if vector_provider == 'chromadb' and ChromaInternalError is not None:
                max_attempts = 2
                for attempt in range(1, max_attempts + 1):
                    try:
                        retrieved_docs = store.similarity_search(query, **search_kwargs)
                        break
                    except ChromaInternalError as chroma_exc:
                        logging.warning(
                            "[RAG] Chroma InternalError during similarity_search (attempt %s/%s): %s",
                            attempt,
                            max_attempts,
                            chroma_exc,
                        )
                        if attempt == max_attempts:
                            raise
                        time.sleep(0.4)
                        store = Chroma(**chroma_kwargs)
                else:
                    retrieved_docs = []
            else:
                retrieved_docs = store.similarity_search(query, **search_kwargs)

            structured_query_string = f"Direct search with filters: {explicit_filters}"

            logging.info(f"[RAG] Direct search retrieved {len(retrieved_docs)} documents")

            if retrieved_docs:
                for i, doc in enumerate(retrieved_docs[:2]):
                    logging.info(
                        f"[RAG] Doc {i+1}: source={doc.metadata.get('source')}, "
                        f"knowledge_id={doc.metadata.get('knowledge_id')}, "
                        f"library_id={doc.metadata.get('library_id')}"
                    )

        else:
            logging.info(f"[RAG] Using SelfQueryRetriever (no explicit filters in config)")
            retrieval_mode = "self_query"

            if llm_instance is None:
                raise ValueError("LLM instance is None, cannot initialize SelfQueryRetriever.")

            retriever = SelfQueryRetriever.from_llm(
                llm=llm_instance,
                vectorstore=store,
                document_contents=document_content_description,
                metadata_field_info=metadata_field_info,
                verbose=True,
                use_original_query=True,
                search_kwargs={'k': k_docs}
            )

            try:
                structured_query_dict = retriever.query_constructor.invoke({"query": query})
                structured_query_string = str(structured_query_dict)
                logging.info(f"[RAG] SelfQueryRetriever generated: {structured_query_string}")
            except Exception as sq_err:
                logging.warning(f"[RAG] Failed to generate structured query: {sq_err}")
                structured_query_string = "SelfQueryRetriever (no structured query generated)"

            retrieved_docs = retriever.invoke(query)
            logging.info(f"[RAG] SelfQueryRetriever retrieved {len(retrieved_docs)} documents")

        if has_explicit_filters and retrieved_docs:
            mismatched = []
            for doc in retrieved_docs:
                for filter_key, filter_value in explicit_filters.items():
                    if doc.metadata.get(filter_key) != filter_value:
                        mismatched.append(doc)
                        logging.warning(
                            f"[RAG] Filter mismatch! Expected {filter_key}={filter_value}, "
                            f"got {doc.metadata.get(filter_key)} in doc from {doc.metadata.get('source')}"
                        )

            if mismatched:
                logging.error(f"[RAG] {len(mismatched)}/{len(retrieved_docs)} documents failed filter validation!")

        duration = time.perf_counter() - start_time
        logging.info(
            "[RAG] Retrieval path=%s finished in %.2fs with %d docs. Structured query: %s",
            retrieval_mode,
            duration,
            len(retrieved_docs) if 'retrieved_docs' in locals() else 0,
            structured_query_string,
        )

        return {
            "documents": retrieved_docs,
            "structured_query": structured_query_string
        }

    except Exception as e:
        duration = time.perf_counter() - start_time
        logging.error(f"[RAG] Error during retrieval after {duration:.2f}s: {e}", exc_info=True)
        return {
            "documents": [],
            "structured_query": f"Error: {str(e)}",
            "error": str(e)
        }


@tool("retrieve_context", args_schema=RetrieveContextInput)
# Modify signature to accept keyword arguments matching the schema fields
def retrieve_context_tool(query: str, config: dict = None) -> Dict[str, Any]:
    """
    Retrieves relevant context from the appropriate vector store based on the provided configuration.
    Handles self-query translation internally before searching.

    Args:
        query (str): The user query to retrieve context for.
        config (dict, optional): Configuration dictionary for vector store access. Defaults to {}.

    Returns:        
        Dict[str, Any]: A dictionary containing 'documents' (List[Document]) and 'structured_query' (str).
    """
    logging.info("--- ENTERING retrieve_context_tool ---")
    tool_call_config = config or {}
    return perform_retrieval(query, tool_call_config)

# --- RAG Agent and Supervisor Graphs ---

def _sum_usage_metadata(usage1: Optional[Dict], usage2: Optional[Dict]) -> Dict:
    """Safely sums two usage metadata dictionaries."""
    if not usage1: return usage2 or {}
    if not usage2: return usage1 or {}

    # Assume they have the same model, or prioritize the second one's model name
    summed_usage = {
        "model": usage2.get("model", usage1.get("model")),
        "input_tokens": (usage1.get("input_tokens", 0) or 0) + (usage2.get("input_tokens", 0) or 0),
        "output_tokens": (usage1.get("output_tokens", 0) or 0) + (usage2.get("output_tokens", 0) or 0),
    }
    return summed_usage

def update_persisted_image_node(state: SupervisorState):
    """Updates the persisted image state for the next turn."""
    logging.debug("--- Updating Persisted Image State ---")
    # If there was an image in the current turn, it becomes the persisted image for the next turn.
    # If there was no image in the current turn, we keep the existing persisted image.
    if state.get("current_turn_image_base64"):
        logging.info(f"[State Update] Persisting image from current turn for conversation.")
        return {
            "persisted_image_base64": state["current_turn_image_base64"],
            "persisted_image_mime_type": state["current_turn_image_mime_type"],
        }
    logging.debug("[State Update] No new image in current turn, keeping existing persisted image.")
    return {}


rag_graph = None
compiled_supervisor_graph = None
_graph_built = False

#--- Helper function to get active image for the current turn ---
def get_active_image_for_turn(state: SupervisorState, config: Optional[dict] = None) -> Tuple[Optional[str], Optional[str]]:
    # Priority:
    # 1. Image explicitly passed for resume via config (if resuming and new image provided)
    # 2. Image explicitly passed for the current turn via state.current_turn_image_base64
    # 3. Image persisted from a previous turn via state.persisted_image_base64

    config = config or {}
    configurable_section = config.get("configurable") or {}

    # Check resume config first
    resume_image_base64 = configurable_section.get("image_base64")
    resume_image_mime_type = configurable_section.get("image_mime_type")
    if resume_image_base64 and resume_image_mime_type:
        logging.debug("Using image from resume_config.")
        return resume_image_base64, resume_image_mime_type

    # Check current turn's explicit image
    current_turn_image_base64 = state.get("current_turn_image_base64")
    current_turn_image_mime_type = state.get("current_turn_image_mime_type")
    if current_turn_image_base64 and current_turn_image_mime_type:
        logging.debug("Using image from current_turn_image_base64.")
        return current_turn_image_base64, current_turn_image_mime_type

    # Fallback to persisted image from previous turns
    persisted_image_base64 = state.get("persisted_image_base64")
    persisted_image_mime_type = state.get("persisted_image_mime_type")
    if persisted_image_base64 and persisted_image_mime_type:
        logging.debug("Using image from persisted_image_base64.")
        return persisted_image_base64, persisted_image_mime_type

    logging.debug("No active image found for the turn.")
    return None, None


async def _generate_follow_up_questions(query_text, answer_text, context_docs, chat_history):
    """Generate follow-up questions based on the conversation context and answer."""
    try:
        llm_instance = get_llm()
        logging.info(f"Calling LLM to generate follow-up questions for: {query_text}")
        language = get_active_language_name()
        
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

        response = await llm_instance.ainvoke(messages)
        response_text = response.content
        logging.info(f"Raw LLM response for follow-up questions: {response_text}")

        try:
            if not response_text.strip().startswith('['):
                json_match = re.search(r'[(.*?)](.*?)', response_text, re.DOTALL)
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
                clean_line = line.lstrip('0123456789.- \'"').rstrip('"').strip()
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


def build_supervisor_graph():

    global llm, rag_agent_runnable, rag_graph, compiled_supervisor_graph, _graph_built
    global llm_with_map_tools # <<< Use global keyword
    # llm_with_map_tools will be initialized by initialize_llms() to avoid binding before LLM is ready.
    # --- Create ToolNode for Map Tools ---
    map_tool_node = ToolNode(map_tools)
    # --- END Bind Map tools ---

    if _graph_built:
        return compiled_supervisor_graph

    print("--- Building Supervisor Graph ---")
    #load_dotenv(dotenv_path='.env.dev', override=True)
    initialize_llms()
    try:
        # --- Store the decorated function directly ---
        
        # Import the standard tools_condition
        from langgraph.prebuilt import tools_condition
        
        # --- Adaptive RAG: Grading Prompt ---
        GRADE_DOCUMENTS_PROMPT = """You are a grader assessing document relevance for a RAG system. 
        Be STRICT - only consider documents relevant if they DIRECTLY help answer the question.

        Document Content:
        {context}

        Question:
        {question}

            If the question is about analyzing an uploaded table or data (e.g. from a CSV/Excel file), and the document content appears to be that table data or a part of it, score as RELEVANT ('yes').
            Otherwise, score as RELEVANT ('yes') ONLY if:
            - The document directly answers the question or a key part of it.
            - The document contains specific facts/data needed to answer the question.
            - The document provides exact matches for product/model names mentioned in the question.
            - The document is from an authoritative source on this topic.
            
        Score as NOT RELEVANT ("no") if:
        - Only tangentially related
        - Provides only background/context without specifics
        - Contains similar terms but no direct answer
        - Is outdated or from unreliable source
        - You're unsure (default to no)

        Return JSON: {{"score":"yes|no","reason":"brief explanation"}}
        """
                
        # Define the list of tools for the RAG agent
        # This will be dynamic based on state (active_dataframe)

        def get_dynamic_rag_tools(state: RAGAgentState):
            """Gets tools for the RAG agent, including dynamic Pandas tools if a DataFrame is active."""
            return [retrieve_context_tool] # RAG Agent now only has the retrieve_context tool
    
    
        def execute_tool_call(tool_call: dict, state: RAGAgentState) -> Dict[str, Any]:
            """Deterministic executor for a single tool call.
            Returns a dict: {success: bool, tool_message: ToolMessage (if available), result: tool result (usually dict/list/str), error: Optional[str]}
            This centralizes merging of vector_store_config for `retrieve_context` and provides consistent ToolMessage creation.
            """
            tool_name = tool_call.get("name")
            tool_args = tool_call.get("args", {}) or {}
            tool_id = tool_call.get("id")
    
            # Build tool map from dynamic RAG tools and global map_tools
            available_tools = get_dynamic_rag_tools(state) + map_tools
            tool_map = {t.name: t for t in available_tools}
    
            if tool_name not in tool_map:
                return {"success": False, "error": f"Tool '{tool_name}' not available.", "tool_message": None}
    
            tool_object = tool_map[tool_name]
            try:
                # Special handling for retrieve_context: inject vector_store_config from RAGAgentState
                if tool_name == "retrieve_context":
                    if not isinstance(tool_args, dict):
                        tool_args = {}
                    current_vsc = state.get("vector_store_config", {}) or {}
                    cfg = tool_args.get("config") if isinstance(tool_args.get("config"), dict) else {}
                    for key_to_inject in ['user_id', 'knowledge_id', 'library_id', 'mode']:
                        if key_to_inject in current_vsc and current_vsc[key_to_inject] is not None:
                            cfg[key_to_inject] = current_vsc[key_to_inject]
                    tool_args['config'] = cfg
                    result = tool_object.func(**tool_args)
                    tm = ToolMessage(content=result, tool_call_id=tool_id, name=tool_name)
                    return {"success": True, "tool_message": tm, "result": result, "error": None}
    
                # Generic tool invocation (expect dict args)
                if isinstance(tool_args, dict):
                    result = tool_object.func(**tool_args)
                else:
                    # Fallback if args are not a dict (older tool formats)
                    result = tool_object.run(tool_args)
    
                tm = ToolMessage(content=result, tool_call_id=tool_id, name=tool_name)
                return {"success": True, "tool_message": tm, "result": result, "error": None}
    
            except Exception as e:
                logging.error(f"Error executing tool '{tool_name}': {e}", exc_info=True)
                return {"success": False, "error": str(e), "tool_message": ToolMessage(content=f"Error executing tool '{tool_name}': {e}", tool_call_id=tool_id, name=tool_name)}
    
    
        def call_rag_model(state: RAGAgentState, config: Optional[dict] = None): # Added config
            logging.info("--- Calling RAG Model ---")
            config = config or {}
            messages_in_state = state.get('messages', [])
            
            # The context is already in the state from the tool executor
            current_retrieved_context = state.get('retrieved_context', [])
            
            current_tools = get_dynamic_rag_tools(state)
            llm_with_current_tools = llm.bind_tools(current_tools)

            language = get_active_language_name()
            rag_system_prompt_content = f"""Please respond in {language}.
You are a helpful RAG (Retrieval Augmented Generation) assistant.
Your primary purpose is to answer questions based on documents in a knowledge base.
Use the 'retrieve_context' tool to find relevant information.
If an image is provided with the query, consider its content in your response.
Think step-by-step."""

            if not messages_in_state or not isinstance(messages_in_state[0], SystemMessage):
                messages_for_llm = [SystemMessage(content=rag_system_prompt_content)] + messages_in_state
            else:
                messages_for_llm = [SystemMessage(content=rag_system_prompt_content)] + [m for m in messages_in_state if not isinstance(m, SystemMessage)]

            llm_config_for_rag = {"configurable": {"vector_store_config": state['vector_store_config']}}
           
            try:
                llm_start = time.perf_counter()
                logging.info("[RAG] call_rag_model invoking LLM with %d messages", len(messages_for_llm))
                llm_response = llm_with_current_tools.invoke(messages_for_llm, config=llm_config_for_rag)
                llm_elapsed = time.perf_counter() - llm_start
                tool_call_count = len(getattr(llm_response, "tool_calls", []) or [])
                logging.info(
                    "[RAG] LLM invocation finished in %.2fs (tool_calls=%d, ctx_docs=%d)",
                    llm_elapsed,
                    tool_call_count,
                    len(current_retrieved_context) if current_retrieved_context else 0,
                )
            except Exception as e:                 
                logging.error(f"[RAG] Error during llm_with_current_tools.invoke: {e}", exc_info=True)
                raise

            return_value = {"messages": [llm_response]}
            # Pass the context along, it will be used by the generate node
            if current_retrieved_context:
                return_value["retrieved_context"] = current_retrieved_context
            
            return return_value
        
        # --- Adaptive RAG: New Nodes ---
        

        

        # --- Custom Tool Executor Node ---
        def execute_rag_tool(state: RAGAgentState, config: Optional[dict] = None) -> dict: # Added config
            if config is None:
                config = {}
            """Executes tools based on the last AIMessage tool_calls and updates retrieved_context."""
            messages = state['messages']
            last_message = messages[-1]

            # Initialize return values with current state to preserve them if not changed
            updated_state_dict = {
                "messages": [], # ToolMessages will be added here
                "retrieved_context": state.get("retrieved_context"),
                "structured_query": state.get("structured_query"),               
                "error": state.get("error")
            }

            if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
                logging.warning("execute_rag_tool called without AIMessage or tool_calls in last message.")
                # Return current state with no changes to messages if no tool calls
                return {k: v for k, v in updated_state_dict.items() if k != "messages"}

            tool_messages = []
            current_tools_for_execution = get_dynamic_rag_tools(state)
            tool_map = {tool.name: tool for tool in (current_tools_for_execution + map_tools)}
    
            for tool_call in last_message.tool_calls:
                tool_name = tool_call.get("name")
                tool_call_id = tool_call.get("id")
                logging.info(f"--- RAG Tool Executor: Preparing to execute {tool_name} (ID: {tool_call_id}) ---")
    
                # Tools that belong to DataFrame agent - reject here with a clear message
                if tool_name in ("load_data_to_active_dataframe", "PandasDataFrameQueryTool"):
                    logging.warning(f"RAG Agent received call for '{tool_name}', but this tool should be handled by DataFrame_Agent.")
                    tool_messages.append(ToolMessage(content=f"Error: '{tool_name}' is not a RAG agent tool.", tool_call_id=tool_call_id, name=tool_name))
                    updated_state_dict["error"] = f"'{tool_name}' is not a RAG agent tool."
                    continue
    
                # Execute via centralized helper
                exec_res = execute_tool_call(tool_call, state)
    
                if not exec_res.get("success"):
                    err = exec_res.get("error", "Unknown error executing tool")
                    logging.error(f"Error executing tool '{tool_name}': {err}")
                    # exec_res may include a pre-built ToolMessage for error
                    tm = exec_res.get("tool_message")
                    if not isinstance(tm, ToolMessage):
                        tm = ToolMessage(content=f"Error executing tool '{tool_name}': {err}", tool_call_id=tool_call_id, name=tool_name)
                    tool_messages.append(tm)
                    updated_state_dict["error"] = err
                    continue
    
                # Success path
                tm = exec_res.get("tool_message")
                tool_messages.append(tm)
    
                # If retrieve_context produced results, update retrieved_context and structured_query consistently
                if tool_name == "retrieve_context":
                    res = exec_res.get("result", {}) or {}
                    documents = res.get("documents", []) if isinstance(res, dict) else []
                    structured_query_res = res.get("structured_query") if isinstance(res, dict) else None
                    updated_state_dict["retrieved_context"] = documents
                    updated_state_dict["structured_query"] = structured_query_res
    
            updated_state_dict["messages"] = tool_messages
            # Clean out None values before returning to avoid overwriting valid state with None, except for 'messages'
            return {k: v for k, v in updated_state_dict.items() if v is not None or k == "messages"}
        
        def generate(state: RAGAgentState, config: Optional[dict] = None): # Added config
            if config is None:
                config = {}
            """Generates an answer using the relevant context (retrieved docs). Simplified."""
            logging.info("--- Generating Final Answer (Simplified) ---")
            question = state["input"]
            documents = state.get("retrieved_context", [])
            image_base64 = state.get("image_base64")
            image_mime_type = state.get("image_mime_type")
            messages = state.get("messages", [])
            context_source = "none"
            language = get_active_language_name()

            if image_base64 and not documents:
                # Image description case
                logging.info("Generating answer based on image, as no documents were retrieved.")
                generation_prompt_text = f"""Please respond in {language}.
You are a helpful assistant. The user has provided an image and asked a question about it.
Please answer the user's question based on the content of the image.

Question: {question}

Answer:"""
                context_source = "image"
            elif documents:
                logging.info(f"Generating answer using {len(documents)} RETRIEVED documents.")
                context_chunks = [f"Source [{i+1}]:\n{doc.page_content}" for i, doc in enumerate(documents)]
                context_str = "\n\n---\n\n".join(context_chunks)
                context_source = "retrieved"
                generation_prompt_text = f"""Please answer in {language}.
You are a helpful assistant. Answer the user's question based ONLY on the provided sources.
For each piece of information you use from a source, you MUST cite it by adding the source number in brackets, like [1], [2], etc.
If the sources do not contain an answer, state that you could not find the information in the available documents. Do not make up information.

Context:
{context_str}

Question: {question}

Answer:"""
            else:
                logging.warning("Generate called with no relevant documents and no image.")
                context_str = "No relevant information was found in the document database for your query."
                context_source = "none"
                generation_prompt_text = f"""Please answer in {language}.
You are a helpful assistant. Answer the user's question based ONLY on the provided sources.
For each piece of information you use from a source, you MUST cite it by adding the source number in brackets, like [1], [2], etc.
If the sources do not contain an answer, state that you could not find the information in the available documents. Do not make up information.

Context:
{context_str}

Question: {question}

Answer:"""

            llm_message_content = [{"type": "text", "text": generation_prompt_text}]
            if image_base64 and image_mime_type:
                llm_message_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{image_mime_type};base64,{image_base64}"}
                })
            llm_input_message = HumanMessage(content=llm_message_content)
            callback_handler = UsageMetadataCallbackHandler()
            try:
                llm_response = llm.invoke([llm_input_message], config={"callbacks": [callback_handler]})
                usage_metadata = callback_handler.usage_metadata
                logging.info(f"[Generate Node] Captured usage_metadata: {usage_metadata}")
                return_payload = {
                    "messages": messages + [llm_response],
                    "generation_context_source": context_source,
                    "usage_metadata": usage_metadata
                }
            except Exception as gen_e:
                logging.error(f"Error during final answer generation: {gen_e}", exc_info=True)
                llm_response = AIMessage(content=f"Error generating final answer: {gen_e}")
                return_payload = {
                    "messages": messages + [llm_response],
                    "generation_context_source": "none",
                    "usage_metadata": {}
                }
            return return_payload
        
        
         

        
        def format_rag_response(state: RAGAgentState, config: Optional[dict] = None): # Added config
            """Formats response with citations, questions, and multi-modal support"""
            logging.info("--- Formatting RAG Response ---")
            last_message = state['messages'][-1]
            if not isinstance(last_message, AIMessage) or not last_message.content:
                return {"formatted_response": {"answer": "Error: Agent did not finish correctly."}}
            
            final_answer_from_llm = last_message.content
            retrieved_docs = state.get('retrieved_context', [])
            usage_metadata = state.get('usage_metadata', {})
            context_source = state.get('generation_context_source')
            structured_query = state.get('structured_query')
            
            import re

            # Find all unique, 1-based citation numbers used by the LLM (e.g., [1], [2], [5])
            cited_numbers = sorted(list(set(int(m) for m in re.findall(r'\[(\d+)\]', final_answer_from_llm))))

            # Map these original numbers to a new, sequential 1-based index for the final output.
            # e.g., if LLM used [2] and [5], the map is {2: 1, 5: 2}.
            original_to_new_cite_map = {original_num: new_idx + 1 for new_idx, original_num in enumerate(cited_numbers)}

            # Replace the LLM's citations [N] with the frontend's expected format [cite:M]
            def replace_cite_marker(match):
                original_num = int(match.group(1))
                if original_num in original_to_new_cite_map:
                    new_num = original_to_new_cite_map[original_num]
                    return f"[cite:{new_num}]"
                return match.group(0) # Should not happen if regex is correct

            final_answer_raw = re.sub(r'\[(\d+)\]', replace_cite_marker, final_answer_from_llm)

            # Build the citations list for the metadata, using only the documents that were actually cited.
            citations = []
            if context_source == "retrieved" and retrieved_docs:
                for original_num, new_num in original_to_new_cite_map.items():
                    original_doc_idx = original_num - 1 # Convert 1-based to 0-based index
                    if 0 <= original_doc_idx < len(retrieved_docs):
                        doc = retrieved_docs[original_doc_idx]
                        doc_metadata = doc.metadata or {}
                        source_filename = doc_metadata.get("source", "Unknown") 
                        page_number_meta = doc_metadata.get("page_number")
                        text_snippet = doc.page_content[:300] + "..."
                        library_id_from_meta = doc_metadata.get("library_id")
                        document_id_str = doc_metadata.get("doc_id")
                        api_bbox_list = None

                        if document_id_str and page_number_meta is not None:
                            try:
                                page_number_int = int(float(page_number_meta))
                                raw_bbox_obj, page_h = get_visual_info_for_chunk(document_id_str, page_number_int)
                                if raw_bbox_obj and page_h is not None and isinstance(raw_bbox_obj, dict):
                                    if all(k in raw_bbox_obj and isinstance(raw_bbox_obj[k], (int, float)) for k in ['l', 't', 'r', 'b']):
                                        dl_l, dl_t, dl_r, dl_b = raw_bbox_obj['l'], raw_bbox_obj['t'], raw_bbox_obj['r'], raw_bbox_obj['b']
                                        api_x, api_y = float(dl_l), float(page_h - dl_t)
                                        api_width, api_height = float(dl_r - dl_l), float(dl_t - dl_b)
                                        api_bbox_list = [round(v, 4) for v in [api_x, api_y, api_width, api_height]]
                                        logging.info(f"[AgentPy] Successfully created api_bbox_list for citation {new_num}: {api_bbox_list}")
                                    else:
                                        logging.warning(f"[AgentPy] Invalid or incomplete raw_bbox_obj structure from evidence_utils: {raw_bbox_obj}")
                            except Exception as e_vis:
                                logging.error(f"Error processing visual info for doc {document_id_str}, page {page_number_meta}: {e_vis}", exc_info=True)

                        citations.append({
                            "id": new_num,
                            "source": source_filename,
                            "page": page_number_meta,
                            "text_snippet": text_snippet,
                            "document_id": document_id_str,
                            "library_id": library_id_from_meta,
                            "bbox": api_bbox_list
                        })
            
            # Handle multi-modal responses (e.g. maps)
            visual_evidence = []
            if "[map]" in final_answer_raw.lower():
                try:
                    from geopy.geocoders import Nominatim
                    geolocator = Nominatim(user_agent="flaskrag3")
                    location = geolocator.geocode(final_answer_raw.split("[map]")[-1].strip())
                    if location:
                        visual_evidence.append({
                            "type": "map",
                            "latitude": location.latitude,
                            "longitude": location.longitude,
                            "address": location.address
                        })
                        final_answer_raw = final_answer_raw.replace("[map]", "")
                except Exception as e:
                    logging.warning(f"Error generating map: {e}")
            
            # Generate follow-up questions
            suggested_questions = []
            if retrieved_docs:
                try:
                    context_str = "\n\n".join([f"Document {i+1}:\n{doc.page_content[:500]}" 
                                            for i, doc in enumerate(retrieved_docs[:3])])
                    language = get_active_language_name()
                    # Build a safe, explicit prompt using context_str (avoid mixing f-strings with .format)
                    qgen_system_prompt = (
                        f"Please respond in {language}.\n"
                        f"Based on these documents, suggest 3 specific follow-up questions:\n"
                        f"Documents:\n{context_str}\n\n"
                        f"Questions:"
                    )
                    messages_for_qgen = [
                        SystemMessage(content=qgen_system_prompt),
                        HumanMessage(content="Suggest follow-up questions:")
                    ]
                    llm_response = llm.invoke(messages_for_qgen)
                    raw_q_content = getattr(llm_response, "content", "") or ""
                    logging.info(f"[format_rag_response] Raw follow-up LLM response: {raw_q_content}")

                    # Try JSON array parse first, otherwise fall back to robust line parsing
                    suggested_questions = []
                    try:
                        import json as _json
                        stripped = raw_q_content.strip()
                        if stripped.startswith('['):
                            parsed = _json.loads(stripped)
                            if isinstance(parsed, list):
                                suggested_questions = [q.strip() for q in parsed if isinstance(q, str)][:3]
                        else:
                            for line in raw_q_content.splitlines():
                                line = line.strip()
                                if not line:
                                    continue
                                # Remove common numbering/bullets and surrounding quotes
                                clean = re.sub(r'^[\d\-\.\)\s]+', '', line).strip().strip('"\'').strip()
                                if clean and not clean.endswith('?'):
                                    clean += '?'
                                if clean and clean not in suggested_questions:
                                    suggested_questions.append(clean)
                                if len(suggested_questions) >= 3:
                                    break
                    except Exception as e_parse:
                        logging.warning(f"[format_rag_response] Failed to parse follow-up questions JSON: {e_parse}")
                        # Fallback to simple line-splitting parsing
                        for line in raw_q_content.splitlines():
                            line = line.strip()
                            if line:
                                clean = re.sub(r'^[\d\-\.\)\s]+', '', line).strip().strip('"\'').strip()
                                if clean and not clean.endswith('?'):
                                    clean += '?'
                                if clean and clean not in suggested_questions:
                                    suggested_questions.append(clean)
                                if len(suggested_questions) >= 3:
                                    break
                except Exception as e:
                    logging.warning(f"Error generating questions: {e}")

            formatted_response = {
                "answer": final_answer_raw,
                "citations": citations,
                "suggested_questions": suggested_questions,
                "visual_evidence": visual_evidence,
                "usage_metadata": usage_metadata, # Include usage metadata
                "structured_query": structured_query # <<< ADDED: Include structured query
            }
            logging.info(f"Formatted response with {len(citations)} citations and {len(visual_evidence)} visual elements")
            return {
                "final_answer": final_answer_raw,
                "formatted_response": formatted_response,
                "usage_metadata": usage_metadata  # Preserve usage metadata in the state
            }

        

        rag_workflow = StateGraph(RAGAgentState)
        # Define the nodes
        rag_workflow.add_node("agent", call_rag_model)
        rag_workflow.add_node("tools_executor", execute_rag_tool)
        rag_workflow.add_node("generate", generate)
        rag_workflow.add_node("formatter", format_rag_response)

        # Define the workflow edges
        rag_workflow.set_entry_point("agent")

        rag_workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tools_executor",
                END: "generate"
            }
        )

        rag_workflow.add_edge("tools_executor", "agent") # FIX: Loop back to the agent to process tool results
        rag_workflow.add_edge("generate", "formatter")
        rag_workflow.add_edge("formatter", END)

        rag_graph = rag_workflow.compile() # Compile without MemorySaver for now

       
        def call_rag_agent_node(state: SupervisorState, config: Optional[dict] = None): # Add config parameter
            logging.info("--- Calling RAG Agent Node ---")

            config = config or {}

             # --- Use helper to get the active image for this turn ---
            active_img_b64, active_img_mime = get_active_image_for_turn(state, config)
            logging.info(f"[RAG Agent Node] Active image for RAG sub-graph: {'Present' if active_img_b64 else 'None'}")

            # Prepare the initial state for the RAG sub-graph
            rag_input_state = {
                "input": state["input"],
                "chat_history": state["chat_history"], # Pass along chat history
                "vector_store_config": state["vector_store_config"],
                "intermediate_steps": [],
                # --- MODIFIED: Lambda to correctly use active_img_b64 and active_img_mime ---
                "messages": [(lambda current_input_text, image_b64_for_message, image_mime_for_message: HumanMessage(content=(
                    [
                        {"type": "text", "text": current_input_text},
                        {"type": "image_url", "image_url": {"url": f"data:{image_mime_for_message};base64,{image_b64_for_message}"}}
                    ] if image_b64_for_message and image_mime_for_message else [
                        {"type": "text", "text": current_input_text}
                    ]
                )))(state["input"], active_img_b64, active_img_mime)],
                "retrieved_context": [],
                # Initialize other RAG state keys if needed
                "grade_decision": None,
                "generation_context_source": None,
                "search_results": None,
                "image_base64": active_img_b64, # Pass active image to RAG state
                "image_mime_type": active_img_mime, # Pass active mime to RAG state
                "final_answer": None,
                "structured_query": None, # <<< ADDED: Initialize structured_query
                "formatted_response": None,
                "error": None,
            }

            # --- Override image data if provided in config (e.g., during resume) ---
            image_base64_override = config.get("configurable", {}).get("image_base64")
            image_mime_type_override = config.get("configurable", {}).get("image_mime_type")

            # This override is now handled by get_active_image_for_turn, so direct assignment here is fine.
            if image_base64_override is not None:
                rag_input_state["image_base64"] = image_base64_override
            if image_mime_type_override is not None:
                rag_input_state["image_mime_type"] = image_mime_type_override

            # --- Prepare the config for the sub-graph invocation ---
            # Use the config passed into this node function, which should contain 'interrupt_before'
            # Ensure 'configurable' exists and add the thread_id
            sub_graph_config = config.copy() # Start with the config passed to this node

            if "configurable" not in sub_graph_config:
                sub_graph_config["configurable"] = {}

            user_id = state["vector_store_config"].get("user_id", "default_thread")
            sub_graph_config["configurable"]["thread_id"] = str(user_id)
            # Ensure vector_store_config is also available if needed by sub-graph nodes via config
            sub_graph_config["configurable"]["vector_store_config"] = state['vector_store_config']

            # --- DEBUG LOG: Check sub_config before invoke ---
            logging.info(f"[RAG Agent Node] Invoking RAG sub-graph with config: {json.dumps(sub_graph_config, default=str)}")


            try:
                # --- Attempt to run the RAG sub-graph ---
                rag_result_state = rag_graph.invoke(rag_input_state, config=sub_graph_config) # Pass the prepared config

                # --- If invoke() finishes WITHOUT interruption ---
                logging.info(f"[RAG Agent Node] RAG sub-graph invoke returned type: {type(rag_result_state)}")
                if isinstance(rag_result_state, dict):
                    logging.info(f"[RAG Agent Node] RAG sub-graph returned state keys: {list(rag_result_state.keys())}")

                 # After RAG agent execution, update supervisor's current_turn_usage_metadata
                # with the usage reported by the RAG agent's generate node.
                rag_usage = rag_result_state.get("usage_metadata") if isinstance(rag_result_state, dict) else None

            except Exception as invoke_err:
                 # --- IMPORTANT: Re-raise GraphInterrupt, catch only other errors ---
                 if isinstance(invoke_err, GraphInterrupt):
                     raise # Let it propagate up to invoke_agent_graph
                 # --- Log and handle OTHER errors ---
                 logging.error(f"[RAG Agent Node] Error invoking RAG sub-graph: {invoke_err}", exc_info=True)

                # If invoke fails for other reasons, return an error structure
                 return {"agent_output": {"answer": f"Error in RAG sub-graph: {invoke_err}"}}
            else:
                # If no GraphInterrupt was caught, proceed normally.
                # Return the final formatted response if invoke() completed successfully.
                # --- DEBUG LOG: Inspect rag_result_state before returning ---
                logging.debug(f"[RAG Agent Node] RAG sub-graph invoke completed. rag_result_state: {rag_result_state}")
                if isinstance(rag_result_state, dict):
                    # --- DEBUG LOG: Inspect the specific value being extracted ---
                    logging.debug("=" * 50) # Separator Start
                    formatted_response_value = rag_result_state.get("formatted_response", {})
                    logging.debug(f"[RAG Agent Node] Value of rag_result_state.get('formatted_response'): {formatted_response_value}") # Log the extracted value

                    # Start with the usage from the router/previous steps
                    total_usage = state.get("current_turn_usage_metadata", {})
                    # Add the usage from the RAG agent's own execution
                    if rag_usage:
                        total_usage = _sum_usage_metadata(total_usage, rag_usage)

                    # *** FIX: Inject the final, summed usage back into the payload for the UI ***
                    if isinstance(formatted_response_value, dict):
                        formatted_response_value["usage_metadata"] = total_usage
                        logging.info(f"[RAG Agent Node] Injected summed usage into agent_output for streaming: {total_usage}")

                    # Prepare the return value for updating the supervisor state
                    output_to_return = {"agent_output": formatted_response_value, "current_turn_usage_metadata": total_usage}
                    logging.debug(f"[RAG Agent Node] Returning from node: {output_to_return}") # Log the final dict being returned
                    logging.debug("=" * 50) # Separator End
                    return output_to_return
                else:
                    # Handle cases where invoke() failed with a different error
                    # or returned something unexpected.
                    logging.error("[RAG Agent Node] RAG sub-graph did not return a dictionary state after invoke.")
                    return {"agent_output": {"answer": "Error: RAG agent finished unexpectedly."}}
                       
            
         # --- DataFrame Agent Graph (Imported) ---
        # The create_dataframe_agent_graph function is now imported from dataframe_agent.py
        dataframe_agent_graph = create_dataframe_agent_graph(llm=llm) # Pass the initialized LLM

        # --- NEW Node for Map Agent ---
        def call_map_agent_node(state: SupervisorState, config: Optional[dict] = None): # Added config
            """Handles map-related queries using map tools."""
            global llm_with_map_tools # <<< Use global keyword
            if config is None:
                config = {}
            
            if llm_with_map_tools is None: # Should be initialized by build_supervisor_graph
                initialize_llms() # Ensure it's initialized
            # map_tool_node is defined globally when graph is built
            # --- END Bind Map tools ---
            
            if llm_with_map_tools is None:
                raise ValueError("LLM with map tools not initialized.")

            # --- Check if the last message is the result of getting coordinates ---
            # --- NEW: Check if the last message is the result of generating a map ---
            last_message = state["messages"][-1] if state["messages"] else None
            if isinstance(last_message, ToolMessage) and last_message.name in ["generate_map_link", "generate_map_link_by_string_coordinates"]:
                logging.info(f"[Map Agent] Detected successful map generation tool call ({last_message.name}). Formatting final output.")
                tool_result_dict = last_message.content
                
                # Attempt to parse if content is a string representation of a dict
                if isinstance(tool_result_dict, str):
                    try:
                        # Replace single quotes with double quotes for valid JSON, handle None, True, False
                        parsable_str = tool_result_dict.replace("'", '"').replace("None", "null").replace("True", "true").replace("False", "false")
                        tool_result_dict = json.loads(parsable_str)
                        logging.info(f"[Map Agent] Parsed ToolMessage content string to dict: {tool_result_dict}")
                    except json.JSONDecodeError:
                        logging.warning(f"[Map Agent] Failed to parse ToolMessage content string to dict. Content: {last_message.content}")
                        # Keep tool_result_dict as string if parsing fails, will hit the error below.

                if isinstance(tool_result_dict, dict):
                    # We need the LLM's final textual response as the 'answer' part.
                    # This might be the AIMessage *before* the ToolMessage.
                    # Let's look back for the AIMessage that triggered this tool call.
                    # prev_message = state["messages"][-2] if len(state["messages"]) > 1 else None
                    # llm_text_response = prev_message.content if isinstance(prev_message, AIMessage) and prev_message.content else "Here is the map:"
                    
                    # Construct the answer with the map link
                    final_answer_text = f"Here is the map: {tool_result_dict.get('map_link', 'Link not available.')}"

                    agent_output_payload = {
                        "answer": final_answer_text, # Now includes the markdown link
                        "map_image_base64": tool_result_dict.get("map_image_base64"),
                        "map_image_mime_type": tool_result_dict.get("map_image_mime_type"),
                        "html_map_url": tool_result_dict.get("html_map_url")
                    }
                    return {"agent_output": agent_output_payload}
                else:
                    logging.warning(f"[Map Agent] ToolMessage content is not a dictionary after potential parsing. Type: {type(tool_result_dict)}, Content: {last_message.content}")
                    return {"agent_output": {"answer": "Error processing map tool result."}}
            # --- END NEW CHECK ---

            # --- Original check for coordinate result (now happens AFTER checking for final map result) ---
            last_message = state["messages"][-1] if state["messages"] else None
            if isinstance(last_message, ToolMessage) and last_message.name == "get_latitude_longitude_by_name_place":
                logging.info("[Map Agent] Detected coordinates from previous tool call. Attempting to generate map link directly.")
                try:
                    # --- Parse coordinates from ToolMessage content ---
                    # Use regex to find floating point numbers robustly
                    import re
                    numbers = re.findall(r"([-+]?\d*\.?\d+)", last_message.content)
                    if len(numbers) == 2:
                        latitude = float(numbers[0])
                        longitude = float(numbers[1])
                    else:
                        raise ValueError(f"Could not extract exactly two numbers from ToolMessage content: {last_message.content}")
                    # latitude = float(lat_str) # Old parsing
                    # longitude = float(lon_str) # Old parsing
                    logging.info(f"[Map Agent] Parsed coordinates: Lat={latitude}, Lon={longitude}")

                    # --- Directly call generate_map_link tool, which now returns a dict ---
                    map_result_dict = generate_map_link.func(latitude=latitude, longitude=longitude)
                    agent_output_payload = {
                        "answer": f"Here is the map: {map_result_dict.get('map_link', 'Link not available.')}",
                        "map_image_base64": map_result_dict.get("map_image_base64"),
                        "map_image_mime_type": map_result_dict.get("map_image_mime_type"),
                        "html_map_url": map_result_dict.get("html_map_url")
                    }
                    return {"agent_output": agent_output_payload}
                except Exception as parse_or_generate_err:
                    logging.error(f"[Map Agent] Error parsing coordinates or generating map link directly: {parse_or_generate_err}", exc_info=True)
                    # Fallback to LLM if direct call fails
                    pass # Continue to LLM invocation below
            else:
                # --- If last message is NOT coordinate result, THEN check for simple pattern ---
                import re
                user_input_lower = state["input"].lower()
                # Regex to find "map of/for [place name]" potentially at the end
                match = re.search(r'(?:map|location)\s+(?:of|for)\s+([\w\s]+)$', user_input_lower)
                extracted_place_name = None
                if match:
                    extracted_place_name = match.group(1).strip()

                if extracted_place_name:
                    logging.info(f"[Map Agent] Detected simple pattern. Directly creating tool call for 'get_latitude_longitude_by_name_place' with place: '{extracted_place_name}'")
                    # Manually construct the AIMessage with the tool call
                    tool_call_id = f"call_{uuid4().hex[:20]}" # Generate a unique ID
                    ai_message_with_tool_call = AIMessage(
                        content="", # No text content needed when calling tool
                        tool_calls=[
                            ToolCall(name="get_latitude_longitude_by_name_place", args={"place_name": extracted_place_name}, id=tool_call_id)
                        ]
                    )
                    # Return this message to trigger the ToolNode
                    return {"messages": [ai_message_with_tool_call]}
                        
             # --- If neither direct handling applied, proceed with LLM call (Fallback) ---
            map_system_prompt = """You are an assistant that generates map links for users based on their requests.
Your goal is to generate a map link for a requested location.
You have three tools:
1. `get_latitude_longitude_by_name_place`: Use this tool if the user provides a place name (like 'Paris', 'Eiffel Tower', 'Bali'). Extract the place name and pass it to the tool.
2. `generate_map_link`: Use this tool if the user provides coordinates as decimal numbers (e.g., "map at 48.8566, 2.3522") OR after you have received decimal latitude and longitude from the `get_latitude_longitude_by_name_place` tool. Pass the decimal latitude and longitude accurately to this tool.
3. `generate_map_link_by_string_coordinates`: Use this tool ONLY IF the user provides coordinates in Degree-Minute-Second (DMS) string format (e.g., "map for S 0° 55' 55.00\", E 101° 26' 52.00\").

IMPORTANT: 
- If you use `get_latitude_longitude_by_name_place` and receive coordinates like '(latitude, longitude)' in a ToolMessage, you MUST then call `generate_map_link` with these decimal coordinates.
- Do not hallucinate coordinates. Use the ones provided by the tool.
- If the user asks for a map of a place name, use `get_latitude_longitude_by_name_place` first. Do not ask for the place name if it's already provided in the user's query.
- If the user provides decimal coordinates directly, use `generate_map_link`.
- If the user provides DMS coordinates directly, use `generate_map_link_by_string_coordinates`.
- Once a map generation tool (`generate_map_link` or `generate_map_link_by_string_coordinates`) has been successfully called and you receive its result (which will be a dictionary containing map details in a ToolMessage), your task is complete. Respond to the user indicating the map is ready or by providing the map link from the tool's output. Do not call the map generation tools again for the same request."""


            # --- Construct a concise message history for the Map Agent ---
            language = get_active_language_name()
            messages_for_map_llm = [
                 SystemMessage(content=f"{map_system_prompt}\n\nPlease respond in {language}."),
                 HumanMessage(content=state["input"]) # Current user query
            ]
            # If the last message in the supervisor's history was a ToolMessage (e.g., from get_coords), add it.
            # This allows the LLM to see the result of a previous tool call in this turn.
            if state["messages"] and isinstance(state["messages"][-1], ToolMessage):
                tool_msg = state["messages"][-1]
                if tool_msg.name == "get_latitude_longitude_by_name_place":
                    messages_for_map_llm.append(
                        HumanMessage(
                            content=f"Tool result for get_latitude_longitude_by_name_place: {tool_msg.content}"
                        )
                    )
            # --- End concise message history construction ---

            try:
                response = llm_with_map_tools.invoke(messages_for_map_llm) # Use renamed variable

                # Check if the LLM decided to call a tool
                # --- Return the full response, including potential tool_calls ---
                # The graph's conditional edges will handle routing to the ToolNode
                if not response.tool_calls: # LLM answered directly
                    final_answer_content = response.content
                    # Check if the *previous* message in the state was a successful map generation tool call
                    if len(state["messages"]) > 1 and isinstance(state["messages"][-2], ToolMessage):
                        prev_tool_message = state["messages"][-2]
                        if prev_tool_message.name in ["generate_map_link", "generate_map_link_by_string_coordinates"]:
                            tool_result_dict = prev_tool_message.content # This should be the dict from our tool
                            if isinstance(tool_result_dict, dict) and "map_image_base64" in tool_result_dict:
                                agent_output_payload = {
                                    "answer": final_answer_content, # LLM's textual answer (likely the link)
                                    "map_image_base64": tool_result_dict.get("map_image_base64"),
                                    "map_image_mime_type": tool_result_dict.get("map_image_mime_type"),
                                    "html_map_url": tool_result_dict.get("html_map_url")
                                }
                                return {"messages": [response], "agent_output": agent_output_payload}
                    # If not a map generation tool result, or if something went wrong, just return LLM's answer
                    return {"messages": [response], "agent_output": {"answer": final_answer_content}}
                else: # LLM generated tool calls
                    logging.info(f"[Map Agent] Returning AIMessage with tool_calls: {repr(response.tool_calls)}")
                    return {"messages": [response]} # Return AIMessage with tool_calls for ToolNode
            except Exception as e:
                logging.error(f"Error in Map Agent node: {e}", exc_info=True)                
                return {"agent_output": {"answer": f"Error processing map request: {e}"}}

        def call_chitchat_node(state: SupervisorState, config: Optional[dict] = None): # Added config
            logging.info("--- Calling ChitChat Node ---")
            if llm is None:
                raise ValueError("LLM not initialized.")
            if config is None:
                config = {}
            callback_handler = UsageMetadataCallbackHandler()
            language = get_active_language_name()
            mmessages_for_chitchat = [ # Renamed variable
                SystemMessage(content=f"You are a friendly conversational assistant. Respond casually to greetings or simple statements.\n\nPlease respond in {language}."),
            ] + state["chat_history"] + [HumanMessage(content=state["input"])]
            response = llm.invoke(mmessages_for_chitchat, config={"callbacks": [callback_handler]}) # Use renamed variable
            chitchat_usage = callback_handler.usage_metadata
            existing_usage = state.get("current_turn_usage_metadata", {})
            total_usage = _sum_usage_metadata(existing_usage, chitchat_usage)
            agent_output_payload = {
                "answer": response.content,
                "usage_metadata": total_usage
            }
            return {"agent_output": agent_output_payload, "current_turn_usage_metadata": total_usage}

        def search_interrupt_check_node(state: SupervisorState, config: Optional[dict] = None): # New HIL node for web search
            if config is None:
                config = {}
            """
            Checks for web search interrupt condition.
            This node will now ALWAYS raise a GraphInterrupt to ensure user
            confirmation is requested before performing a web search, as per requirements.
            """
            logging.info("--- Checking Web Search Interrupt ---")
            configurable_section = {}
            if config and hasattr(config, "get"):
                configurable_section = config.get("configurable", {}) or {}

            thread_id_for_config = state.get("thread_id") or configurable_section.get("thread_id")
            skip_interrupt = configurable_section.get("resume_after_hil_confirmation", False)

            logging.info(
                "[web_search_interrupt_check] Thread %s resume flag=%s",
                thread_id_for_config,
                skip_interrupt,
            )

            if not skip_interrupt and thread_id_for_config:
                skip_interrupt = _consume_thread_hil_confirmation(thread_id_for_config)
                logging.info(
                    "[web_search_interrupt_check] Consumed thread flag for %s, result=%s",
                    thread_id_for_config,
                    skip_interrupt,
                )

            if skip_interrupt:
                logging.info(
                    "[web_search_interrupt_check] Resuming after HIL confirmation for thread %s. Skipping interrupt.",
                    thread_id_for_config,
                )
                return

            logging.info("[web_search_interrupt_check] HIL is required for web search. Raising GraphInterrupt for user confirmation.")
            raise GraphInterrupt()

        def call_search_agent_node(state: SupervisorState, config: Optional[dict] = None): # Added config
            logging.info("--- Calling Search Agent Node ---")
            if config is None:
                config = {}
            search_query = state["input"]
            try:
                search_result_raw = search.invoke(search_query)
                # --- DEBUG LOG: Raw Search Results ---
                # search_result_raw may be returned as a dict/object OR as a string (serialized).
                # Normalize it to a Python dict so downstream code can access keys like "organic".
                logging.info(f"[Search Agent] Raw search results (raw type={type(search_result_raw)}) for '{search_query}'. Attempting normalization.")
                parsed_search_results = None
                try:
                    if isinstance(search_result_raw, str):
                        # Try JSON first
                        try:
                            parsed_search_results = json.loads(search_result_raw)
                            logging.info("[Search Agent] Parsed search_result_raw as JSON string.")
                        except Exception:
                            # Try Python literal eval as a fallback (handles single-quoted Python repr)
                            import ast
                            try:
                                parsed_search_results = ast.literal_eval(search_result_raw)
                                logging.info("[Search Agent] Parsed search_result_raw using ast.literal_eval.")
                            except Exception as e_parse:
                                logging.warning(f"[Search Agent] Failed to parse string search result: {e_parse}. Falling back to wrapping raw string.")
                                parsed_search_results = {"raw_text": search_result_raw}
                    elif isinstance(search_result_raw, dict):
                        parsed_search_results = search_result_raw
                    else:
                        # Unknown type (e.g., bytes), attempt decode then parse
                        try:
                            if isinstance(search_result_raw, (bytes, bytearray)):
                                decoded = search_result_raw.decode('utf-8', errors='ignore')
                                parsed_search_results = json.loads(decoded)
                                logging.info("[Search Agent] Decoded bytes and parsed as JSON.")
                            else:
                                parsed_search_results = {"raw": str(search_result_raw)}
                        except Exception:
                            parsed_search_results = {"raw": str(search_result_raw)}
                except Exception as e_norm:
                    logging.error(f"[Search Agent] Exception while normalizing search result: {e_norm}", exc_info=True)
                    parsed_search_results = {"raw": str(search_result_raw)}

                logging.info(f"[Search Agent] Normalized search results type: {type(parsed_search_results)}")
                logging.info(f"[Search Agent] Normalized search results (trimmed): {json.dumps(parsed_search_results, default=str)[:3000]}")

                # Use parsed_search_results for further processing
                if llm is None:
                    raise ValueError("LLM not initialized.")
                language = get_active_language_name()
                # Safely include a trimmed representation in the prompt (avoid overly long payloads)
                safe_search_dump = json.dumps(parsed_search_results, default=str)[:3000]
                summary_prompt = f"Please answer in {language}.\nBased on the following search results, provide a concise answer to the user's query.\nUser Query: {search_query}\n\nSearch Results:\n{safe_search_dump}\n\nConcise Answer:"
                callback_handler = UsageMetadataCallbackHandler()
                messages_for_search_summary = [HumanMessage(content=summary_prompt)]
                summary_response = llm.invoke(messages_for_search_summary, config={"callbacks": [callback_handler]})
                final_answer = summary_response.content
                search_agent_usage = callback_handler.usage_metadata
                existing_usage = state.get("current_turn_usage_metadata", {})
                total_usage = _sum_usage_metadata(existing_usage, search_agent_usage)

                # Format citations from search results
                citations = []
                try:
                    if isinstance(search_result_raw, dict) and "organic" in search_result_raw:
                        for i, result in enumerate(search_result_raw.get("organic", [])):
                            citations.append({
                                "id": i + 1,
                                "source": result.get("title"),
                                "link": result.get("link"),
                                "text_snippet": result.get("snippet")
                            })
                except Exception as e_cit:
                    logging.warning(f"[Search Agent] Failed to extract citations: {e_cit}")

                agent_output_payload = {
                    "answer": final_answer,
                    "usage_metadata": total_usage,
                    "citations": citations,
                    "suggested_questions": []
                }
                return {"agent_output": agent_output_payload, "current_turn_usage_metadata": total_usage}
            except Exception as e:
                # --- DEBUG LOG: Error during search/summary ---
                logging.error(f"[Search Agent] Error during search or summarization for '{search_query}': {e}", exc_info=True)
                # --- END DEBUG LOG ---
                logging.error(f"Error calling search tool or summarizing: {e}")
                return {"agent_output": {"answer": f"Error performing web search or summarizing results for: {search_query}"}}

        def supervisor_router(state: SupervisorState, config: Optional[dict] = None): # Added config
            """Routes queries to the appropriate agent based on LLM decision."""
            if config is None:
                config = {}
            logging.info(f"--- Supervisor Router: Deciding for query: '{state['input']}' ---")
            if llm is None:
                raise ValueError("LLM not initialized for supervisor_router.")

            # --- Use helper to get active image for this turn ---
            active_img_b64, active_img_mime = get_active_image_for_turn(state, config)
            logging.info(f"[Supervisor Router] Active image for routing: {'Present' if active_img_b64 else 'None'}")
            # Prepare messages for the supervisor LLM
            human_message_content_for_supervisor = [{"type": "text", "text": state["input"]}]
            if active_img_b64 and active_img_mime: # Use active image
                human_message_content_for_supervisor.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{active_img_mime};base64,{active_img_b64}"}
                })
            
            language = get_active_language_name()
            supervisor_messages = [
                SystemMessage(content=f"{SYS_MSG_SUPERVISOR}\n\nPlease respond in {language}."),
                # Add context about active dataframe if available
                SystemMessage(content=(
                    f"Context: DataFrame session is {'ACTIVE' if state.get('df_agent_is_active_session') else 'inactive'}. "
                    f"If active, prioritize DataFrame_Agent for queries about data analysis, filtering, or tabular data."
                )),
                HumanMessage(content=human_message_content_for_supervisor)
            ]
            callback_handler = UsageMetadataCallbackHandler()
            response = llm.invoke(supervisor_messages, config={"callbacks": [callback_handler]})
            next_agent_name = response.content.strip()

            

            supervisor_router_usage = callback_handler.usage_metadata
            logging.info(f"[supervisor_router] Captured usage from routing LLM call: {supervisor_router_usage}") # ADD THIS LOG
            current_turn_usage_metadata = supervisor_router_usage # Set baseline usage

            valid_agents = ["RAG_Agent", "DataFrame_Agent", "Map_Agent", "Search_Agent", "ChitChat_Agent", "__end__"]
            if next_agent_name not in valid_agents:
                logging.warning(f"Supervisor LLM returned an invalid agent name: '{next_agent_name}'. Defaulting to RAG_Agent.")
                next_agent_name = "RAG_Agent"
            logging.info(f"Supervisor routing to: {next_agent_name} for query: '{state['input']}'")
            return {"next": next_agent_name, "current_turn_usage_metadata": current_turn_usage_metadata}
        
        def call_dataframe_agent_node(state: SupervisorState, config: Optional[dict] = None): # Add config
            logging.info("--- Calling DataFrame Agent Node ---")
            if config is None:
                config = {}
            # --- ADD DETAILED LOGGING OF THE INPUT STATE ---
            logging.info(f"[call_dataframe_agent_node] Received state keys: {list(state.keys())}")
            logging.info(f"[call_dataframe_agent_node] state['loaded_dataframes'] (at entry): {state.get('loaded_dataframes')}")
            logging.info(f"[call_dataframe_agent_node] state['active_dataframe_id'] (at entry): {state.get('active_dataframe_id')}")
            # --- END DETAILED LOGGING ---
            # Prepare initial state for DataFrameAgent
            df_agent_input_state = DataFrameAgentState(
                input=state["input"],
                chat_history=state["chat_history"], # Pass along chat history
                messages=[HumanMessage(content=state["input"])], # Start with current user input
                uploaded_file_content=state.get("uploaded_file_content"), # Pass content
                uploaded_file_type=state.get("uploaded_file_type"),
                uploaded_file_name=state.get("uploaded_file_name"),
                # Pass the currently active DataFrame's details to the DataFrameAgent
                active_dataframe_json=(
                    state.get("loaded_dataframes", {}).get(state.get("active_dataframe_id", ""), {}).get("json")
                    if state.get("active_dataframe_id") and state.get("loaded_dataframes") else None
                ),
                dataframe_summary=(
                    state.get("loaded_dataframes", {}).get(state.get("active_dataframe_id", ""), {}).get("summary")
                    if state.get("active_dataframe_id") and state.get("loaded_dataframes") else None
                ),
            # Pass info about all loaded DFs (names/IDs) for context to DataFrameAgent,
            # so it can use tools like list_loaded_dataframes or suggest switching.
            all_loaded_dataframes_info={k: v.get("name", k) for k, v in state.get("loaded_dataframes", {}).items()},
                final_answer=None,
                chart_image_base64=None, # Initialize in DF Agent State
                chart_image_mime_type=None, # Initialize in DF Agent State
                usage_metadata=None # Initialize in DF Agent State
            )
            
            last_agent = state.get("last_agent_invoked") # <--- Fetched here
            
            logging.info(f"[call_dataframe_agent_node] Initializing DataFrameAgent with:")
            logging.info(f"  Input: {df_agent_input_state['input']}")
            logging.info(f"  Uploaded File Content from Supervisor: {'Present' if state.get('uploaded_file_content') else 'None'}") # Log what supervisor has
            logging.info(f"  Active DF JSON from Supervisor for DF Agent: {'Present' if df_agent_input_state['active_dataframe_json'] else 'None'}")
            logging.info(f"  DF Summary from Supervisor for DF Agent: {'Present' if df_agent_input_state['dataframe_summary'] else 'None'}")
            
            # Config for sub-graph, thread_id for potential checkpointing within df_agent if added later
            sub_graph_config = config.copy()
            if "configurable" not in sub_graph_config: sub_graph_config["configurable"] = {}
            sub_graph_config["configurable"]["thread_id"] = str(uuid4()) # Unique for this sub-run
            sub_graph_config["recursion_limit"] = 15 # Set recursion limit for the sub-graph

            result_df_agent_state = dataframe_agent_graph.invoke(df_agent_input_state, config=sub_graph_config)
            
            logging.info(f"[call_dataframe_agent_node] DataFrameAgent returned state. Keys: {list(result_df_agent_state.keys())}")
            logging.info(f"  Resulting active_dataframe_json from DF Agent: {'Present' if result_df_agent_state.get('active_dataframe_json') else 'None'}")
            # Ensure we log the content of summary if present for debugging
            summary_content_log = result_df_agent_state.get('dataframe_summary')
            logging.info(f"  Resulting dataframe_summary from DF Agent: {'Present and not empty' if summary_content_log else 'None or empty'}")

            # Prepare updates for SupervisorState based on DataFrameAgent's final state
            supervisor_updates = {}

            # Directly get the values from the DataFrameAgent's result state.
            # These will be None if the DataFrameAgent didn't produce them (e.g., on an error or if no data was loaded)
            # or if the DataFrameAgent explicitly set them to None (e.g., after a "clear data" operation if implemented).
            returned_df_json = result_df_agent_state.get("active_dataframe_json")
            returned_df_summary = result_df_agent_state.get("dataframe_summary")
            final_df_answer_from_agent = result_df_agent_state.get("final_answer")
            chart_b64 = result_df_agent_state.get("chart_image_base64")
            chart_mime = result_df_agent_state.get("chart_image_mime_type")
            
            df_agent_usage_metadata = result_df_agent_state.get("usage_metadata") # Usage from DF agent
            total_usage = state.get("current_turn_usage_metadata", {})

            # Get existing loaded_dataframes and active_dataframe_id from the current supervisor state
            # These will be updated if the DataFrameAgent loaded a new DF or switched the active one.
            current_loaded_dfs = state.get("loaded_dataframes", {}) # Get existing or initialize to empty
            current_active_id = state.get("active_dataframe_id")
            
            if df_agent_usage_metadata:
                total_usage = _sum_usage_metadata(total_usage, df_agent_usage_metadata)

            # Check if DataFrameAgent signaled a newly loaded DataFrame
            newly_loaded_df_details = result_df_agent_state.get("newly_loaded_df_details")
            if newly_loaded_df_details and isinstance(newly_loaded_df_details, dict) and "id" in newly_loaded_df_details:
                logging.info(f"[call_dataframe_agent_node] Processing newly_loaded_df_details: {newly_loaded_df_details.get('id')}")
                df_id = newly_loaded_df_details["id"]
                # Ensure all expected keys are present before adding
                current_loaded_dfs[df_id] = {
                    "name": newly_loaded_df_details.get("name", df_id), # Default name to id if not provided
                    "json": newly_loaded_df_details.get("json"),
                    "summary": newly_loaded_df_details.get("summary"),
                    "columns": newly_loaded_df_details.get("columns", []),
                    "dtypes": newly_loaded_df_details.get("dtypes", {})
                }
                current_active_id = df_id # New DF becomes active
                logging.info(f"[call_dataframe_agent_node] New DataFrame '{newly_loaded_df_details.get('name', df_id)}' (ID: {df_id}) added and set as active.")
                # Clear uploaded_file_content from SupervisorState if it was used to load this new DataFrame
                if df_agent_input_state.get("uploaded_file_content"): # Check the input state for *this turn*
                    supervisor_updates["uploaded_file_content"] = None
                    supervisor_updates["uploaded_file_type"] = None
                    supervisor_updates["uploaded_file_name"] = None # Also clear the filename from supervisor state
                    logging.info("[call_dataframe_agent_node] Cleared uploaded file content/type/name after loading new DataFrame.")
            
            
            supervisor_updates["loaded_dataframes"] = current_loaded_dfs
            supervisor_updates["active_dataframe_id"] = current_active_id
            supervisor_updates["df_agent_is_active_session"] = bool(current_active_id and current_active_id in current_loaded_dfs)
            supervisor_updates["current_turn_usage_metadata"] = total_usage

            logging.info(f"[call_dataframe_agent_node] Supervisor updates to be returned (keys): {list(supervisor_updates.keys())}")
            log_supervisor_updates_content = {k: (type(v).__name__, 'Present and not empty' if v else ('None' if v is None else 'Empty but not None')) for k, v in supervisor_updates.items()}
            logging.info(f"  Supervisor updates content details: {log_supervisor_updates_content}")
            
            # Determine the final answer for agent_output
            final_answer_for_output = final_df_answer_from_agent
            if not final_answer_for_output and result_df_agent_state.get("messages"):
                last_msg = result_df_agent_state["messages"][-1]
                if isinstance(last_msg, AIMessage) and not last_msg.tool_calls: # Ensure it's an AI message and not a tool call
                    final_answer_for_output = last_msg.content

            agent_output_payload = {"answer": final_answer_for_output or "DataFrame operation completed."}
            agent_output_payload["usage_metadata"] = total_usage # *** FIX: Add summed usage to the payload
            # Add chart data to the output if present
            if result_df_agent_state.get("chart_image_base64") and result_df_agent_state.get("chart_image_mime_type"):
                agent_output_payload["chart_image_base64"] = result_df_agent_state["chart_image_base64"]
                agent_output_payload["chart_image_mime_type"] = result_df_agent_state["chart_image_mime_type"]
                logging.info("[call_dataframe_agent_node] Chart data included in agent_output.")
            
            # Add proactive questions if DataFrameAgent generated them
            if result_df_agent_state.get("proactive_questions"):
                agent_output_payload["suggested_questions"] = result_df_agent_state.get("proactive_questions")
                logging.info(f"[call_dataframe_agent_node] Proactive questions included in agent_output: {agent_output_payload['suggested_questions']}")

            supervisor_updates["agent_output"] = agent_output_payload
            return supervisor_updates
        
        supervisor_workflow = StateGraph(SupervisorState)
        supervisor_workflow.add_node("router", supervisor_router)
        supervisor_workflow.add_node("RAG_Agent", call_rag_agent_node) # Node function now accepts config
        supervisor_workflow.add_node("ChitChat_Agent", call_chitchat_node)
        supervisor_workflow.add_node("map_tool_node", map_tool_node) # Add the map tool node
        supervisor_workflow.add_node("Map_Agent", call_map_agent_node)
        supervisor_workflow.add_node("DataFrame_Agent", call_dataframe_agent_node) # Add DataFrame Agent node
        supervisor_workflow.add_node("Search_Agent", call_search_agent_node)
        supervisor_workflow.add_node("search_interrupt_check", search_interrupt_check_node)  # Add the new HIL check node
        supervisor_workflow.set_entry_point("router") # Keep entry point
        supervisor_workflow.add_conditional_edges(
            "router",
            lambda x: x["next"],
            {
                "RAG_Agent": "RAG_Agent",
                "ChitChat_Agent": "ChitChat_Agent",
                "Map_Agent": "Map_Agent", # Add edge target for Map Agent
                "Search_Agent": "search_interrupt_check",  # Route to HIL check before Search_Agent
                "DataFrame_Agent": "DataFrame_Agent", # Add edge for DataFrame Agent
                "__end__": END
            }
        )
        # FIX: Add edge from HIL check to the actual search agent
        supervisor_workflow.add_edge("search_interrupt_check", "Search_Agent")
         # --- Edges for Map Agent ---
        supervisor_workflow.add_node("update_persisted_image", update_persisted_image_node)
        supervisor_workflow.add_conditional_edges(
            "Map_Agent",
            tools_condition, # Use standard condition to check for tool_calls
            {"tools": "map_tool_node", END: "update_persisted_image"} # If tools needed, go to map_tool_node, else END
        )
        supervisor_workflow.add_edge("map_tool_node", "Map_Agent") # Go back to Map_Agent after tool execution
        supervisor_workflow.add_edge("RAG_Agent", "update_persisted_image")
        supervisor_workflow.add_edge("DataFrame_Agent", "update_persisted_image") # DataFrame_Agent goes to END
        supervisor_workflow.add_edge("ChitChat_Agent", "update_persisted_image")
        supervisor_workflow.add_edge("Search_Agent", "update_persisted_image")
        supervisor_workflow.add_edge("update_persisted_image", END)
        # Compile the supervisor graph with its checkpointer
        compiled_supervisor_graph_local = supervisor_workflow.compile(
            checkpointer=MemorySaver(),
        )
        compiled_supervisor_graph = compiled_supervisor_graph_local

        _graph_built = True
        print("--- Supervisor Graph Built Successfully ---")

    except Exception as e:
        logging.error(f"FATAL: Error building the supervisor graph: {e}", exc_info=True)
        _graph_built = False
        raise RuntimeError("Failed to build the agent supervisor graph.") from e

    return compiled_supervisor_graph

# --- Resume Logic ---
def resume_agent_graph(
    thread_id: str,
    confirmation: Optional[str] = None, # New: Accept confirmation
    stream: bool = False,
    image_base64: Optional[str] = None, # New: For resuming with a new image
    image_mime_type: Optional[str] = None, # New: MIME type for the new image
    conversation_id: Optional[str] = None, # Added conversation_id
    **kwargs # To catch db_message_id_for_stream and user_id_for_stream
):
    # --- DEBUG LOG: Resume Start ---
    logging.info(f"[resume_agent_graph] Attempting to resume thread {thread_id}, stream={stream}")
    # --- Ensure LLMs are initialized before resuming ---
    initialize_llms()
    # --- End Ensure LLMs ---
    """Resumes the supervisor agent graph from an interrupted state.
    Allows providing new image data to override what might be in the checkpoint.
    """
    global compiled_supervisor_graph, _graph_built

    if compiled_supervisor_graph is None or not _graph_built:
        # Attempt to build it if not already built, though it should be by this point
        try:
            build_supervisor_graph()
        except Exception as e:
            logging.error(f"Error trying to build graph during resume: {e}", exc_info=True)
            return {"type": "error", "message": "Graph not available for resuming."}
    
    # Use the passed conversation_id for the thread_id in config
    # If conversation_id is None, use the thread_id passed to resume_agent_graph
    config_thread_id = conversation_id if conversation_id else thread_id    

    db_id_for_stream_chunks_resume = kwargs.get("db_message_id_for_stream")
    user_id_for_stream_chunks_resume = kwargs.get("user_id_for_stream")

    config = {
        "configurable": {
            "thread_id": str(config_thread_id), # Use consistent ID
            "image_base64": image_base64, 
            "image_mime_type": image_mime_type,
            "db_message_id": db_id_for_stream_chunks_resume, # Pass to _collect_stream_chunks
            "user_id": user_id_for_stream_chunks_resume      # Pass to _collect_stream_chunks
        }
    }

    if confirmation == "yes":
        config["configurable"]["resume_after_hil_confirmation"] = True
        _mark_thread_hil_confirmed(config_thread_id)

    if stream:
        print(f"--- Resuming SUPERVISOR graph in STREAMING mode for thread {thread_id} ---")
        try:
            logging.info(f"[resume_agent_graph] Preparing streaming generator for thread {config_thread_id}")
            streaming_generator = _collect_stream_chunks(compiled_supervisor_graph, None, config)
            logging.info(f"[resume_agent_graph] Streaming generator prepared for thread {config_thread_id}")
            return streaming_generator
        except Exception as e:
            logging.error(f"Error during agent streaming resume: {e}", exc_info=True)
            return {"type": "error", "message": f"Streaming resume failed: {e}"}
    else:
        print(f"--- Resuming SUPERVISOR graph in NON-STREAMING mode for thread {config_thread_id} ---")
        try:
            # Pass None as input to signal resume, the confirmation is handled by the config flag
            final_state = compiled_supervisor_graph.invoke(None, config=config)
            # Process final_state similar to the non-streaming invoke path
            # --- DEBUG LOG: After invoke ---
            logging.info(f"[resume_agent_graph] invoke(None) completed for thread {thread_id}. Result type: {type(final_state)}")
            if isinstance(final_state, dict): logging.info(f"[resume_agent_graph] Result keys: {list(final_state.keys())}")
            final_output = final_state.get("agent_output")
            if final_output is None:
                logging.error(f"Supervisor graph resume finished with no agent_output. Final state: {final_state}")
                return {"answer": "Error: Agent workflow resume finished unexpectedly.", "citations": [], "suggested_questions": []}
            if isinstance(final_output, str):
                return {"answer": final_output, "citations": [], "suggested_questions": []}
            elif isinstance(final_output, dict):
                return final_output
            else:
                logging.error(f"Supervisor graph resume finished with unexpected agent_output type: {type(final_output)}. Output: {final_output}")
                return {"answer": "Error: Agent workflow resume returned unexpected data.", "citations": [], "suggested_questions": []}
        except Exception as e:
            # --- DEBUG LOG: Error during invoke ---
            logging.error(f"Error resuming agent graph for thread {config_thread_id}: {e}", exc_info=True)
            return {"type": "error", "message": f"Error resuming graph: {e}"}

# --- Invocation Logic ---

async def _collect_stream_chunks(graph, inputs, config):
    """Helper to collect chunks from an async stream into a single response structure."""
    final_response_obj = {
        "answer": "",
        "citations": [],
        "suggested_questions": [],
        "usage_metadata": {},
        "is_evidence": False,
        "source_type": None,
        "chart_image_base64": None,
        "chart_image_mime_type": None,
        "map_image_base64": None,
        "map_image_mime_type": None,
        "html_map_url": None,
        "structured_query": None,
        "confirmation_required": False,  # For HIL
        "confirmation_type": None,  # For HIL
        "thread_id": None,  # For HIL
        "hil_options": [],
        "message_id": None,  # Will be populated with db_message_id
    }
    full_streamed_content = ""
    configurable_values = config.get("configurable", {}) if config else {}
    db_message_id_from_config = configurable_values.get("db_message_id")
    user_id_from_config = configurable_values.get("user_id")  # Get user_id for DB ops
    thread_id_from_config = configurable_values.get("thread_id")

    if db_message_id_from_config is not None:
        final_response_obj["message_id"] = str(db_message_id_from_config)
    if thread_id_from_config is not None:
        final_response_obj["thread_id"] = str(thread_id_from_config)
        final_response_obj["conversation_id"] = str(thread_id_from_config)

    initial_metadata = {}
    if db_message_id_from_config is not None:
        initial_metadata["message_id"] = str(db_message_id_from_config)
    if thread_id_from_config is not None:
        initial_metadata["conversation_id"] = str(thread_id_from_config)
    if initial_metadata:
        metadata_packet = {
            "type": "metadata_update",
            "metadata": initial_metadata,
        }
        yield f"data: {json.dumps(metadata_packet)}\n\n"

    hil_interrupt = False
    try:
        async for chunk_event in graph.astream_events(inputs, config=config, version="v1"):
            kind = chunk_event["event"]

            if kind == "on_chat_model_stream":
                content = chunk_event["data"]["chunk"].content
                if content:
                    full_streamed_content += content
                    yield f"data: {json.dumps({'type': 'text_chunk', 'content': content})}\n\n"
            
            elif kind == "on_tool_end":
                tool_name = chunk_event.get("name")
                tool_output = chunk_event["data"].get("output")
                logging.info(f"[astream_events] Tool '{tool_name}' ended. Output type: {type(tool_output)}")
                if tool_name in ["generate_map_link", "generate_map_link_by_string_coordinates"] and isinstance(tool_output, dict):
                    final_response_obj["map_image_base64"] = tool_output.get("map_image_base64")
                    final_response_obj["map_image_mime_type"] = tool_output.get("map_image_mime_type")
                    final_response_obj["html_map_url"] = tool_output.get("html_map_url")
                    yield f"data: {json.dumps({'type': 'metadata_update', 'metadata': {'map_image_base64': final_response_obj['map_image_base64'], 'map_image_mime_type': final_response_obj['map_image_mime_type'], 'html_map_url': final_response_obj['html_map_url']}})}\n\n"

            elif kind == "on_chain_end":
                node_output = chunk_event["data"].get("output", {})
                if isinstance(node_output, dict) and "agent_output" in node_output:
                    agent_output_data = node_output["agent_output"]
                    if isinstance(agent_output_data, dict):
                        for key in ["citations", "suggested_questions", "usage_metadata", "is_evidence", "source_type", 
                                    "chart_image_base64", "chart_image_mime_type", 
                                    "map_image_base64", "map_image_mime_type", "html_map_url",
                                    "confirmation_required", "confirmation_type", "thread_id", "structured_query", "hil_options"]:
                            if key in agent_output_data:
                                final_response_obj[key] = agent_output_data[key]
                        if "answer" in agent_output_data and not full_streamed_content: # Prioritize streamed text
                            final_response_obj["answer"] = agent_output_data["answer"]
                        yield f"data: {json.dumps({'type': 'metadata_update', 'metadata': agent_output_data})}\n\n"
    except GraphInterrupt:
        hil_interrupt = True
        logging.info("[_collect_stream_chunks] GraphInterrupt caught during streaming; preparing HIL confirmation payload.")
        hil_answer = "I couldn't find relevant information in the internal documents. Would you like me to search the web instead?"
        final_response_obj.update({
            "answer": hil_answer,
            "confirmation_required": True,
            "confirmation_type": "web_search",
            "hil_options": [
                {"display_text": "Yes", "payload": "yes"},
                {"display_text": "No", "payload": "no"},
            ],
        })
        # Ensure the conversation/thread IDs are preserved for the client
        if thread_id_from_config:
            final_response_obj["thread_id"] = str(thread_id_from_config)
            final_response_obj["conversation_id"] = str(thread_id_from_config)
        # Emit a text chunk so the typing bubble immediately shows the prompt
        full_streamed_content = hil_answer
        logging.info("[_collect_stream_chunks] Emitting HIL text chunk for thread %s.", thread_id_from_config)
        yield f"data: {json.dumps({'type': 'text_chunk', 'content': hil_answer})}\n\n"
        hil_metadata = {
            "answer": hil_answer,
            "confirmation_required": True,
            "confirmation_type": "web_search",
            "hil_options": final_response_obj["hil_options"],
            "thread_id": final_response_obj.get("thread_id"),
        }
        yield f"data: {json.dumps({'type': 'metadata_update', 'metadata': hil_metadata})}\n\n"
    except Exception as stream_exc:
        logging.error("[_collect_stream_chunks] Unhandled exception during streaming: %s", stream_exc, exc_info=True)
        raise

    if not full_streamed_content and not final_response_obj.get("answer"):
        logging.info("[_collect_stream_chunks] Streaming fallback invoked for thread %s.", thread_id_from_config)
        hil_answer = "I couldn't find relevant information in the internal documents. Would you like me to search the web instead?"

        final_response_obj.update({
            "answer": hil_answer,
            "confirmation_required": True,
            "confirmation_type": "web_search",
            "hil_options": [
                {"display_text": "Yes", "payload": "yes"},
                {"display_text": "No", "payload": "no"},
            ],
        })

        if thread_id_from_config:
            final_response_obj["thread_id"] = str(thread_id_from_config)
            final_response_obj["conversation_id"] = str(thread_id_from_config)
        yield f"data: {json.dumps({'type': 'text_chunk', 'content': hil_answer})}\n\n"
        yield f"data: {json.dumps({'type': 'metadata_update', 'metadata': final_response_obj})}\n\n"
        full_streamed_content = hil_answer

    if full_streamed_content:
        final_response_obj["answer"] = full_streamed_content
    
    if db_message_id_from_config and user_id_from_config: # Ensure user_id is also present
        try:
            # Use agent_db_session which should be the scoped session from Flask-SQLAlchemy
            msg_to_update = agent_db_session.query(DB_MessageHistory).filter_by(message_id=db_message_id_from_config, user_id=user_id_from_config).first()
            if msg_to_update:
                msg_to_update.answer = final_response_obj.get("answer", "[No answer provided]")
                msg_to_update.citations = json.dumps(final_response_obj.get("citations", []))
                msg_to_update.usage_metadata = json.dumps(final_response_obj.get("usage_metadata", {}))
                msg_to_update.suggested_questions = json.dumps(final_response_obj.get("suggested_questions", []))
                msg_to_update.structured_query = final_response_obj.get("structured_query")
                # Add other fields like chart/map data if you decide to store them directly in MessageHistory
                # For example:
                # msg_to_update.map_image_base64 = final_response_obj.get("map_image_base64") # If you add such a column
                agent_db_session.commit()
                logging.info(f"[_collect_stream_chunks] Updated AI message in DB with message_id: {db_message_id_from_config}")
            else:
                logging.error(f"[_collect_stream_chunks] Could not find AI message with message_id {db_message_id_from_config} and user_id {user_id_from_config} to update.")
        except Exception as e_db_update:
            logging.error(f"[_collect_stream_chunks] Error updating DB entry for message_id {db_message_id_from_config}: {e_db_update}", exc_info=True)
            agent_db_session.rollback() # Rollback on error

    logging.debug(f"[astream_events] Final response object for end_of_stream: {final_response_obj}")
    yield f"data: {json.dumps({'type': 'end_of_stream', 'data': final_response_obj})}\n\n"


def invoke_agent_graph(
    query: str,
    chat_history: List[BaseMessage],
    vector_store_config: dict,
    stream: bool = False,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None,
    uploaded_file_content: Optional[str] = None,
    uploaded_file_type: Optional[str] = None,
    uploaded_file_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    **kwargs
):
    """Invokes the supervisor agent graph, handling streaming, HIL resumption, and normal queries."""
    initialize_llms()
    global compiled_supervisor_graph, _graph_built

    if compiled_supervisor_graph is None or not _graph_built:
        build_supervisor_graph()
    graph_to_invoke = compiled_supervisor_graph
    current_thread_id = conversation_id if conversation_id else str(uuid4())

    # --- HIL RESUMPTION LOGIC ---
    if chat_history:
        last_message = chat_history[-1]
        # Check if the last AI message was the HIL prompt
        if isinstance(last_message, AIMessage) and "Would you like me to search the web instead?" in last_message.content:
            resume_config = {"configurable": {"thread_id": current_thread_id}}
            
            positive_responses = ["yes", "y", "ok", "sure", "lanjutkan", "ya"]
            negative_responses = ["no", "n", "nope", "tidak", "jangan"]

            if query.lower().strip() in positive_responses:
                logging.info("HIL confirmation 'yes' received. Resuming graph for web search.")

                # Add flag to config to bypass the interrupt on resume
                resume_config["configurable"]["resume_after_hil_confirmation"] = True
                _mark_thread_hil_confirmed(current_thread_id)

                try:
                    # Call invoke with None to resume from the checkpoint
                    result_state = graph_to_invoke.invoke(None, config=resume_config)
                except GraphInterrupt:
                    logging.error("[invoke_agent_graph] CRITICAL: Graph was interrupted UNEXPECTEDLY during HIL resume.", exc_info=True)
                    return {
                        "answer": "I'm sorry, I encountered an unexpected issue while trying to search the web. Please try your query again.",
                        "conversation_id": current_thread_id
                    }
                
                # Process the resumed state and return
                agent_output_content = result_state.get("agent_output")
                if agent_output_content is None:
                    logging.error(f"Supervisor graph resume finished with no agent_output. Final state: {result_state}")
                    return {"answer": "Error: Agent workflow resume finished unexpectedly.", "citations": [], "suggested_questions": []}
                
                extracted_usage_for_return = result_state.get("current_turn_usage_metadata", {})
                final_answer_source = result_state.get("next", "Search_Agent")

                return {
                    "answer": agent_output_content.get("answer"),
                    "citations": agent_output_content.get("citations", []),
                    "suggested_questions": agent_output_content.get("suggested_questions", []),
                    "structured_query": agent_output_content.get("structured_query"),
                    "is_evidence": agent_output_content.get("is_evidence", False),
                    "chart_image_base64": agent_output_content.get("chart_image_base64"),
                    "chart_image_mime_type": agent_output_content.get("chart_image_mime_type"),
                    "map_image_base64": agent_output_content.get("map_image_base64"),
                    "map_image_mime_type": agent_output_content.get("map_image_mime_type"),
                    "html_map_url": agent_output_content.get("html_map_url"),
                    "conversation_id": current_thread_id,
                    "final_answer_source": final_answer_source,
                    "usage_metadata": extracted_usage_for_return
                }
            elif query.lower().strip() in negative_responses:
                logging.info("HIL confirmation 'no' received. Aborting web search.")
                return {"answer": "Okay, I will not search the web. How else can I help you?"}
    # --- END HIL RESUMPTION LOGIC ---

    # --- REGULAR INVOCATION LOGIC ---
    db_id_for_stream_chunks = kwargs.get("db_message_id_for_stream")
    user_id_for_stream_chunks = kwargs.get("user_id_for_stream")
    
    config = {
        "configurable": {
            "thread_id": str(current_thread_id),
            "db_message_id": db_id_for_stream_chunks,
            "user_id": user_id_for_stream_chunks
        }
    }

    persisted_image_b64, persisted_image_mime, loaded_dataframes_from_checkpoint, active_dataframe_id_from_checkpoint, df_agent_is_active_session_from_checkpoint = None, None, {}, None, False
    if compiled_supervisor_graph.checkpointer:
        checkpoint = compiled_supervisor_graph.checkpointer.get(config)
        if checkpoint:
            logging.info(f"Loaded checkpoint for conversation {current_thread_id}")
            last_state = checkpoint.get('channel_values')
            if last_state:
                persisted_image_b64 = last_state.get('persisted_image_base64')
                persisted_image_mime = last_state.get('persisted_image_mime_type')
                if persisted_image_b64: logging.info("Found persisted image in loaded checkpoint.")
                loaded_dataframes_from_checkpoint = last_state.get('loaded_dataframes', {})
                active_dataframe_id_from_checkpoint = last_state.get('active_dataframe_id')
                df_agent_is_active_session_from_checkpoint = last_state.get('df_agent_is_active_session', False)
                if loaded_dataframes_from_checkpoint: logging.info(f"Found persisted dataframe state: loaded {len(loaded_dataframes_from_checkpoint)} dataframes, active: {active_dataframe_id_from_checkpoint}")

    initial_state = SupervisorState(
        input=query, chat_history=chat_history, vector_store_config=vector_store_config, messages=[],
        current_turn_image_base64=image_base64, current_turn_image_mime_type=image_mime_type,
        persisted_image_base64=persisted_image_b64, persisted_image_mime_type=persisted_image_mime,
        df_agent_is_active_session=df_agent_is_active_session_from_checkpoint,
        loaded_dataframes=loaded_dataframes_from_checkpoint, active_dataframe_id=active_dataframe_id_from_checkpoint,
        uploaded_file_content=uploaded_file_content, uploaded_file_type=uploaded_file_type, uploaded_file_name=uploaded_file_name,
        next=None, agent_output=None, current_turn_usage_metadata={}, thread_id=str(current_thread_id)
    )

    config["interrupt_before"] = ["web_search"]
    config["recursion_limit"] = 100

    if stream:
        print("--- Invoking SUPERVISOR graph in STREAMING mode ---")
        try:
            streaming_config = config.copy()
            streaming_config.pop("interrupt_before", None)
            return _collect_stream_chunks(graph_to_invoke, initial_state, streaming_config)
        except Exception as e:
            logging.error(f"Error during agent streaming: {e}", exc_info=True)
            return {"type": "error", "message": str(e), "conversation_id": current_thread_id}
    else:
        print("--- Invoking SUPERVISOR graph in NON-STREAMING mode ---")
        result_state = None
        try:
            result_state = graph_to_invoke.invoke(initial_state, config=config)
        except Exception as main_invoke_err:
            logging.error(f"[invoke_agent_graph] Error invoking main graph: {main_invoke_err}", exc_info=True)
            return {"answer": f"Error during agent execution: {main_invoke_err}", "citations": [], "suggested_questions": []}
        
        if result_state is None:
            logging.error(f"Supervisor graph invocation failed unexpectedly, result_state is None.")
            return {"answer": "Error: Agent workflow failed unexpectedly.", "citations": [], "suggested_questions": []}

        final_output = result_state.get("agent_output")
        if final_output is None:
            logging.info(f"[invoke_agent_graph] Graph execution interrupted (agent_output is None). Thread ID: {config['configurable']['thread_id']}")
            return {
                "answer": "I couldn't find relevant information in the internal documents. Would you like me to search the web instead?",
                "confirmation_required": True,
                "confirmation_type": "web_search",
                "thread_id": current_thread_id,
                "hil_options": [
                    {"display_text": "Yes", "payload": "yes"},
                    {"display_text": "No", "payload": "no"}
                ]
            }
        elif isinstance(final_output, dict) and final_output.get("confirmation_required") is True:
            logging.info(f"[invoke_agent_graph] HIL confirmation structure received directly in agent_output. Thread ID: {final_output.get('thread_id')}")
            return final_output
        elif isinstance(final_output, str):
            logging.error(f"Supervisor graph finished with unexpected agent_output type: {type(final_output)}. Output: {final_output}")
            return {"answer": final_output, "citations": [], "suggested_questions": []}
        
        extracted_usage_for_return = result_state.get("current_turn_usage_metadata", {})
        logging.info(f"[invoke_agent_graph] Extracted 'current_turn_usage_metadata' from result_state FOR FINAL RETURN: {extracted_usage_for_return}")
        
        agent_output_content = result_state.get("agent_output", {})
        return {
            "answer": agent_output_content.get("answer"),
            "citations": agent_output_content.get("citations", []),
            "suggested_questions": agent_output_content.get("suggested_questions", []),
            "structured_query": agent_output_content.get("structured_query"),
            "is_evidence": agent_output_content.get("is_evidence", False),
            "chart_image_base64": agent_output_content.get("chart_image_base64"),
            "chart_image_mime_type": agent_output_content.get("chart_image_mime_type"),
            "map_image_base64": agent_output_content.get("map_image_base64"),
            "map_image_mime_type": agent_output_content.get("map_image_mime_type"),
            "html_map_url": agent_output_content.get("html_map_url"),
            "conversation_id": result_state.get("conversation_id", current_thread_id),
            "final_answer_source": result_state.get("next", "unknown"),
            "usage_metadata": extracted_usage_for_return
        }
