# /home/mlk/flaskrag3/modules/llm_utils.py

import os
import logging
import base64 # Added for image encoding
import mimetypes # Added for determining image type
from flask import current_app # Import current_app
from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
from langchain_core.exceptions import OutputParserException
import logging
import json
import re
from langchain_core.messages import HumanMessage # Added for multimodal input
from pathlib import Path # Added for path checking

logger = logging.getLogger(__name__) # Get a logger specific to this module
# Configure logging (can be further customized via app config later if needed)
logging.basicConfig(level=logging.INFO)
# Example: logging.basicConfig(level=current_app.config.get('LOG_LEVEL', 'INFO')) - but needs app context

# TODO: This should get prompt from llm_prompts Table
# purpose to help user create descrptions while edit in admin pages
def generate_simple_text(prompt: str, deployment_name: str) -> str:
    """
    Generates text using a specified Azure OpenAI deployment without RAG.

    Args:
        prompt: The input prompt for the LLM.
        deployment_name: The specific Azure OpenAI deployment name to use.

    Returns:
        The generated text content as a string.

    Raises:
        ValueError: If required environment variables are not set.
        Exception: For other API or processing errors.
    """
    # Get config from Flask app context
    azure_key = current_app.config.get("AZURE_OPENAI_API_KEY")
    azure_endpoint = current_app.config.get("AZURE_OPENAI_ENDPOINT")
    # Get version from config, falling back to the default specified in config.py if not set
    api_version = current_app.config.get("AZURE_OPENAI_API_VERSION")

    if not azure_key:
        logging.error("AZURE_OPENAI_API_KEY not found in application configuration.")
        raise ValueError("Server configuration error: Missing Azure API Key.")
    if not azure_endpoint:
        logging.error("AZURE_OPENAI_ENDPOINT not found in application configuration.")
        raise ValueError("Server configuration error: Missing Azure Endpoint.")
    if not api_version:
        # This case is less likely now with the default in config.py, but good practice
        logging.error("AZURE_OPENAI_API_VERSION not found in application configuration.")
        raise ValueError("Server configuration error: Missing Azure API Version.")

    try:
        # Correctly log the deployment name being used
        logging.info(f"Initializing AzureChatOpenAI with deployment='{deployment_name}', endpoint='{azure_endpoint}', api_version='{api_version}'")
        llm = get_llm(model_name=deployment_name)

        logging.info(f"Invoking LLM with prompt: '{prompt[:100]}...'")
        response = llm.invoke(prompt)
        logging.info("LLM invocation successful.")

        # Extract content, response structure might vary slightly
        if hasattr(response, 'content'):
            generated_text = response.content
        else:
            # Fallback if the structure is different (less common now)
            generated_text = str(response)

        return generated_text.strip()

    except OutputParserException as ope:
        logging.error(f"Output parsing error during LLM call: {ope}")
        # Sometimes the raw response might still be useful
        if hasattr(ope, 'llm_output'):
             return f"Error parsing response, raw output: {ope.llm_output}"
        raise Exception("Error parsing LLM response.") from ope
    except Exception as e:
        # Catch other potential errors (API connection, authentication, etc.)
        logging.error(f"Error during LLM text generation: {e}", exc_info=True)
        # Check for specific Azure content filter error messages
        if "content filter" in str(e).lower():
             raise ValueError(f"Content generation blocked by Azure content filter: {e}")
        raise Exception(f"Failed to generate text using LLM: {e}")

# --- Embedding Function Utility ---
# Change with
# BAAI Model
# https://python.langchain.com/docs/integrations/text_embedding/bge_huggingface/
AZURE_EMBEDDING_MODELS: set[str] = {"text-embedding-3-small", "text-embedding-3-large"}

embedding_function = None
#embedding_model_name= "Qwen/Qwen3-Embedding-0.6B" # New default model, change as needed
embedding_model_name = "BAAI/bge-m3" # Keep this if using bge-m3
#embedding_model_name = "all-MiniLM-L6-v2" # Reverted for compatibility if bge-m3 isn't set up
# Track whether we've already warmed the embedding pipeline during this process lifetime
_embedding_warmup_complete = False
# Check CUDA availability for model_kwargs
try:
    import torch
    if torch.cuda.is_available():
        model_kwargs = {"device": "cuda"}
        logging.info("CUDA is available. Setting embedding model device to 'cuda'.")
    else:
        model_kwargs = {"device": "cpu"}
        logging.info("CUDA not available. Setting embedding model device to 'cpu'.")
except ImportError:
    model_kwargs = {"device": "cpu"}
    logging.warning("PyTorch not found. Setting embedding model device to 'cpu'.")

encode_kwargs = {"normalize_embeddings": True} # Keep True for BGE, False or remove for MiniLM if needed
# query_instruction="Generate a representation for this sentence to be used for retrieving relevant articles:" # Specific to BGE, comment out if using MiniLM

def get_embedding_model_name():
    """Get the current default embedding model name from AppSettings, with fallback to hardcoded value."""
    try:
        # Import here to avoid circular imports
        from extensions import db
        from modules.database import AppSettings

        # This function should be called from within a request context.
        # The `current_app` proxy will be available.
        from flask import current_app
        setting = db.session.get(AppSettings, 'default_embedding_model')
        if setting and setting.value:
            return setting.value

    except Exception as e:
        # Log but don't fail - will fallback to hardcoded
        import logging
        logging.warning(f"Could not get embedding model from database: {e}")

    # Fallback to hardcoded value
    return embedding_model_name


def is_azure_embedding_model(model_name: str | None) -> bool:
    """Return True if the provided model name refers to an Azure-hosted embedding deployment."""
    if not model_name:
        return False
    return model_name in AZURE_EMBEDDING_MODELS


