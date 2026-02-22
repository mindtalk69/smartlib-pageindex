# Ensure multiprocessing start method and graceful shutdown are configured BEFORE importing heavy libs
import multiprocessing
import signal
import atexit
import warnings
import logging
from logging.handlers import RotatingFileHandler
import json
from types import SimpleNamespace
from typing import Any, Dict

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
    category=UserWarning,
)

# Setup basic logging early
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

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
            if "python" in child.name().lower():
                # Check if it's a multiprocessing spawn or resource tracker process
                cmdline = child.cmdline()
                if any(
                    keyword in " ".join(cmdline)
                    for keyword in ["multiprocessing", "spawn_main", "resource_tracker"]
                ):
                    children_to_kill.append(child)

        # Kill orphaned processes
        for child in children_to_kill:
            try:
                logging.info(
                    f"Cleaning up orphaned process: {child.pid} - {' '.join(child.cmdline()[:3])}"
                )
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


# Register handlers only in main thread (Celery worker threads can't register signal handlers)
import threading

if threading.current_thread() is threading.main_thread():
    signal.signal(signal.SIGINT, _handle_sigint)
    signal.signal(signal.SIGTERM, _handle_sigterm)
    atexit.register(cleanup_orphaned_processes)  # Clean orphaned processes on exit
    atexit.register(_shutdown_children)

# Note: load_dotenv is now handled within config.py
import os
from flask import Flask, session, has_request_context
from flask_wtf.csrf import CSRFProtect
from flask_login import LoginManager, current_user
from flask_migrate import Migrate  # Import Migrate

# Import configuration loader
from config import get_config

# Import database models and functions needed for user loading
from modules.database import (
    AppSettings,
    ModelConfig,
    User,
    count_password_reset_requests,
    get_user_by_id,
    PASSWORD_RESET_STATUS_PENDING,
)  # Added AppSettings

# Import extensions (assuming they are defined without app initialization)
from extensions import db, login_manager, csrf  # Assuming csrf is also in extensions

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
from modules.api_auth import init_api_auth

# Remove celery imports, context is handled in celery_app.ContextTask
import modules.query
import logging

from flask import Flask, render_template, flash, redirect, url_for, jsonify
from flask_wtf.csrf import CSRFError, CSRFProtect, generate_csrf

# --- ADD THIS ---
# Configure root logger early
# logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', force=True) # <<< ADD force=True
# --- END ADD ---


