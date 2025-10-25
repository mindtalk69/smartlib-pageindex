from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, current_app
from flask_login import login_required, current_user
from extensions import db
from modules.database import get_models, get_model_by_id, create_model, update_model, set_default_model, ModelConfig
import traceback
import logging
from modules.llm_utils import invalidate_llm

models_bp = Blueprint('admin_models', __name__, url_prefix='/admin/models')


@models_bp.before_request
@login_required
def _check_admin():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))


@models_bp.route('/', endpoint='model_management')
def model_management():
    try:
        models = get_models()
    except Exception as e:
        logging.error(f"Error loading model configs: {e}", exc_info=True)
        flash('Error loading model configurations.', 'danger')
        models = []
    return render_template('admin/models.html', models=models)


@models_bp.route('/data/<int:model_id>', methods=['GET'])
def get_model_data(model_id):
    try:
        model = get_model_by_id(model_id)
        if not model:
            return jsonify({"status": "error", "message": "Model not found."}), 404
        return jsonify({"status": "success", "model": model.to_dict()})
    except Exception as e:
        logging.error(f"Error fetching model data for {model_id}: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


@models_bp.route('/add', methods=['POST'])
def add_model():
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    deployment_name = data.get('deployment_name')
    provider = data.get('provider', 'azure_openai')
    temperature = data.get('temperature')
    streaming = bool(data.get('streaming', False))
    description = data.get('description')
    set_as_default = bool(data.get('is_default', False))

    if not name or not deployment_name:
        return jsonify({"status": "error", "message": "Name and deployment_name are required"}), 400

    try:
        created_by = getattr(current_user, 'user_id', None) or getattr(current_user, 'id', None)
        model_id = create_model(
            name=name,
            deployment_name=deployment_name,
            provider=provider,
            temperature=temperature,
            streaming=streaming,
            description=description,
            created_by=created_by,
            set_as_default=set_as_default
        )
        model = get_model_by_id(model_id)
        return jsonify({"status": "success", "message": "Model created", "model": model.to_dict()}), 201
    except Exception as e:
        logging.error(f"Error creating model: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to create model: {e}"}), 500


@models_bp.route('/edit/<int:model_id>', methods=['POST'])
def edit_model(model_id):
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    allowed = {}
    for key in ['name', 'deployment_name', 'provider', 'temperature', 'streaming', 'description', 'is_default']:
        if key in data:
            allowed_key = 'is_default' if key == 'is_default' else key
            allowed[allowed_key] = data[key]

    try:
        success = update_model(model_id, **allowed)
        if not success:
            return jsonify({"status": "error", "message": "Update failed (maybe not found or name duplicate)"}), 400
        updated = get_model_by_id(model_id)
        return jsonify({"status": "success", "message": "Model updated", "model": updated.to_dict()})
    except Exception as e:
        logging.error(f"Error updating model {model_id}: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to update model: {e}"}), 500


@models_bp.route('/delete/<int:model_id>', methods=['POST', 'DELETE'])
def delete_model_route(model_id):
    try:
        model = get_model_by_id(model_id)
        if not model:
            return jsonify({"status": "error", "message": "Model not found."}), 404
        db.session.delete(db.session.merge(model))
        db.session.commit()
        return jsonify({"status": "success", "message": "Model deleted."})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting model {model_id}: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to delete model: {e}"}), 500


@models_bp.route('/set-default/<int:model_id>', methods=['POST'])
def set_default_route(model_id):
    try:
        success = set_default_model(model_id)
        if not success:
            return jsonify({"status": "error", "message": "Could not set default (not found)."}), 404

        # Invalidate in-process LLM cache so the new default takes effect without a service restart
        try:
            invalidate_llm(None)  # clear all cached LLMs and reset global LLM state
            logging.info(f"Called invalidate_llm after setting default model {model_id}")
        except Exception as inv_e:
            # Log the invalidation error but still return success for the DB update
            logging.warning(f"Failed to invalidate LLM cache after setting default model {model_id}: {inv_e}", exc_info=True)

        return jsonify({"status": "success", "message": "Default model updated."})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error setting default model {model_id}: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to set default model: {e}"}), 500