def requires_local_embedding(model_name: str | None) -> bool:
    """Determine whether the embedding model must run locally (Hugging Face) instead of via Azure."""
    return not is_azure_embedding_model(model_name)


def get_current_embedding_model():

    """Get the current embedding model, updating the global embedding_model_name variable."""
    global embedding_model_name
    current_model = get_embedding_model_name()
    embedding_model_name = current_model  # Update global variable so get_embedding_function() uses correct model
    return current_model

def invalidate_embedding():
    """Invalidate the cached embedding function to force reload with new model."""
    global embedding_function
    embedding_function = None  # Reset the cache
    logging.info("Invalidated cached embedding function.")

def get_embedding_function():
    """Gets a cached HuggingFaceEmbeddings instance."""
    global embedding_function
    if embedding_function is None:
        try:
            # Ensure embedding_model_name is set to the correct current model
            current_model = get_current_embedding_model()
            logging.info(f"Using embedding model: {current_model}")

            if is_azure_embedding_model(current_model):
                logging.info(f"Initializing Azure OpenAI Embeddings model: {current_model}")
                # For Azure embeddings, we need the endpoint, key, and version
                azure_key = current_app.config.get("AZURE_OPENAI_API_KEY")
                azure_endpoint = current_app.config.get("AZURE_OPENAI_ENDPOINT")
                api_version = current_app.config.get("AZURE_OPENAI_API_VERSION")

                if not all([azure_key, azure_endpoint, api_version]):
                    raise ValueError("Missing Azure configuration for embeddings (KEY, ENDPOINT, or VERSION).")

                # The 'model' parameter for AzureOpenAIEmbeddings is the DEPLOYMENT NAME in Azure
                embedding_function = AzureOpenAIEmbeddings(
                    azure_deployment=current_model,
                    azure_endpoint=azure_endpoint,
                    api_key=azure_key,
                    api_version=api_version,
                )
            else:
                try:
                    if current_model.lower().startswith("baai/bge"):
                        from langchain_community.embeddings import HuggingFaceBgeEmbeddings

                        bge_kwargs = {
                            "model_name": current_model,
                            "model_kwargs": model_kwargs,
                            "encode_kwargs": encode_kwargs,
                        }
                        if current_model == "BAAI/bge-m3":
                            # Per https://huggingface.co/BAAI/bge-m3#faq the query instruction must be empty.
                            bge_kwargs["query_instruction"] = ""
                        logging.info(
                            "Initializing HuggingFace BGE embeddings model: %s", current_model
                        )
                        embedding_function = HuggingFaceBgeEmbeddings(**bge_kwargs)
                    else:
                        from langchain_community.embeddings import HuggingFaceEmbeddings

                        logging.info(
                            "Initializing HuggingFace sentence-transformer embeddings model: %s",
                            current_model,
                        )
                        embedding_function = HuggingFaceEmbeddings(
                            model_name=current_model,
                            model_kwargs=model_kwargs,
                            encode_kwargs=encode_kwargs,
                        )
                except ImportError as import_err:
                    logging.error(
                        "Local embeddings requested but required HuggingFace dependencies are not installed."
                    )
                    raise RuntimeError(
                        "Local embedding models require 'langchain-community' with HuggingFace support "
                        "and 'sentence-transformers'. Install them in the worker image or use an Azure "
                        "OpenAI embedding deployment instead."
                    ) from import_err
            logging.info("Embeddings model initialized successfully.")
        except Exception as e:
            logging.error(f"Fatal Error: Could not initialize embeddings: {e}", exc_info=True)
            raise RuntimeError("Failed to initialize embedding model.") from e
    return embedding_function


def warmup_embedding_model(sample_text: str | None = None, *, force: bool = False) -> bool:
    """Prime the embedding pipeline so the first user query is responsive."""
    global _embedding_warmup_complete

    if _embedding_warmup_complete and not force:
        logging.info("Embedding warmup already completed for this process; skipping.")
        return False

    try:
        embedder = get_embedding_function()
        if embedder is None:
            logging.warning("Embedding warmup skipped: no embedding function available.")
            return False

        text_to_embed = (sample_text or "SmartLib warmup prompt")

        if hasattr(embedder, "embed_query"):
            embedder.embed_query(text_to_embed)
        elif hasattr(embedder, "embed_documents"):
            embedder.embed_documents([text_to_embed])
        else:
            logging.warning("Embedding warmup skipped: embedder lacks embed_query/embed_documents.")
            return False

        _embedding_warmup_complete = True
        logging.info("Embedding warmup executed successfully.")
        return True
    except Exception as exc:
        logging.warning("Embedding warmup failed: %s", exc, exc_info=True)
        return False


def get_llm(model_name=None, streaming=False, temperature=None):
    """
    Gets a cached LLM instance.
    If model_name is not provided, it reads the default from the ModelConfig table.
    """
    # Determine the deployment name first
    if model_name:
        azure_deployment = model_name
        logging.info(f"get_llm: Using explicit model_name: {model_name}")
    else:
        try:
            from flask import current_app
            with current_app.app_context():
                from modules.database import get_default_model
                default_model_obj = get_default_model()
                logging.info(f"get_llm: default_model_obj from DB is: {default_model_obj}")
            if default_model_obj and isinstance(default_model_obj, dict) and default_model_obj.get('deployment_name'):
                azure_deployment = default_model_obj['deployment_name']
                logging.info(f"get_llm: Using default model from DB: {azure_deployment}")
                if temperature is None and default_model_obj.get('temperature') is not None:
                    temperature = default_model_obj['temperature']
                if not streaming and default_model_obj.get('streaming'):
                    streaming = bool(default_model_obj['streaming'])
            else:
                from flask import current_app
                logging.info(f"get_llm: Condition for using DB model failed. default_model_obj: {default_model_obj}")
                azure_deployment = current_app.config.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
                logging.info(f"get_llm: No default model in DB or object invalid, falling back to app config: {azure_deployment}")
        except Exception as e:
            logging.warning(f"Could not read default model from DB: {e}. Falling back to app config.")
            from flask import current_app
            azure_deployment = current_app.config.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
            logging.info(f"get_llm: Exception reading default model, falling back to app config: {azure_deployment}")

    # Use the caching mechanism
    return get_or_create_llm_for_deployment(azure_deployment, streaming=streaming, temperature=temperature)