def create_app():
    """Application Factory Function"""
    app = Flask(__name__)

    # Load configuration from config.py based on FLASK_ENV/FLASK_CONFIG
    config_obj = get_config()
    app.config.from_object(config_obj)
    app.config.setdefault("VITE_DEV_SERVER_URL", os.getenv("VITE_DEV_SERVER_URL"))

    log_level_name = app.config.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    logging.getLogger().setLevel(log_level)
    app.logger.setLevel(log_level)

    log_dir = app.config.get("LOG_DIR") or os.path.join(
        app.config["DATA_VOLUME_PATH"], "logs"
    )
    log_file = app.config.get("APPLICATION_LOG_FILE") or os.path.join(
        log_dir, "smartlib.log"
    )
    try:
        os.makedirs(log_dir, exist_ok=True)
        should_add_handler = True
        for handler in logging.getLogger().handlers:
            if (
                isinstance(handler, RotatingFileHandler)
                and getattr(handler, "baseFilename", None) == log_file
            ):
                should_add_handler = False
                break
        if should_add_handler:
            file_handler = RotatingFileHandler(
                log_file, maxBytes=5 * 1024 * 1024, backupCount=5
            )
            file_handler.setLevel(log_level)
            file_handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                )
            )
            logging.getLogger().addHandler(file_handler)
            app.logger.info("File logging enabled at %s", log_file)
    except OSError as exc:
        app.logger.warning("Unable to configure file logging at %s: %s", log_file, exc)

    asset_manifest_cache: Dict[str, Any] = {"data": None}

    def get_asset_manifest():
        if asset_manifest_cache["data"] is not None:
            return asset_manifest_cache["data"]
        manifest_candidates = [
            os.path.join(
                app.root_path,
                "static",
                "dist",
                ".vite",
                "manifest.json",
            ),
            os.path.join(
                app.root_path,
                "static",
                "dist",
                "manifest.json",
            ),
        ]
        manifest_path = None
        for candidate in manifest_candidates:
            if os.path.exists(candidate):
                manifest_path = candidate
                break
        if manifest_path is None:
            app.logger.warning(
                "Asset manifest not found. Run `npm run build` to generate frontend assets.",
            )
            asset_manifest_cache["data"] = {}
            return asset_manifest_cache["data"]
        try:
            with open(manifest_path, "r", encoding="utf-8") as manifest_file:
                asset_manifest_cache["data"] = json.load(manifest_file)
        except json.JSONDecodeError as exc:
            app.logger.warning(
                "Unable to parse asset manifest %s: %s",
                manifest_path,
                exc,
            )
            asset_manifest_cache["data"] = {}
        return asset_manifest_cache["data"]

    def asset_bundle(name):
        dev_server = app.config.get("VITE_DEV_SERVER_URL")
        if dev_server:
            base = dev_server.rstrip("/")
            return SimpleNamespace(
                scripts=[f"{base}/@vite/client", f"{base}/{name}.js"],
                styles=[],
            )
        manifest = get_asset_manifest()
        entry = (
            manifest.get(name)
            or manifest.get(f"{name}.js")
            or manifest.get(f"static/src/{name}.js")
        )
        if not entry:
            for candidate in manifest.values():
                if candidate.get("name") == name:
                    entry = candidate
                    break
        if not entry:
            app.logger.warning("Asset '%s' not found in manifest.", name)
            return SimpleNamespace(scripts=[], styles=[])

        def build_bundle():
            scripts: list[str] = []
            styles: list[str] = []

            def add_entry(manifest_entry):
                if not manifest_entry:
                    return
                file_name = manifest_entry.get("file")
                if file_name:
                    url = url_for("static", filename=f"dist/{file_name}")
                    if file_name.endswith(".css"):
                        if url not in styles:
                            styles.append(url)
                    else:
                        if url not in scripts:
                            scripts.append(url)
                for css_path in manifest_entry.get("css", []):
                    css_url = url_for("static", filename=f"dist/{css_path}")
                    if css_url not in styles:
                        styles.append(css_url)
                for import_name in manifest_entry.get("imports", []):
                    add_entry(manifest.get(import_name))

            add_entry(entry)
            return SimpleNamespace(scripts=scripts, styles=styles)

        try:
            if has_request_context():
                return build_bundle()
            with app.test_request_context():
                return build_bundle()
        except RuntimeError as exc:
            app.logger.warning(
                "Unable to build asset bundle '%s': %s",
                name,
                exc,
            )
            return SimpleNamespace(scripts=[], styles=[])

    app.jinja_env.globals["asset_bundle"] = asset_bundle
    app.add_template_global(asset_bundle, name="asset_bundle")

    app.logger.info(
        f"DEBUG [app.py]: Value in app.config['VECTOR_STORE_PROVIDER'] = {app.config.get('VECTOR_STORE_PROVIDER')}"
    )  # Check app.config

    # Log the configured database URI after loading config
    app.logger.info(
        f"SQLALCHEMY_DATABASE_URI loaded into app.config: {app.config.get('SQLALCHEMY_DATABASE_URI')}"
    )  # Keep logger too

    # Celery initialization is removed, context handled by ContextTask in celery_app.py

    # Initialize extensions with the app instance
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)  # Initialize CSRF protection
    migrate = Migrate(app, db)  # Initialize Flask-Migrate

    # Load AppSettings from DB into app.config
    with app.app_context():
        try:
            settings_query = AppSettings.query.filter(
                AppSettings.key.in_(
                    [
                        "visual_grounding_enabled",
                        "visual_grounding_doc_store_path",
                        "vector_store_mode",
                        "multimodal_model_id",
                        "is_enabled_ocr",
                        "is_auto_ocr",
                        "ocr_mode",
                        "doc_intelligence_endpoint",
                    ]
                )
            ).all()
            settings = {s.key: s.value for s in settings_query}
            settings_map = {s.key: s for s in settings_query}
            settings_updates = {}

            def _truthy(value):
                if value is None:
                    return False
                if isinstance(value, bool):
                    return value
                return str(value).strip().lower() in ("1", "true", "yes", "on")

            # Set config values, using defaults if not found in DB
            app.config["VISUAL_GROUNDING_ENABLED"] = (
                settings.get("visual_grounding_enabled", "false").lower() == "true"
            )
            app.config["VISUAL_GROUNDING_DOC_STORE_PATH"] = settings.get(
                "visual_grounding_doc_store_path",
                "data/doc_store",
            )
            app.config["VECTOR_STORE_MODE"] = settings.get(
                "vector_store_mode", "user"
            ) or settings.get("VECTOR_STORE_MODE", "user")

            env_is_enabled_ocr_raw = os.environ.get("IS_ENABLED_OCR")
            if env_is_enabled_ocr_raw is not None:
                env_is_enabled_ocr = _truthy(env_is_enabled_ocr_raw)
                app.config["IS_ENABLED_OCR"] = env_is_enabled_ocr
                desired_value = "1" if env_is_enabled_ocr else "0"
                if settings.get("is_enabled_ocr") != desired_value:
                    settings_updates["is_enabled_ocr"] = desired_value
            else:
                app.config["IS_ENABLED_OCR"] = (
                    settings.get("is_enabled_ocr", "0") == "1"
                )

            env_is_auto_ocr_raw = os.environ.get("IS_AUTO_OCR")
            if env_is_auto_ocr_raw is not None:
                env_is_auto_ocr = _truthy(env_is_auto_ocr_raw)
                app.config["IS_AUTO_OCR"] = env_is_auto_ocr
                desired_value = "1" if env_is_auto_ocr else "0"
                if settings.get("is_auto_ocr") != desired_value:
                    settings_updates["is_auto_ocr"] = desired_value
            else:
                app.config["IS_AUTO_OCR"] = settings.get("is_auto_ocr", "0") == "1"

            env_ocr_mode_raw = os.environ.get("OCR_MODE")
            if env_ocr_mode_raw is not None and env_ocr_mode_raw.strip():
                env_ocr_mode = env_ocr_mode_raw.strip()
                app.config["OCR_MODE"] = env_ocr_mode
                if settings.get("ocr_mode") != env_ocr_mode:
                    settings_updates["ocr_mode"] = env_ocr_mode
            else:
                default_ocr_mode = os.environ.get("OCR_MODE", "default")
                app.config["OCR_MODE"] = settings.get("ocr_mode", default_ocr_mode)

            env_doc_endpoint_raw = os.environ.get("DOC_INTELLIGENCE_ENDPOINT")
            if env_doc_endpoint_raw:
                env_doc_endpoint = env_doc_endpoint_raw.strip()
                app.config["DOC_INTELLIGENCE_ENDPOINT"] = env_doc_endpoint
                if settings.get("doc_intelligence_endpoint") != env_doc_endpoint:
                    settings_updates["doc_intelligence_endpoint"] = env_doc_endpoint
            else:
                app.config["DOC_INTELLIGENCE_ENDPOINT"] = settings.get(
                    "doc_intelligence_endpoint",
                    "",
                )

            if settings_updates:
                try:
                    for key, value in settings_updates.items():
                        setting_obj = settings_map.get(key)
                        if setting_obj:
                            setting_obj.value = value
                        else:
                            db.session.add(AppSettings(key=key, value=value))
                    db.session.commit()
                    settings.update(settings_updates)
                    app.logger.info(
                        "Synchronized AppSettings with environment overrides: %s",
                        ", ".join(settings_updates.keys()),
                    )
                except Exception as sync_exc:
                    db.session.rollback()
                    app.logger.warning(
                        "Failed to persist environment overrides to AppSettings: %s",
                        sync_exc,
                    )

            multimodal_model_id = settings.get("multimodal_model_id")
            if multimodal_model_id:
                try:
                    model_obj = db.session.get(ModelConfig, int(multimodal_model_id))
                    if model_obj and model_obj.deployment_name:
                        app.config["AZURE_OPENAI_MULTIMODAL_DEPLOYMENT"] = (
                            model_obj.deployment_name
                        )
                except (ValueError, TypeError):
                    app.logger.warning(
                        "AppSettings.multimodal_model_id is not a valid integer."
                    )
                except Exception as mm_exc:
                    app.logger.warning(
                        f"Error loading multimodal model setting: {mm_exc}"
                    )

            app.logger.info("Loaded AppSettings into app.config.")
            app.logger.info(
                f"VISUAL_GROUNDING_ENABLED: {app.config['VISUAL_GROUNDING_ENABLED']}"
            )
            app.logger.info(
                "VISUAL_GROUNDING_DOC_STORE_PATH: %s",
                app.config["VISUAL_GROUNDING_DOC_STORE_PATH"],
            )
            app.logger.info("VECTOR_STORE_MODE: %s", app.config["VECTOR_STORE_MODE"])
            app.logger.info(
                "AZURE_OPENAI_MULTIMODAL_DEPLOYMENT: %s",
                app.config.get("AZURE_OPENAI_MULTIMODAL_DEPLOYMENT"),
            )
            app.logger.info(
                "IS_ENABLED_OCR: %s (mode=%s)",
                app.config.get("IS_ENABLED_OCR"),
                app.config.get("OCR_MODE"),
            )

            # Log Docling Export Type
            docling_export_type = app.config.get(
                "DOCLING_EXPORT_TYPE", "MARKDOWN"
            ).upper()  # Default to MARKDOWN
            app.logger.info(f"Docling Export Mode configured: {docling_export_type}")

        except Exception as e:
            app.logger.error(
                "Error loading AppSettings from database: %s. Using default values.",
                e,
            )
            # Apply defaults explicitly in case of error
            app.config.setdefault("VISUAL_GROUNDING_ENABLED", False)
            app.config.setdefault(
                "VISUAL_GROUNDING_DOC_STORE_PATH", "/home/data/doc_store"
            )
            app.config.setdefault("VECTOR_STORE_MODE", "user")
            app.config.setdefault(
                "IS_ENABLED_OCR",
                str(os.environ.get("IS_ENABLED_OCR", "0")).strip().lower()
                in ("1", "true", "yes", "on"),
            )
            app.config.setdefault(
                "IS_AUTO_OCR",
                str(os.environ.get("IS_AUTO_OCR", "0")).strip().lower()
                in ("1", "true", "yes", "on"),
            )
            app.config.setdefault("OCR_MODE", os.environ.get("OCR_MODE", "default"))
            app.config.setdefault(
                "DOC_INTELLIGENCE_ENDPOINT",
                os.environ.get("DOC_INTELLIGENCE_ENDPOINT", ""),
            )

    # Configure Login Manager
    login_manager.login_view = "login_route"

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
        import os

        try:
            about_url = url_for("about.about")
        except BuildError:
            about_url = None

        # Dynamic logo logic: check for custom logo, fallback to default
        custom_logo_path = os.path.join(app.static_folder, "img", "custom_logo.png")
        if os.path.exists(custom_logo_path):
            logo_url = url_for("static", filename="img/custom_logo.png")
            # Optional: add cache busting version, e.g. based on mtime
            try:
                mtime = int(os.path.getmtime(custom_logo_path))
                logo_url += f"?v={mtime}"
            except Exception:
                pass
        else:
            logo_url = url_for("static", filename="img/logo.png")

        app.logger.info(f"Generated about_url: {about_url}")
        app.logger.info(f"Logo URL: {logo_url}")

        pending_password_reset_count = 0
        if current_user.is_authenticated and getattr(current_user, "is_admin", False):
            try:
                pending_password_reset_count = count_password_reset_requests(
                    PASSWORD_RESET_STATUS_PENDING
                )
                if pending_password_reset_count:
                    app.logger.info(
                        "Admin navigation showing %s pending password reset requests",
                        pending_password_reset_count,
                    )
            except Exception as exc:
                app.logger.warning(
                    "Unable to count pending password reset requests: %s",
                    exc,
                )

        return dict(
            current_user=current_user,
            current_year=datetime.now().year,
            about_url=about_url,
            asset_bundle=asset_bundle,
            logo_url=logo_url,
            pending_password_reset_count=pending_password_reset_count,
        )

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        # Log the error if you want
        app.logger.warning(f"CSRF Error occurred: {e.description}")
        # Flash a message to the user
        flash(
            "Your session expired due to inactivity. Please try submitting the form again.",
            "warning",
        )
        # Redirect back to the page they were likely on (e.g., login)
        # You might need more sophisticated logic to redirect correctly in all cases
        # For login, redirecting back to login is usually safe.
        return redirect(
            url_for("auth.login")
        )  # Adjust 'auth.login' to your actual login route name

    @app.route("/api/csrf-token", methods=["GET"])  # Or @bp.route(...)
    def get_csrf_token_route():
        token = generate_csrf()
        return jsonify({"csrf_token": token})

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
    init_api_auth(app)
    modules.query.init_query(app)

    # Register feedback API blueprint
    from modules.feedback import feedback_bp

    app.register_blueprint(feedback_bp)
    csrf.exempt(feedback_bp)

    # Register admin feedback blueprint
    from modules.admin_feedback import admin_feedback_bp

    app.register_blueprint(admin_feedback_bp)

    # Register admin folder upload blueprint
    from modules.admin_folder_upload import admin_folder_upload_bp, api_folder_upload_bp

    app.register_blueprint(admin_folder_upload_bp)
    app.register_blueprint(api_folder_upload_bp)

    # Register admin downloads blueprint
    from modules.admin_downloads import downloads_bp, api_downloads_bp

    app.register_blueprint(downloads_bp)
    app.register_blueprint(api_downloads_bp)


    # Register admin providers blueprint
    from modules.admin_providers import admin_providers_bp

    app.register_blueprint(admin_providers_bp)

    # Register selfquery API blueprint
    from modules.selfquery import selfquery_bp

    app.register_blueprint(selfquery_bp)

    # Initialize default app settings
    with app.app_context():
        try:
            from modules.database import initialize_default_settings

            initialize_default_settings()
            app.logger.info("Default app settings initialized")
        except Exception as init_exc:
            app.logger.warning(
                "Failed to initialize default settings: %s", init_exc, exc_info=True
            )

    if app.config.get("EMBEDDING_WARMUP_ENABLED", False):
        try:
            from modules.llm_utils import (
                warmup_embedding_model,
                get_embedding_model_name,
                requires_local_embedding,
            )

            with app.app_context():
                current_embedding_model = get_embedding_model_name()
                # For local HuggingFace models, check if the required library is installed
                # This allows warmup on worker (has libs) but skips on web (no libs)
                if requires_local_embedding(current_embedding_model):
                    try:
                        import langchain_huggingface  # noqa: F401

                        # Library available, proceed with warmup (we're likely on worker)
                        warmup_embedding_model(
                            sample_text=app.config.get("EMBEDDING_WARMUP_TEXT")
                        )
                    except ImportError:
                        # Library not available, skip warmup (we're likely on web container)
                        app.logger.info(
                            "Embedding warmup skipped: model '%s' requires langchain-huggingface (not installed in this container).",
                            current_embedding_model,
                        )
                else:
                    # Azure/cloud model, can warm up in any container
                    warmup_embedding_model(
                        sample_text=app.config.get("EMBEDDING_WARMUP_TEXT")
                    )
        except Exception as warmup_exc:
            app.logger.warning(
                "Embedding warmup encountered an issue: %s", warmup_exc, exc_info=True
            )

    return app


# --- Application Instance Creation and Wrapping ---
# Create the Flask app instance using the factory. This is the raw WSGI app.
app = create_app()


@app.route('/health')
def health():
    """Simple health check endpoint for Docker/load balancer use."""
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    # This block runs the Flask app with the built-in development server,
    # which is great for local development (e.g., `python app.py`).
    # For production, we use Gunicorn as configured in our Docker entrypoint.
    host = app.config.get("HOST", "127.0.0.1")
    port = int(app.config.get("PORT", 5000))
    debug = app.config.get("DEBUG", False)

    app.run(host=host, port=port, debug=debug)
