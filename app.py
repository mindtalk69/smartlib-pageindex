# Ensure multiprocessing start method and graceful shutdown are configured BEFORE importing heavy libs
import multiprocessing
import signal
import atexit
import warnings
import logging

# Set a safer multiprocessing start method early to avoid leaked semaphores with libraries like torch
try:
    multiprocessing.set_start_method("spawn")
except RuntimeError:
    # start method already set by another module; ignore
    pass

# Optionally silence the specific resource_tracker warning if it persists (keeps visible other warnings)
warnings.filterwarnings(
    "default",
    message=r"resource_tracker: There appear to be .* leaked semaphore objects to clean up at shutdown",
    category=UserWarning
)

# Setup basic logging early
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Small registry so we can register pools/managers created at runtime and ensure they're shut down
_child_pools = []
_child_managers = []

def register_pool(p):
    """Register a pool-like object (multiprocessing.Pool or concurrent.futures.ProcessPoolExecutor)."""
    _child_pools.append(p)

def register_manager(m):
    """Register a multiprocessing.Manager-like object."""
    _child_managers.append(m)

def _shutdown_children():
    """Attempt to gracefully shutdown known pools and managers."""
    logging.info("Shutting down child pools/managers...")
    # Pools / executors
    for p in list(_child_pools):
        try:
            # concurrent.futures.Executor
            if hasattr(p, "shutdown"):
                try:
                    p.shutdown(wait=True)
                except TypeError:
                    # Some objects expect different args; try without args
                    p.shutdown()
            # multiprocessing.Pool
            if hasattr(p, "close"):
                try:
                    p.close()
                except Exception:
                    pass
            if hasattr(p, "terminate"):
                try:
                    p.terminate()
                except Exception:
                    pass
            if hasattr(p, "join"):
                try:
                    p.join(timeout=2)
                except Exception:
                    pass
        except Exception as e:
            logging.warning(f"Error shutting pool/executor: {e}")
    # Managers
    for m in list(_child_managers):
        try:
            if hasattr(m, "shutdown"):
                m.shutdown()
        except Exception as e:
            logging.warning(f"Error shutting manager: {e}")

def _handle_sigint(signum, frame):
    """Signal handler for SIGINT (Ctrl-C) to shutdown children first, then raise KeyboardInterrupt."""
    try:
        _shutdown_children()
    except Exception as e:
        logging.warning(f"Error during shutdown children: {e}")
    # restore default handler and re-raise KeyboardInterrupt so Flask stops as usual
    signal.signal(signal.SIGINT, signal.default_int_handler)
    raise KeyboardInterrupt

def cleanup_orphaned_processes():
    """Clean up any orphaned multiprocessing processes that may have gotten stuck."""
    try:
        import psutil
        import os

        current_pid = os.getpid()
        current_process = psutil.Process(current_pid)

        # Find child processes that might be stuck
        children_to_kill = []
        for child in current_process.children(recursive=True):
            if 'python' in child.name().lower():
                # Check if it's a multiprocessing spawn or resource tracker process
                cmdline = child.cmdline()
                if any(keyword in ' '.join(cmdline) for keyword in ['multiprocessing', 'spawn_main', 'resource_tracker']):
                    children_to_kill.append(child)

        # Kill orphaned processes
        for child in children_to_kill:
            try:
                logging.info(f"Cleaning up orphaned process: {child.pid} - {' '.join(child.cmdline()[:3])}")
                child.terminate()
                # Wait up to 2 seconds for graceful termination
                child.wait(timeout=2)
            except psutil.TimeoutExpired:
                # Force kill if it doesn't terminate gracefully
                child.kill()
                logging.warning(f"Force killed orphaned process: {child.pid}")

    except ImportError:
        # psutil not available, use basic approach
        logging.info("psutil not available for advanced cleanup")
    except Exception as e:
        logging.warning(f"Error during orphaned process cleanup: {e}")

def _handle_sigterm(signum, frame):
    """Signal handler for SIGTERM to shutdown children then exit."""
    try:
        cleanup_orphaned_processes()  # Clean orphaned processes first
        _shutdown_children()
    except Exception as e:
        logging.warning(f"Error during shutdown children: {e}")
    raise SystemExit

# Register handlers
signal.signal(signal.SIGINT, _handle_sigint)
signal.signal(signal.SIGTERM, _handle_sigterm)
atexit.register(cleanup_orphaned_processes)  # Clean orphaned processes on exit
atexit.register(_shutdown_children)

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
from modules.upload import init_upload
from modules.logout import init_logout
from modules.login_azure import init_login_azure
from modules.admin import init_admin, admin_bp
from modules.view_document import init_view_document
# Remove celery imports, context is handled in celery_app.ContextTask
import modules.query
import logging

from flask import Flask, render_template, flash, redirect, url_for, jsonify
from flask_wtf.csrf import CSRFError, CSRFProtect, generate_csrf

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
    login_manager.login_view = 'login_route'

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
        """Inject current_user and current_year into template context."""
        from datetime import datetime
        return dict(
            current_user=current_user,
            current_year=datetime.now().year
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
    init_upload(app)
    init_logout(app)
    init_login_azure(app)
    init_admin(app)
    init_view_document(app)
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

    if app.config.get('EMBEDDING_WARMUP_ENABLED', False):
        try:
            from modules.llm_utils import warmup_embedding_model
            with app.app_context():
                warmup_embedding_model(sample_text=app.config.get('EMBEDDING_WARMUP_TEXT'))
        except Exception as warmup_exc:
            app.logger.warning("Embedding warmup encountered an issue: %s", warmup_exc, exc_info=True)

    return app

# --- Application Instance Creation and Wrapping ---
# Create the Flask app instance using the factory. This is the raw WSGI app.
app = create_app()


if __name__ == '__main__':
    # This block now runs the ASGI app with uvicorn programmatically,
    # which is great for development (e.g., `python app.py`).
    # For production, you would run: `uvicorn app:app --host 0.0.0.0 --port 8000`
    #import uvicorn
    host = app.config.get('HOST', '127.0.0.1')
    port = int(app.config.get('PORT', 5000))
    debug = app.config.get('DEBUG', False)

    app.run(
        host=host,
        port=port,
        debug=debug
    )
