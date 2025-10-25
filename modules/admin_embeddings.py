from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from extensions import db
from modules.database import AppSettings
import logging

embeddings_bp = Blueprint('admin_embeddings', __name__, url_prefix='/admin/embeddings')

logger = logging.getLogger(__name__)

# Predefined embedding models with descriptions
EMBEDDING_MODELS = {
    "BAAI/bge-m3": {
        "name": "BAAI/bge-m3",
        "description": "Best multilingual embeddings, supports 100+ languages. Larger model (1.5GB) but highest quality for diverse content. Best for international users and mixed languages.",
        "size": "~1.5GB",
        "speed": "Slower",
        "type": "HuggingFace Local"
    },
    "all-MiniLM-L6-v2": {
        "name": "all-MiniLM-L6-v2",
        "description": "Fast English-focused embeddings, smaller and quicker (~90MB). Good performance on English text but limited multilingual support. Best for English-only sites that need speed.",
        "size": "~90MB",
        "speed": "Fast",
        "type": "HuggingFace Local"
    },
    "text-embedding-3-small": {
        "name": "text-embedding-3-small",
        "description": "Latest OpenAI model, very high quality embeddings. Requires internet and API key. Best performance but needs OpenAI account and has usage costs.",
        "size": "API-based",
        "speed": "Fastest",
        "type": "Azure OpenAI"
    }
}

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
        # Get current default embedding model
        current_model = get_current_embedding_model()

        return render_template(
            'admin/embeddings.html',
            models=EMBEDDING_MODELS,
            current_model=current_model
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
        # Save to AppSettings
        set_embedding_model(model_name)

        # Clear embedding function cache so new model takes effect
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
    """Get the current default embedding model from AppSettings."""
    try:
        setting = db.session.get(AppSettings, 'default_embedding_model')
        if setting and setting.value:
            return setting.value
    except Exception as e:
        logger.warning(f"Could not get current embedding model from DB: {e}")

    # Return default
    return "BAAI/bge-m3"

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