# --- LLM cache + invalidate helpers (minimal reload support) ---
# Simple in-process cache for per-deployment LLM instances and an invalidate helper.
# This supports the "minimal" workflow for single-process servers: admin sets default model,
# then backend calls `invalidate_llm()` to force the next request to recreate the LLM client.
_llm_cache = {}

def get_or_create_llm_for_deployment(deployment_name: str, streaming: bool = False, temperature=None):
    """
    Return a cached AzureChatOpenAI instance for the given deployment_name, creating and caching
    it on first use. Use this in code paths where you want per-deployment instances while avoiding
    a full service restart after admin changes.
    """
    # Lazy import current_app to avoid import-time app context issues
    from flask import current_app as _current_app
    key = deployment_name or _current_app.config.get("AZURE_OPENAI_DEPLOYMENT_NAME")
    if key in _llm_cache:
        # Check if settings are compatible, if not, might need to re-create
        cached_llm = _llm_cache[key]
        if cached_llm.streaming == streaming and (temperature is None or cached_llm.temperature == temperature):
            return cached_llm
        else:
            logging.info(f"LLM for {key} found in cache, but with different settings. Re-creating.")

    # Get config from Flask app context
    azure_key = _current_app.config.get("AZURE_OPENAI_API_KEY")
    azure_endpoint = _current_app.config.get("AZURE_OPENAI_ENDPOINT")
    api_version = _current_app.config.get("AZURE_OPENAI_API_VERSION")

    if not all([azure_key, azure_endpoint, api_version, key]):
        raise ValueError("Missing Azure configuration for LLM.")

    logging.info(f"Creating and caching LLM for deployment: {key}")
    temp_value = 0.1 if temperature is None else float(temperature)
    
    inst = AzureChatOpenAI(
        azure_deployment=key,
        azure_endpoint=azure_endpoint,
        api_key=azure_key,
        api_version=api_version,
        temperature=temp_value,
        streaming=streaming,
    )
    _llm_cache[key] = inst
    return inst




# --- Agent LLM Adapter & Capability Registry ---
# Registry mapping common deployment identifiers to capabilities and recommended settings.
# Update this registry when adding new deployments or families.
MODEL_CAPABILITY_REGISTRY = {
    # Example entries. Add real deployment names used in your Azure setup as keys.
    "gpt-4o-mini": {
        "family": "gpt-4o",
        "supports_multimodal": True,
        "supports_tool_calls": True,
        "recommended_temperature_by_role": {"router": 0.05, "grade": 0.05, "generate": 0.15},
        "max_payload_bytes": 4 * 1024 * 1024,
        "notes": "Good for orchestration and tool-calling."
    },
    "gpt-4o": {
        "family": "gpt-4o",
        "supports_multimodal": True,
        "supports_tool_calls": True,
        "recommended_temperature_by_role": {"router": 0.05, "grade": 0.05, "generate": 0.2},
        "max_payload_bytes": 8 * 1024 * 1024,
        "notes": "Multimodal model for vision tasks."
    },
    "gpt-5-chat": {
        "family": "gpt-5",
        "supports_multimodal": True,
        "supports_tool_calls": True,
        "recommended_temperature_by_role": {"router": 0.05, "grade": 0.05, "generate": 0.2},
        "max_payload_bytes": 8 * 1024 * 1024,
        "notes": "Powerful model — enforce strict output schemas for decision nodes."
    },
    "gpt-5-mini": {
        "family": "gpt-5",
        "supports_multimodal": False,
        "supports_tool_calls": False,
        "recommended_temperature_by_role": {"router": 0.2, "grade": 0.2, "generate": 1.0},
        "max_payload_bytes": 2 * 1024 * 1024,
        "notes": "Mini variants may require special temperature settings; avoid for orchestration."
    }
}

def _detect_family_from_deployment(deployment_name: str) -> str:
    """Try to infer a model family from a deployment name by simple substring matching."""
    if not deployment_name:
        return "unknown"
    dn = deployment_name.lower()
    if "gpt-5" in dn or "gpt5" in dn:
        return "gpt-5"
    if "gpt-4" in dn or "gpt4" in dn or "gpt-4o" in dn or "gpt4o" in dn:
        return "gpt-4"
    return "unknown"

def probe_model_compatibility(deployment_name: str, checks: list = None, timeout: int = 8) -> dict:
    """
    Optional runtime probe to sanity-check a deployment for basic orchestration compatibility.
    This function is safe to call but may incur a small LLM API call. It returns a dict:
    { "deployment_name": str, "ok": bool, "reasons": [str], "capabilities": {...} }
    """
    from modules.database import get_default_model
    import time
    if checks is None:
        checks = ["routing_token", "json_grade"]
    result = {"deployment_name": deployment_name, "ok": True, "reasons": [], "capabilities": {}}
    try:
        # Attempt to get a quick llm instance for the deployment with low temperature.
        llm_probe = get_llm(model_name=deployment_name, streaming=False, temperature=0.0)
    except Exception as e:
        result["ok"] = False
        result["reasons"].append(f"Could not initialize LLM for deployment '{deployment_name}': {e}")
        return result

    # Basic probes are intentionally small and strict; we do not rely on them heavily here.
    try:
        if "routing_token" in checks:
            probe_prompt = "Return exactly one token: RAG_Agent"
            resp = llm_probe.invoke(probe_prompt)
            content = resp.content if hasattr(resp, "content") else str(resp)
            if "RAG_Agent" not in content.strip().split():
                result["ok"] = False
                result["reasons"].append("Routing probe did not return exact token 'RAG_Agent'.")
        if "json_grade" in checks:
            probe_prompt = "Return exactly JSON: {\"score\":\"yes\",\"reason\":\"ok\"}"
            resp = llm_probe.invoke(probe_prompt)
            content = resp.content if hasattr(resp, "content") else str(resp)
            if "score" not in content or "yes" not in content:
                result["ok"] = False
                result["reasons"].append("JSON grading probe did not return expected JSON structure.")
    except Exception as e:
        result["ok"] = False
        result["reasons"].append(f"Error during probe calls: {e}")

    # Attach capability hints from registry if available
    caps = MODEL_CAPABILITY_REGISTRY.get(deployment_name) or {}
    result["capabilities"] = caps
    return result

