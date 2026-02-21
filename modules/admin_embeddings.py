from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, current_app
from flask_login import login_required, current_user
from extensions import db
from modules.database import AppSettings
import logging
import os

embeddings_bp = Blueprint('admin_embeddings', __name__, url_prefix='/admin/embeddings')

logger = logging.getLogger(__name__)

# --- BASIC Edition: single local embedding model ---
# Qwen3-Embedding-0.6B is a compact, high-quality multilingual embedding model
# that runs entirely on CPU without requiring an Azure subscription.
EMBEDDING_MODELS = {
    "Qwen/Qwen3-Embedding-0.6B": {
        "name": "Qwen3-Embedding-0.6B",
        "description": (
            "Compact multilingual embedding model (~1.2GB) from Alibaba Cloud. "
            "Strong performance across 100+ languages on CPU. Recommended for "
            "SmartLib BASIC edition — no API key required."
        ),
        "size": "~1.2GB",
        "speed": "Moderate (CPU)",
        "type": "HuggingFace Local",
    },
}

# Default cache directory relative to the project data folder
_DEFAULT_CACHE_SUBDIR = "hf_cache"


def _get_cache_dir() -> str:
    """Return the absolute path where HuggingFace models are cached locally."""
    env_override = os.getenv("EMBEDDING_CACHE_DIR")
    if env_override:
        return env_override

    try:
        data_dir = current_app.config.get("DATA_VOLUME_PATH", "data")
    except RuntimeError:
        data_dir = os.getenv("DATA_VOLUME_PATH", "data")

    return os.path.abspath(os.path.join(data_dir, _DEFAULT_CACHE_SUBDIR))


def _model_is_cached(model_id: str) -> bool:
    """Return True if the model snapshot directory already exists in the local cache."""
    cache_dir = _get_cache_dir()
    # HuggingFace stores models as models--<org>--<name>/snapshots/...
    hf_dir_name = "models--" + model_id.replace("/", "--")
    snapshot_dir = os.path.join(cache_dir, hf_dir_name, "snapshots")
    return os.path.isdir(snapshot_dir) and bool(os.listdir(snapshot_dir))


@embeddings_bp.before_request
@login_required
def _check_admin():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))


@embeddings_bp.route('/', methods=['GET'])
def embedding_models():
    """Display embedding model selection page."""
    try:
        current_model = get_current_embedding_model()
        cache_dir = _get_cache_dir()
        cache_status = {
            model_id: _model_is_cached(model_id)
            for model_id in EMBEDDING_MODELS
        }
        return render_template(
            'admin/embeddings.html',
            models=EMBEDDING_MODELS,
            current_model=current_model,
            cache_dir=cache_dir,
            cache_status=cache_status,
        )
    except Exception as e:
        logger.error(f"Error loading embedding models page: {e}", exc_info=True)
        flash("Error loading embedding models.", "danger")
        return redirect(url_for('admin.dashboard'))


@embeddings_bp.route('/csrf-token', methods=['GET'])
def get_csrf_token():
    """Get CSRF token for AJAX requests."""
    from flask_wtf.csrf import generate_csrf
    return {'csrf_token': generate_csrf()}


@embeddings_bp.route('/cache-status', methods=['GET'])
def cache_status_route():
    """Return JSON cache status for all models."""
    cache_dir = _get_cache_dir()
    return jsonify({
        "cache_dir": cache_dir,
        "models": {
            model_id: {
                "cached": _model_is_cached(model_id),
                "name": info["name"],
            }
            for model_id, info in EMBEDDING_MODELS.items()
        }
    })


@embeddings_bp.route('/download', methods=['POST'])
def download_model():
    """Download and cache a model to the local HuggingFace cache directory."""
    data = request.get_json(silent=True) or {}
    model_id = data.get("model_name")

    if not model_id or model_id not in EMBEDDING_MODELS:
        return jsonify({"status": "error", "message": "Invalid model name"}), 400

    try:
        from huggingface_hub import snapshot_download
        cache_dir = _get_cache_dir()
        os.makedirs(cache_dir, exist_ok=True)
        logger.info("Downloading model %s to cache dir %s ...", model_id, cache_dir)
        snapshot_download(repo_id=model_id, cache_dir=cache_dir)
        logger.info("Model %s cached successfully.", model_id)
        return jsonify({
            "status": "success",
            "message": f"Model '{EMBEDDING_MODELS[model_id]['name']}' downloaded and cached.",
            "cached": True,
        })
    except Exception as e:
        logger.error("Failed to download model %s: %s", model_id, e, exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


@embeddings_bp.route('/set-default', methods=['POST'])
def set_default_embedding():
    """Set the default embedding model via AJAX."""
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400

    data = request.get_json()
    model_name = data.get('model_name')

    if not model_name:
        return jsonify({"status": "error", "message": "Model name is required"}), 400

    if model_name not in EMBEDDING_MODELS:
        return jsonify({"status": "error", "message": "Invalid model name"}), 400

    try:
        set_embedding_model(model_name)
        invalidate_embedding_cache()
        logger.info(f"Default embedding model changed to: {model_name}")
        return jsonify({
            "status": "success",
            "message": f"Default embedding model set to {model_name}",
            "model": EMBEDDING_MODELS[model_name]
        })
    except Exception as e:
        logger.error(f"Error setting default embedding model: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to set default embedding model",
            "error": str(e)
        }), 500


def get_current_embedding_model():
    """Get the current default embedding model with environment-aware fallbacks."""
    try:
        setting = db.session.get(AppSettings, 'default_embedding_model')
        if setting and setting.value:
            return setting.value

        config_default = current_app.config.get('DEFAULT_EMBEDDING_MODEL')
        if config_default:
            return config_default

    except RuntimeError as exc:
        logger.warning(
            "Flask application context not available when reading embedding model: %s", exc,
        )
    except Exception as exc:
        logger.warning("Could not get current embedding model from DB: %s", exc)

    env_default = os.getenv('DEFAULT_EMBEDDING_MODEL')
    if env_default:
        return env_default

    # BASIC edition default
    return "Qwen/Qwen3-Embedding-0.6B"


def set_embedding_model(model_name):
    """Set the default embedding model in AppSettings."""
    try:
        setting = db.session.get(AppSettings, 'default_embedding_model')
        if setting:
            setting.value = model_name
        else:
            setting = AppSettings(key='default_embedding_model', value=model_name)
            db.session.add(setting)
        db.session.commit()
        logger.info(f"Saved default embedding model: {model_name}")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to save embedding model {model_name}: {e}")
        raise


def invalidate_embedding_cache():
    """Clear the embedding function cache in llm_utils."""
    try:
        from modules.llm_utils import invalidate_embedding
        invalidate_embedding()
        logger.info("Embedding function cache invalidated")
    except Exception as e:
        logger.warning(f"Could not invalidate embedding cache: {e}")
