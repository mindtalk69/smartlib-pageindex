# create_default_models.py
# Creates default models based on ARM template parameters during deployment.
# Idempotent and safe for container startup.

import os
import sys
from flask import Flask
from extensions import db
from modules.database import create_model, get_default_model
from app import create_app

def create_or_update_default_model():
    default_deployment_name = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1-mini")

    flask_app = create_app()
    with flask_app.app_context():
        # Check if there's already a default model
        existing_default = get_default_model()
        if existing_default:
            print(f"Default model already exists: {existing_default['name']}")
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
        except Exception as e:
            print(f"Error creating default model: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    create_or_update_default_model()