def get_agent_llm(model_config: dict = None, deployment_name: str = None, role: str = "router", allow_fallback: bool = True):
    """
    Adapter that returns an AzureChatOpenAI instance configured for a specific agent role.
    - model_config: optional dict from ModelConfig.to_dict()
    - deployment_name: alternative to pass a raw deployment string
    - role: one of "router", "grade", "generate", "search", "chitchat"
    - allow_fallback: if True, a compatible default model will be returned if the requested
                      deployment is incompatible for the role; otherwise an exception is raised.
    """
    from flask import current_app
    from modules.database import get_default_model
    # Resolve model_config or deployment_name to a deployment
    if model_config is None:
        if deployment_name is None:
            model_config = get_default_model()
        else:
            model_config = {"deployment_name": deployment_name, "temperature": None, "streaming": False}

    deployment = deployment_name or (model_config.get("deployment_name") if model_config else None)
    # Basic sanity
    if not deployment:
        # Try again from default
        default_model = get_default_model()
        if default_model:
            deployment = default_model.get("deployment_name")
            model_config = default_model
        else:
            raise ValueError("No model deployment provided and no default model configured.")

    # Lookup registry capabilities (best-effort)
    caps = MODEL_CAPABILITY_REGISTRY.get(deployment, {})
    if not caps:
        # Try family fallback
        family = _detect_family_from_deployment(deployment)
        for k, v in MODEL_CAPABILITY_REGISTRY.items():
            if v.get("family") == family:
                caps = v
                break

    # Determine temperature: prefer explicit config, then registry
    explicit_temp = (model_config.get("temperature") if isinstance(model_config, dict) else None)
    if explicit_temp is not None:
        temp = float(explicit_temp)
    else:
        temp = caps.get("recommended_temperature_by_role", {}).get(role, 0.1)

    # Determine streaming preference
    streaming = bool(model_config.get("streaming")) if isinstance(model_config, dict) and model_config.get("streaming") is not None else False

    # Capability enforcement for critical roles
    if role in ("router", "grade") and not caps.get("supports_tool_calls", True):
        # If incompatible and fallback allowed, use default model
        msg = f"Requested model '{deployment}' may not support orchestration requirements for role '{role}'."
        if allow_fallback:
            default_model = get_default_model()
            if default_model and default_model.get("deployment_name") != deployment:
                # Use default model as fallback
                fallback_deployment = default_model.get("deployment_name")
                temp = default_model.get("temperature") if default_model.get("temperature") is not None else temp
                streaming = default_model.get("streaming", streaming)
                deployment = fallback_deployment
            else:
                # No other default to fallback to; raise
                raise RuntimeError(msg + " No fallback available.")
        else:
            raise RuntimeError(msg)

    # Construct and return AzureChatOpenAI using the common code path (delegates to get_llm)
    try:
        llm_instance = get_llm(model_name=deployment, streaming=streaming, temperature=temp)
        return llm_instance
    except Exception as e:
        # If creation fails and fallback allowed, attempt fallback to default model
        if allow_fallback:
            default_model = get_default_model()
            if default_model and default_model.get("deployment_name") != deployment:
                try:
                    return get_llm(model_name=default_model.get("deployment_name"),
                                   streaming=default_model.get("streaming", False),
                                   temperature=(default_model.get("temperature") if default_model.get("temperature") is not None else temp))
                except Exception:
                    raise RuntimeError(f"Failed to initialize fallback model after error: {e}")
        raise


def invalidate_llm(deployment_name: str = None):
    """
    Invalidate a cached LLM. If deployment_name is None, clear the whole cache and
    reset the global initialized flags so initialize_llms() will re-create clients.
    Call this after set_default_model in admin to pick up new defaults without restarting.
    """
    global _llm_cache, llm, llm_with_map_tools, llm_initialized
    if deployment_name:
        # delete specific entry if present
        if deployment_name in _llm_cache:
            try:
                del _llm_cache[deployment_name]
                logging.info(f"Invalidated cached LLM for deployment: {deployment_name}")
            except Exception as e:
                logging.warning(f"Error invalidating cached LLM for {deployment_name}: {e}")
    else:
        # clear entire cache
        _llm_cache.clear()
        logging.info("Invalidated all cached LLM instances.")

    # Also clear the global single-client state so next initialize will recreate it
    llm = None
    llm_with_map_tools = None
    llm_initialized = False
    logging.info(f"Global LLM state reset (deployment_name={deployment_name}).")

