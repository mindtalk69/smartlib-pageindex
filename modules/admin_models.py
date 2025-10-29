from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, current_app
from flask_login import login_required, current_user
from extensions import db
from modules.database import (
    get_models,
    get_model_by_id,
    create_model,
    update_model,
    set_default_model,
    get_multimodal_model_id,
    set_multimodal_model,
    ModelConfig,
)
import traceback
import logging
from modules.llm_utils import (
    get_capabilities_for_deployment,
    get_llm,
    invalidate_llm,
    is_streaming_supported_for_deployment,
    validate_temperature_for_deployment,
)

models_bp = Blueprint('admin_models', __name__, url_prefix='/admin/models')


def _coerce_temperature(value):
    """Convert temperature payloads to floats or None."""
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return None
        value = stripped
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Temperature must be a numeric value.") from exc


def _validate_deployment_configuration(deployment_name: str, temperature: float | None, streaming: bool) -> tuple[bool, str | None]:
    """Ensure deployment settings are compatible and reachable."""
    if streaming and not is_streaming_supported_for_deployment(deployment_name):
        return False, (
            f"Deployment '{deployment_name}' does not support streaming responses. "
            "Disable streaming or choose a compatible deployment."
        )

    temp_ok, _, temp_error = validate_temperature_for_deployment(deployment_name, temperature)
    if not temp_ok:
        return False, temp_error

    try:
        get_llm(model_name=deployment_name, streaming=streaming, temperature=temperature)
    except Exception as exc:
        logging.warning(
            "Deployment validation failed for %s (streaming=%s, temperature=%s): %s",
            deployment_name,
            streaming,
            temperature,
            exc,
        )
        return False, f"Could not initialize deployment '{deployment_name}': {exc}"

    return True, None


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
    current_multimodal_id = get_multimodal_model_id()
    return render_template('admin/models.html', models=models, current_multimodal_id=current_multimodal_id)


@models_bp.route('/data/<int:model_id>', methods=['GET'])
def get_model_data(model_id):
    try:
        model = get_model_by_id(model_id)
        if not model:
            return jsonify({"status": "error", "message": "Model not found."}), 404
        model_payload = model.to_dict() if hasattr(model, 'to_dict') else None
        return jsonify({"status": "success", "model": model_payload})
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
    if isinstance(name, str):
        name = name.strip()
    if isinstance(deployment_name, str):
        deployment_name = deployment_name.strip()
    provider = data.get('provider', 'azure_openai')
    raw_temperature = data.get('temperature')
    streaming = bool(data.get('streaming', False))
    description = data.get('description')
    set_as_default = bool(data.get('is_default', False))

    if not name or not deployment_name:
        return jsonify({"status": "error", "message": "Name and deployment_name are required"}), 400

    try:
        temperature = _coerce_temperature(raw_temperature)
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400

    valid, validation_error = _validate_deployment_configuration(
        deployment_name,
        temperature,
        streaming,
    )
    if not valid:
        return jsonify({"status": "error", "message": validation_error}), 400

    try:
        created_by = getattr(current_user, 'user_id', None)
        if created_by is None:
            created_by = getattr(current_user, 'id', None)
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
        if not model or not hasattr(model, 'to_dict'):
            return jsonify({"status": "error", "message": "Model not found after creation."}), 404
        created_payload = model.to_dict()
        return jsonify({"status": "success", "message": "Model created", "model": created_payload}), 201
    except Exception as e:
        logging.error(f"Error creating model: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to create model: {e}"}), 500


@models_bp.route('/edit/<int:model_id>', methods=['POST'])
def edit_model(model_id):
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    current_model = get_model_by_id(model_id)
    if not current_model:
        return jsonify({"status": "error", "message": "Model not found."}), 404

    allowed: dict[str, object] = {}
    deployment_candidate = current_model.deployment_name
    streaming_candidate = bool(
        data['streaming']
    ) if 'streaming' in data else bool(getattr(current_model, 'streaming', False))
    existing_temperature = getattr(current_model, 'temperature', None)
    temperature_candidate = (
        float(existing_temperature) if existing_temperature is not None else None
    )

    if 'name' in data:
        new_name = data['name']
        if isinstance(new_name, str):
            new_name = new_name.strip()
        allowed['name'] = new_name

    if 'deployment_name' in data:
        new_deployment = data['deployment_name']
        if isinstance(new_deployment, str):
            new_deployment = new_deployment.strip()
        deployment_candidate = new_deployment
        allowed['deployment_name'] = deployment_candidate

    for key in ['provider', 'description']:
        if key in data:
            allowed[key] = data[key]

    if 'is_default' in data:
        allowed['is_default'] = bool(data['is_default'])

    if 'streaming' in data:
        allowed['streaming'] = streaming_candidate

    if 'temperature' in data:
        try:
            temperature_candidate = _coerce_temperature(data['temperature'])
        except ValueError as exc:
            return jsonify({"status": "error", "message": str(exc)}), 400
        allowed['temperature'] = temperature_candidate

    if not deployment_candidate:
        return jsonify({"status": "error", "message": "deployment_name cannot be empty."}), 400

    valid, validation_error = _validate_deployment_configuration(
        deployment_candidate,
        temperature_candidate,
        streaming_candidate,
    )
    if not valid:
        return jsonify({"status": "error", "message": validation_error}), 400

    try:
        success = update_model(model_id, **allowed)
        if not success:
            return jsonify({"status": "error", "message": "Update failed (maybe not found or name duplicate)"}), 400
        updated = get_model_by_id(model_id)
        if not updated or not hasattr(updated, 'to_dict'):
            return jsonify({"status": "error", "message": "Model not found after update."}), 404

        current_multimodal_id = get_multimodal_model_id()
        if current_multimodal_id == model_id and getattr(updated, 'deployment_name', None):
            current_app.config['AZURE_OPENAI_MULTIMODAL_DEPLOYMENT'] = updated.deployment_name

        updated_payload = updated.to_dict()
        return jsonify({"status": "success", "message": "Model updated", "model": updated_payload})
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
            invalidate_llm()  # clear all cached LLMs and reset global LLM state
            logging.info(f"Called invalidate_llm after setting default model {model_id}")
        except Exception as inv_e:
            # Log the invalidation error but still return success for the DB update
            logging.warning(f"Failed to invalidate LLM cache after setting default model {model_id}: {inv_e}", exc_info=True)

        return jsonify({"status": "success", "message": "Default model updated."})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error setting default model {model_id}: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to set default model: {e}"}), 500


@models_bp.route('/set-multimodal/<int:model_id>', methods=['POST'])
def set_multimodal_route(model_id):
    try:
        success = set_multimodal_model(model_id)
        if not success:
            return jsonify({"status": "error", "message": "Could not set multimodal model (not found)."}), 404

        model = get_model_by_id(model_id)
        if model and model.deployment_name:
            current_app.config['AZURE_OPENAI_MULTIMODAL_DEPLOYMENT'] = model.deployment_name

        return jsonify({"status": "success", "message": "Multimodal model updated."})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error setting multimodal model {model_id}: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to set multimodal model: {e}"}), 500
