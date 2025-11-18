# Note: load_dotenv is now handled within config.py
import os
from flask import Flask, session
from flask_wtf.csrf import CSRFProtect
from flask_login import LoginManager, current_user
from flask_migrate import Migrate # Import Migrate

# Import configuration loader
from config import get_config

# Import database models and functions needed for user loading
from modules.database import User, get_user_by_id, AppSettings, ModelConfig # Added AppSettings

# Import extensions (assuming they are defined without app initialization)
from extensions import db, login_manager, csrf # Assuming csrf is also in extensions

# Import route initializers
from modules.index import init_index
from modules.login import init_login
from modules.register import init_register
from modules.change_password import init_change_password
from modules.password_reset_requests import init_password_reset_requests
from modules.upload import init_upload

from modules.logout import init_logout
from modules.login_azure import init_login_azure
from modules.admin import init_admin, admin_bp
from modules.view_document import init_view_document
from modules.about import init_about
# Remove celery imports, context is handled in celery_app.ContextTask
import modules.query
import logging

from flask import Flask, render_template, flash, redirect, url_for, jsonify
from flask_wtf.csrf import CSRFError, CSRFProtect, generate_csrf

# Import for WSGI-to-ASGI bridge (not needed for Gunicorn/WSGI)
# from a2wsgi import WSGIMiddleware

# --- ADD THIS ---
# Configure root logger early
#logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', force=True) # <<< ADD force=True
# --- END ADD ---