# --- Prompt Management Utilities ---
def get_active_prompt_content(prompt_name, fallback=None):
    """
    Fetch the active prompt content by name from the llm_prompts table.

    Only prompts with is_active=True are considered. If no active prompt is found for the given name,
    the fallback value is returned (typically a hardcoded default prompt).

    This ensures that only prompts marked as active in the /admin prompt management UI are used
    for RAG Q&A, follow-up, and admin description generation. If no active prompt is present,
    the system will always use the default.

    Returns the prompt content string if found and active, else returns fallback.
    """
    from modules.database import LLMPrompt
    from flask import current_app
    try:
        # Ensure this runs within an app context if called during app startup
        with current_app.app_context():
            prompt = LLMPrompt.query.filter_by(name=prompt_name, is_active=True).first()
            if prompt and prompt.content:
                return prompt.content
            else:
                current_app.logger.warning(f"Prompt '{prompt_name}' not found or inactive in llm_prompts. Using fallback.")
                return fallback
    except RuntimeError as e:
        # Handle cases where app context is not available (e.g., background tasks without context)
        logging.error(f"Could not access Flask app context to fetch prompt '{prompt_name}': {e}. Using fallback.")
        return fallback
    except Exception as e:
        # Log other potential DB errors
        logging.error(f"Error fetching prompt '{prompt_name}': {e}")
        return fallback

# --- Metadata Classification ---

# Define default fields, could be made configurable via AppSettings later
DEFAULT_METADATA_FIELDS = [
    "Document Type (e.g., Invoice, Manual, Datasheet, Report, Letter, Email, Presentation, Other)",
    "Brand/Manufacturer/Organization (if applicable, e.g., Sony, Dell, Siemens, WHO)",
    "Product/Model Name/Service (if applicable, e.g., Bravia X90J, XPS 13, S7-1200, COVID-19 Report)",
    "Main Subject/Topic (concise summary)",
    "Language (e.g., English, German, French)"
]
# Create JSON keys from fields (simple conversion: lowercase, replace space/slash with underscore, remove parentheticals)
DEFAULT_JSON_KEYS = [
    re.sub(r'\s*\(.*\)\s*', '', field).strip().lower().replace('/', '_').replace(' ', '_')
    for field in DEFAULT_METADATA_FIELDS
]

def _parse_llm_json_output(raw_output: str, expected_keys: list, logger) -> dict:
    """Helper function to parse JSON from LLM output robustly."""
    metadata = None
    try:
        # Try direct parsing first, stripping potential whitespace
        metadata = json.loads(raw_output.strip())
    except json.JSONDecodeError:
        # If direct parsing fails, try finding JSON within ```json ... ``` or just { ... }
        logger.warning("Direct JSON parsing failed, attempting regex extraction.")
        match = re.search(r'```json\s*(\{.*?\})\s*```', raw_output, re.DOTALL)
        if not match:
            match = re.search(r'(\{.*?\})', raw_output, re.DOTALL) # Find first {} block

        if match:
            json_str = match.group(1)
            try:
                metadata = json.loads(json_str)
                logger.info("Successfully extracted JSON using regex.")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse extracted JSON string: '{json_str}'. Error: {e}")
                return {"error": "Failed to parse LLM response JSON", "raw_output": raw_output}
        else:
            logger.error(f"Could not find valid JSON in LLM output: {raw_output}")
            return {"error": "Could not find JSON in LLM response", "raw_output": raw_output}

    # Basic validation
    if not isinstance(metadata, dict):
         logger.error(f"LLM output parsed, but is not a dictionary: {metadata}")
         return {"error": "LLM response was not a valid JSON object", "raw_output": raw_output}

    # Ensure all expected keys are present, adding missing ones as null
    final_metadata = {}
    for key in expected_keys:
        final_metadata[key] = metadata.get(key) # Use .get() for safety

    logger.info(f"Successfully extracted and validated metadata: {final_metadata}")
    return final_metadata

def classify_document_metadata(document_content_summary: str,
                               desired_fields: list = None,
                               json_keys: list = None,
                               logger_param=None) -> dict: # Renamed logger to logger_param
    """
    Uses an LLM (via Azure OpenAI) to classify a document *text summary* and extract metadata.

    Args:
        document_content_summary: A string containing a summary or the first
                                  N characters of the document content.
        desired_fields: A list of strings describing the metadata fields to extract.
                        Defaults to DEFAULT_METADATA_FIELDS.
        json_keys: A list of strings representing the JSON keys corresponding to desired_fields.
                   Defaults to DEFAULT_JSON_KEYS.
        logger_param: An optional logger instance. If None, the module-level logger is used.

    Returns:
        A dictionary containing the extracted metadata, or a dictionary with an 'error' key
        if classification fails.
    """
    
    # Use provided logger or default to module-level logger
    effective_logger = logger_param if logger_param else logger

    if not document_content_summary:
        effective_logger.warning("classify_document_metadata called with empty summary.")
        return {"error": "Input summary is empty."}

    if desired_fields is None:
        desired_fields = DEFAULT_METADATA_FIELDS
    if json_keys is None:
        json_keys = DEFAULT_JSON_KEYS
    if len(desired_fields) != len(json_keys):
         effective_logger.error("Mismatch between desired_fields and json_keys length.")
         return {"error": "Configuration error: fields and keys mismatch."}

    # Get the deployment name for classification (can be different from RAG)
    # Fallback to the query deployment if a specific one isn't set
    try:
        classification_deployment = current_app.config.get(
            "AZURE_OPENAI_DEPLOYMENT_NAME", # Specific config for this task
            current_app.config.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini") # Fallback to query model
        )
        effective_logger.info(f"Using deployment '{classification_deployment}' for text metadata classification.")
    except RuntimeError as e:
        effective_logger.error(f"Could not access Flask current_app context: {e}. Ensure this runs within a request context or app context.")
        return {"error": "Application context error."}
    except Exception as e:
        effective_logger.error(f"Error getting classification deployment config: {e}")
        return {"error": "Configuration error."}


    # Construct the prompt dynamically
    fields_list_str = "\n".join([f"- {field}" for field in desired_fields])
    keys_list_str = ", ".join([f'"{key}"' for key in json_keys])
    # Create a placeholder example JSON structure
    example_json_lines = [f'  "{key}": "..."' for key in json_keys]
    example_json = "{\n" + ",\n".join(example_json_lines) + "\n}"


    prompt = f"""
You are an expert document classifier. Analyze the provided text summary and extract the following metadata if present:
{fields_list_str}

Return the results ONLY as a valid JSON object with the keys: {keys_list_str}.
If a field is not applicable or cannot be determined from the summary, use null or an empty string "" for its value.
Do not add any text, explanations, or markdown formatting before or after the JSON object. Just output the raw JSON.

Example of the required JSON format:
{example_json}

Document Summary to Analyze:
---
{document_content_summary[:4000]}
---

Extracted Metadata (JSON only):
""" # Limit summary size to avoid exceeding token limits

    try:
        # Use generate_simple_text which handles LLM setup and potential config errors
        raw_output = generate_simple_text(prompt, deployment_name=classification_deployment)
        effective_logger.debug(f"Raw LLM output for metadata: {raw_output}")

        # Use the helper function to parse the output
        return _parse_llm_json_output(raw_output, json_keys, effective_logger)

    except ValueError as ve: # Catch config errors from generate_simple_text (e.g., missing keys/endpoint)
         effective_logger.error(f"Configuration error during metadata classification: {ve}")
         return {"error": f"LLM Configuration Error: {str(ve)}"}
    except Exception as e:
        effective_logger.error(f"Unexpected error during metadata classification: {e}", exc_info=True)
        # Check for content filter specifically, as generate_simple_text might raise ValueError for it
        if "content filter" in str(e).lower():
             effective_logger.warning(f"Metadata extraction blocked by content filter: {e}")
             return {"error": "Content filter triggered during metadata extraction"}
        return {"error": f"Unexpected error during LLM call: {str(e)}"}


