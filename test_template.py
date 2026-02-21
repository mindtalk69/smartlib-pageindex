import sys
from flask import Flask, render_template_string
from app import app
from extensions import db

with app.app_context():
    try:
        from modules.admin_providers import edit_provider
        # we can just try to render the template itself manually using dummy data
        from flask import render_template
        from modules.database import LLMProvider
        provider = LLMProvider.query.first()
        res = render_template('admin/providers/edit.html', provider=provider)
        print("Template rendered successfully.")
    except Exception as e:
        import traceback
        traceback.print_exc()