def create_app():
    """Application Factory Function"""
    app = Flask(__name__)

    # Load configuration from config.py based on FLASK_ENV/FLASK_CONFIG
    config_obj = get_config()
    app.config.from_object(config_obj)
    #app.logger.setLevel(logging.DEBUG)
    app.logger.info(f"DEBUG [app.py]: Value in app.config['VECTOR_STORE_PROVIDER'] = {app.config.get('VECTOR_STORE_PROVIDER')}") # Check app.config

    # Log the configured database URI after loading config
    app.logger.info(f"SQLALCHEMY_DATABASE_URI loaded into app.config: {app.config.get('SQLALCHEMY_DATABASE_URI')}") # Keep logger too

    # Celery initialization is removed, context handled by ContextTask in celery_app.py

    # Initialize extensions with the app instance
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app) # Initialize CSRF protection
    migrate = Migrate(app, db) # Initialize Flask-Migrate

    # Load AppSettings from DB into app.config
    with app.app_context():
        try:
            settings_query = AppSettings.query.filter(AppSettings.key.in_([
                'visual_grounding_enabled',
                'visual_grounding_doc_store_path',
                'vector_store_mode',
                'VECTOR_STORE_MODE',
                'multimodal_model_id'
            ])).all()
            settings = {s.key: s.value for s in settings_query}

            # Set config values, using defaults if not found in DB
            app.config['VISUAL_GROUNDING_ENABLED'] = settings.get('visual_grounding_enabled', 'false').lower() == 'true'
            app.config['VISUAL_GROUNDING_DOC_STORE_PATH'] = settings.get('visual_grounding_doc_store_path', 'data/doc_store')
            app.config['VECTOR_STORE_MODE'] = settings.get('vector_store_mode', 'user') or settings.get('VECTOR_STORE_MODE', 'user')

            multimodal_model_id = settings.get('multimodal_model_id')
            if multimodal_model_id:
                try:
                    model_obj = db.session.get(ModelConfig, int(multimodal_model_id))
                    if model_obj and model_obj.deployment_name:
                        app.config['AZURE_OPENAI_MULTIMODAL_DEPLOYMENT'] = model_obj.deployment_name
                except (ValueError, TypeError):
                    app.logger.warning("AppSettings.multimodal_model_id is not a valid integer.")
                except Exception as mm_exc:
                    app.logger.warning(f"Error loading multimodal model setting: {mm_exc}")

            app.logger.info("Loaded AppSettings into app.config.")
            app.logger.info(f"VISUAL_GROUNDING_ENABLED: {app.config['VISUAL_GROUNDING_ENABLED']}")
            app.logger.info(f"VISUAL_GROUNDING_DOC_STORE_PATH: {app.config['VISUAL_GROUNDING_DOC_STORE_PATH']}")
            app.logger.info(f"VECTOR_STORE_MODE: {app.config['VECTOR_STORE_MODE']}")
            app.logger.info(f"AZURE_OPENAI_MULTIMODAL_DEPLOYMENT: {app.config.get('AZURE_OPENAI_MULTIMODAL_DEPLOYMENT')}")

            # Log Docling Export Type
            docling_export_type = app.config.get('DOCLING_EXPORT_TYPE', 'MARKDOWN').upper() # Default to MARKDOWN
            app.logger.info(f"Docling Export Mode configured: {docling_export_type}")

        except Exception as e:
            app.logger.error(f"Error loading AppSettings from database: {e}. Using default values.")
            # Apply defaults explicitly in case of error
            app.config.setdefault('VISUAL_GROUNDING_ENABLED', False)
            app.config.setdefault('VISUAL_GROUNDING_DOC_STORE_PATH', 'data/doc_store')
            app.config.setdefault('VECTOR_STORE_MODE', 'user')

    # Configure Login Manager
        setattr(login_manager, 'login_view', 'login_route')
  # pyright: ignore[reportGeneralTypeIssues]

    @login_manager.user_loader
    def load_user(user_id):
        """Load user using SQLAlchemy User model."""
        user = get_user_by_id(user_id)
        if user:
            if user.auth_provider == "local":
                session_user = session.get("user")
                if session_user and session_user.get("username"):
                    user.username = session_user.get("username")
            return user
        return None

    @app.context_processor
    def inject_current_user_context():
        """Inject current_user, current_year, logo_url, and optional routes into templates."""
        from datetime import datetime
        from werkzeug.routing import BuildError

        try:
            about_url = url_for("about.about")
        except BuildError:
            about_url = None

        static_folder = app.static_folder or os.path.join(app.root_path, "static")
        custom_logo_path = os.path.join(static_folder, "img", "custom_logo.png")
        if os.path.exists(custom_logo_path):
            logo_url = url_for("static", filename="img/custom_logo.png")
            try:
                mtime = int(os.path.getmtime(custom_logo_path))
                logo_url += f"?v={mtime}"
            except Exception:
                pass
        else:
            logo_url = url_for("static", filename="img/logo.png")

        return dict(
            current_user=current_user,
            current_year=datetime.now().year,
            about_url=about_url,
            logo_url=logo_url,
        )
        
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        # Log the error if you want
        app.logger.warning(f"CSRF Error occurred: {e.description}")
        # Flash a message to the user
        flash('Your session expired due to inactivity. Please try submitting the form again.', 'warning')
        # Redirect back to the page they were likely on (e.g., login)
        # You might need more sophisticated logic to redirect correctly in all cases
        # For login, redirecting back to login is usually safe.
        return redirect(url_for('auth.login')) # Adjust 'auth.login' to your actual login route name

    @app.route('/api/csrf-token', methods=['GET']) # Or @bp.route(...)
    def get_csrf_token_route():
        token = generate_csrf()
        return jsonify({'csrf_token': token})

    # Initialize routes from individual modules
    init_index(app)
    init_login(app)
    init_register(app)
    init_change_password(app)
    init_password_reset_requests(app)
    init_upload(app)
    init_logout(app)
    init_login_azure(app)
    init_admin(app)
    init_view_document(app)
    init_about(app)
    modules.query.init_query(app)

    # Register feedback API blueprint
    from modules.feedback import feedback_bp
    app.register_blueprint(feedback_bp)
    csrf.exempt(feedback_bp)

    # Register admin feedback blueprint
    from modules.admin_feedback import admin_feedback_bp
    app.register_blueprint(admin_feedback_bp)

    # Register admin folder upload blueprint
    from modules.admin_folder_upload import admin_folder_upload_bp
    app.register_blueprint(admin_folder_upload_bp)

    # Register selfquery API blueprint
    from modules.selfquery import selfquery_bp
    app.register_blueprint(selfquery_bp)

    return app

# Call create_app() at the module level to create the Flask app instance
# that Uvicorn can find.
app = create_app()


if __name__ == '__main__':
    # This block is for running with Flask's built-in development server.
    # Uvicorn will use the 'app' instance defined above.
    host = app.config.get('HOST', '127.0.0.1')
    port = app.config.get('PORT', 5000)
    debug = app.config.get('DEBUG', False)
    app.run(host=host, port=port, debug=debug)