# --- NEW Multimodal Metadata Classification Function ---

def _encode_image(image_path: str) -> tuple[str | None, str | None]:
    """Encodes a local image file into a base64 string and determines MIME type."""
    try:
        mime_type, _ = mimetypes.guess_type(image_path)
        if not mime_type or not mime_type.startswith('image/'):
            logging.warning(f"Could not determine valid image MIME type for {image_path}")
            # Default or raise error? Let's default for now, LLM might handle it.
            mime_type = 'image/jpeg' # Common default

        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        return encoded_string, mime_type
    except FileNotFoundError:
        logging.error(f"Image file not found at path: {image_path}")
        return None, None
    except Exception as e:
        logging.error(f"Error encoding image {image_path}: {e}")
        return None, None

def classify_document_metadata_multimodal(
    image_path: str = None,
    image_base64: str = None,
    mime_type: str = None, # Optional: provide if known, especially for base64
    desired_fields: list = None,
    json_keys: list = None,
    logger_param=None # Renamed logger to logger_param
) -> dict:
    """
    Uses a multimodal LLM (via Azure OpenAI) to classify a document *image* and extract metadata.

    Args:
        image_path: Path to the local image file. Provide either this or image_base64.
        image_base64: Base64 encoded string of the image. Provide either this or image_path.
        mime_type: The MIME type of the image (e.g., 'image/jpeg', 'image/png').
                   Required if image_base64 is provided without a data URI prefix.
                   If image_path is provided, it will be inferred.
        desired_fields: A list of strings describing the metadata fields to extract.
                        Defaults to DEFAULT_METADATA_FIELDS.
        json_keys: A list of strings representing the JSON keys corresponding to desired_fields.
                   Defaults to DEFAULT_JSON_KEYS.
        logger_param: An optional logger instance. If None, the module-level logger is used.

    Returns:
        A dictionary containing the extracted metadata, or a dictionary with an 'error' key
        if classification fails.
    """
    
    # Use provided logger or default to module-level logger
    effective_logger = logger_param if logger_param else logger

    if not image_path and not image_base64:
        effective_logger.error("classify_document_metadata_multimodal requires either image_path or image_base64.")
        return {"error": "No image input provided."}
    if image_path and image_base64:
        effective_logger.error("Provide either image_path or image_base64, not both.")
        return {"error": "Ambiguous image input."}

    base64_image_data = None
    final_mime_type = mime_type

    if image_path:
        effective_logger.info(f"Encoding image from path: {image_path}")
        base64_image_data, inferred_mime_type = _encode_image(image_path)
        if not base64_image_data:
            return {"error": f"Failed to encode image from path: {image_path}"}
        if not final_mime_type: # Use inferred type if none was provided
            final_mime_type = inferred_mime_type
    elif image_base64:
        # Check if it's a data URI
        if image_base64.startswith('data:image/'):
            try:
                header, encoded = image_base64.split(',', 1)
                final_mime_type = header.split(';')[0].split(':')[1]
                base64_image_data = encoded
                effective_logger.info(f"Extracted base64 data and MIME type ({final_mime_type}) from data URI.")
            except Exception as e:
                effective_logger.error(f"Error parsing image data URI: {e}")
                return {"error": "Invalid image data URI format."}
        else:
            # Assume raw base64 string
            base64_image_data = image_base64
            if not final_mime_type:
                # Attempt to guess based on typical base64 starts, or default
                # This is unreliable; better to require mime_type if using raw base64
                effective_logger.warning("Raw base64 image provided without MIME type. Defaulting to image/jpeg. Provide mime_type for accuracy.")
                final_mime_type = 'image/jpeg'
            effective_logger.info(f"Using provided raw base64 image data with MIME type: {final_mime_type}")

    if not base64_image_data:
         return {"error": "Failed to obtain base64 image data."}
    if not final_mime_type:
         # Should have been set by now, but double-check
         effective_logger.error("Could not determine image MIME type.")
         return {"error": "Missing image MIME type."}


    if desired_fields is None:
        desired_fields = DEFAULT_METADATA_FIELDS
    if json_keys is None:
        json_keys = DEFAULT_JSON_KEYS
    if len(desired_fields) != len(json_keys):
         effective_logger.error("Mismatch between desired_fields and json_keys length.")
         return {"error": "Configuration error: fields and keys mismatch."}

    # --- Get LLM Configuration ---
    # Default to gpt-4o for multimodal since gpt-4o-mini may not support it or be deployed incorrectly
    try:
        azure_key = current_app.config.get("AZURE_OPENAI_API_KEY")
        azure_endpoint = current_app.config.get("AZURE_OPENAI_ENDPOINT")
        api_version = current_app.config.get("AZURE_OPENAI_API_VERSION")
        # Use a specific deployment for multimodal, defaulting to gpt-4o
        multimodal_deployment = current_app.config.get(
            "AZURE_OPENAI_MULTIMODAL_DEPLOYMENT", "gpt-4o"
        )
        effective_logger.info(f"Using deployment '{multimodal_deployment}' for multimodal metadata classification.")

        if not all([azure_key, azure_endpoint, api_version, multimodal_deployment]):
            missing = [k for k, v in {
                "AZURE_OPENAI_API_KEY": azure_key,
                "AZURE_OPENAI_ENDPOINT": azure_endpoint,
                "AZURE_OPENAI_API_VERSION": api_version,
                "Multimodal Deployment": multimodal_deployment
            }.items() if not v]
            effective_logger.error(f"Missing Azure OpenAI configuration: {', '.join(missing)}")
            return {"error": f"Server configuration error: Missing {', '.join(missing)}"}

    except RuntimeError as e:
        effective_logger.error(f"Could not access Flask current_app context: {e}. Ensure this runs within a request context or app context.")
        return {"error": "Application context error."}
    except Exception as e:
        effective_logger.error(f"Error getting multimodal deployment config: {e}")
        return {"error": "Configuration error."}

    # --- Construct Prompt and Messages ---
    fields_list_str = "\n".join([f"- {field}" for field in desired_fields])
    keys_list_str = ", ".join([f'"{key}"' for key in json_keys])
    example_json_lines = [f'  "{key}": "..."' for key in json_keys]
    example_json = "{\n" + ",\n".join(example_json_lines) + "\n}"

    # Text part of the prompt for the LLM
    text_prompt = f"""
You are an expert document classifier. Analyze the provided image and extract the following metadata if present:
{fields_list_str}

Return the results ONLY as a valid JSON object with the keys: {keys_list_str}.
If a field is not applicable or cannot be determined from the image, use null or an empty string "" for its value.
Do not add any text, explanations, or markdown formatting before or after the JSON object. Just output the raw JSON.

Example of the required JSON format:
{example_json}

Extracted Metadata (JSON only):
"""

    # Construct the message payload for Langchain multimodal
    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": text_prompt,
            },
            {
                "type": "image_url",
                "image_url": {"url": f"data:{final_mime_type};base64,{base64_image_data}"},
            },
        ]
    )

    # --- Call LLM ---
    try:
        effective_logger.info(f"Initializing AzureChatOpenAI with multimodal deployment='{multimodal_deployment}'")
        llm = get_llm(model_name=multimodal_deployment)
        effective_logger.info("Invoking multimodal LLM...")
        response = llm.invoke([message]) # Pass message list
        effective_logger.info("Multimodal LLM invocation successful.")

        if hasattr(response, 'content'):
            raw_output = response.content
        else:
            raw_output = str(response)

        effective_logger.debug(f"Raw LLM output for multimodal metadata: {raw_output}")

        # Use the helper function to parse the output
        return _parse_llm_json_output(raw_output, json_keys, effective_logger)

    except ValueError as ve: # Catch config errors (less likely here, but possible)
         effective_logger.error(f"Configuration error during multimodal metadata classification: {ve}")
         return {"error": f"LLM Configuration Error: {str(ve)}"}
    except Exception as e:
        effective_logger.error(f"Unexpected error during multimodal metadata classification: {e}", exc_info=True)
        if "content filter" in str(e).lower():
             effective_logger.warning(f"Multimodal metadata extraction blocked by content filter: {e}")
             return {"error": "Content filter triggered during metadata extraction"}
        # Handle potential API errors like invalid image format, size limits etc.
        if "InvalidImageUrl" in str(e) or "Image size exceeds the limit" in str(e):
             logger.error(f"Azure OpenAI API error related to image: {e}")
             return {"error": f"Image processing error by API: {str(e)}"}
        return {"error": f"Unexpected error during multimodal LLM call: {str(e)}"}


