# create_default_models.py
# Creates default models based on ARM template parameters during deployment.
# Idempotent and safe for container startup.

import os
import sys
from flask import Flask
from extensions import db
from modules.database import (
    ModelConfig,
    create_model,
    get_default_model,
    get_multimodal_model_id,
    set_multimodal_model,
)
from app import create_app


def _ensure_multimodal_assignment(default_model_id: int | None) -> None:
    """Ensure a multimodal model is configured when only one model exists."""
    current_multimodal_id = get_multimodal_model_id()
    if current_multimodal_id:
        print(f"Multimodal model already configured (ID: {current_multimodal_id}).")
        return

    candidate_id = default_model_id
    if candidate_id is None:
        models = ModelConfig.query.order_by(ModelConfig.id).all()
        if len(models) == 1:
            candidate_id = models[0].id
        else:
            print("Skipping multimodal assignment; multiple models detected and no default ID available.")
            return

    try:
        success = set_multimodal_model(candidate_id)
    except Exception as exc:  # pragma: no cover - defensive logging for deployment
        print(f"Error assigning multimodal model: {exc}", file=sys.stderr)
        return

    if success:
        print(f"Configured multimodal model to ID {candidate_id}.")
    else:
        print(f"Failed to assign multimodal model to ID {candidate_id}.", file=sys.stderr)


def create_or_update_default_model():
    default_deployment_name = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1-mini")

    flask_app = create_app()
    with flask_app.app_context():
        # Check if there's already a default model
        existing_default = get_default_model()
        if existing_default:
            print(f"Default model already exists: {existing_default['name']}")
            default_model_id = existing_default.get("id")
            _ensure_multimodal_assignment(default_model_id)
            return

        # Create a new default model
        try:
            model_id = create_model(
                name=default_deployment_name,
                deployment_name=default_deployment_name,
                provider='azure_openai',
                description="Default model deployed during setup",
                set_as_default=True
            )
            print(f"Created default model '{default_deployment_name}' with ID: {model_id}")
            _ensure_multimodal_assignment(model_id)
        except Exception as e:
            print(f"Error creating default model: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    create_or_update_default_model()