# New helper function for Langchain FAISS store path using pathlib
def get_lc_store_path(user_id=None, knowledge_id=None, mode_param=None): # Renamed parameter to avoid conflict
    """
    Returns the Path object for the Langchain FAISS store based on the current vector store mode.
    Modes:
      - user: faiss_indexes/{user_id}/stores/
      - global: faiss_indexes/global/stores/
      - knowledge: faiss_indexes/knowledge_{knowledge_id}/stores/
    """
    from extensions import db
    from modules.database import AppSettings

    mode = None
    # Use mode_param if provided, otherwise use config.
    if mode_param is not None:
        mode = mode_param

    # If mode is still not set, try to get it from the database or app config.
    if mode is None:
        try:
            # This needs an app context to work, which might not always be available
            # when called from background tasks.
            from flask import current_app
            if current_app:
                # First, try the database setting
                with current_app.app_context():
                    setting = db.session.get(AppSettings, 'vector_store_mode')
                    if setting and setting.value:
                        mode = setting.value

                # If not in DB, try the app config (loaded on startup)
                if mode is None:
                    mode = current_app.config.get('VECTOR_STORE_MODE')

        except (ImportError, RuntimeError) as e:
            logger.warning(f"Could not get vector_store_mode from DB/config (no app context?): {e}. Will use fallback.")

    # Final fallback if no mode could be determined
    if mode is None:
        mode = 'user' 
        
    logger.info(f"VECTOR_STORE_MODE: {mode}")
    
    base_path = None
    try:
        from flask import current_app
        if current_app:
            configured = current_app.config.get('LOCAL_VECTOR_STORE_BASE_PATH')
            if configured:
                base_path = Path(configured)
    except Exception as cfg_exc:
        logger.debug(f"Falling back to default Chroma base path: {cfg_exc}")

    if base_path is None:
        base_path = Path('data') / 'chroma'

    if mode == 'user':
        if user_id is None:
            raise ValueError("user_id is required for user mode")
        return base_path / str(user_id)
    elif mode == 'global':
        return base_path / 'global'
    elif mode == 'knowledge':
        if knowledge_id is None:
            raise ValueError("knowledge_id is required for knowledge mode")
        return base_path / f'knowledge_{knowledge_id}'
    else:
        raise ValueError(f"Unknown vector store mode: {mode}")


def normalize_outgoing_messages(messages):
    """
    Normalize outgoing messages into a conservative, model-safe representation.

    - Accepts a list of message-like objects (strings, HumanMessage, dict/list multimodal payloads).
    - Returns a list of HumanMessage instances whose content is a plain string.
    - If a message contains an inline image_url element (data: or http(s:)), the URL is appended
      to the textual content in parentheses to keep payload small and consistent with most wrappers.

    This function intentionally keeps message content string-based to avoid model-wrapper
    differences when passing complex list/dict content directly to AzureChatOpenAI.
    """
    normalized = []
    # Lazy import to avoid circular deps
    from langchain_core.messages import HumanMessage as _HumanMessage

    if messages is None:
        return []

    # If a single string was passed, wrap it
    if isinstance(messages, str):
        return [_HumanMessage(content=messages)]

    # Iterable processing
    for m in messages:
        try:
            # If it's already a HumanMessage-like with a 'content' attribute, coerce that
            content = None
            if hasattr(m, "content"):
                content = m.content
            else:
                content = m

            # If content is a list (multimodal parts), flatten conservatively
            if isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict):
                        ptype = part.get("type")
                        if ptype == "text":
                            parts.append(str(part.get("text", "")).strip())
                        elif ptype == "image_url":
                            url_obj = part.get("image_url") or {}
                            url = url_obj.get("url") if isinstance(url_obj, dict) else url_obj
                            parts.append(f"[image: {url}]")
                        else:
                            # Unknown dict part: stringify safely
                            parts.append(json.dumps(part))
                    else:
                        parts.append(str(part))
                normalized_text = "\n".join([p for p in parts if p])
                normalized.append(_HumanMessage(content=normalized_text))
            elif isinstance(content, dict):
                # Simple dict -> stringify keys/values
                try:
                    normalized.append(_HumanMessage(content=json.dumps(content)))
                except Exception:
                    normalized.append(_HumanMessage(content=str(content)))
            else:
                # Scalar -> string
                normalized.append(_HumanMessage(content=str(content)))
        except Exception as e:
            logging.warning(f"normalize_outgoing_messages: failed to normalize message {repr(m)}: {e}")
            try:
                normalized.append(_HumanMessage(content=str(m)))
            except Exception:
                # As a last resort, skip
                continue
    return normalized

def normalize_llm_response(response) -> dict:
    """
    Normalize an LLM response object into a predictable dictionary:
      { "content": str, "tool_calls": [ {"name":..., "args":..., "id":...}, ... ], "raw": response }

    This helps downstream code handle model / wrapper variations (some return lists, some objects).
    """
    normalized = {"content": "", "tool_calls": [], "raw": response}
    if response is None:
        return normalized

    # Extract content
    try:
        if hasattr(response, "content"):
            normalized["content"] = response.content if response.content is not None else ""
        else:
            # Some wrappers return string or other types directly
            normalized["content"] = str(response)
    except Exception as e:
        logging.warning(f"normalize_llm_response: error extracting content: {e}")
        normalized["content"] = str(response)

    # Extract tool_calls in a robust way
    try:
        tc = getattr(response, "tool_calls", None)
        if tc is None:
            # Some wrappers nest tool calls in metadata or other properties
            tc = getattr(response, "tools", None) or []
        parsed = []
        if isinstance(tc, (list, tuple)):
            for item in tc:
                # item might be a ToolCall object, dict, or string
                if hasattr(item, "name"):
                    name = getattr(item, "name", None)
                    args = getattr(item, "args", None) or getattr(item, "arguments", None) or {}
                    tid = getattr(item, "id", None)
                    parsed.append({"name": name, "args": args, "id": tid})
                elif isinstance(item, dict):
                    parsed.append({"name": item.get("name"), "args": item.get("args") or item.get("arguments") or {}, "id": item.get("id")})
                else:
                    # Fallback: try to coerce a string representation
                    try:
                        parsed.append({"name": str(item), "args": {}, "id": None})
                    except Exception:
                        continue
        normalized["tool_calls"] = parsed
    except Exception as e:
        logging.warning(f"normalize_llm_response: error extracting tool_calls: {e}")
        normalized["tool_calls"] = []

    return normalized

def get_active_language_name():
    """
    Returns the active LLM language name (e.g., 'English', 'Bahasa Indonesia').
    Fallbacks to 'English' if not set or error.
    """
    try:
        from modules.database import get_active_llm_languages
        active_languages = get_active_llm_languages()
        if active_languages and hasattr(active_languages[0], "language_name"):
            return active_languages[0].language_name
    except Exception as lang_e:
        print(f"Error fetching active languages: {lang_e}. Defaulting prompt language.")
    return "English"
