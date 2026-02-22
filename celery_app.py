from celery import Celery
import logging
import os
import sys
from datetime import timedelta
from flask import current_app

# Ensure project root is in sys.path for robust imports in child processes
project_root = os.path.abspath(os.path.dirname(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Get the broker URL from environment variables
# Use a default for local development if not set
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

# Initialize Celery
celery = Celery(
    'smartlib',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

logger = logging.getLogger(__name__)

# Build version is logged after is_celery_worker check to show correct container type

TASK_MODULES = [
    'modules.admin_folder_upload',
    'modules.upload_processing',
    'modules.vector_tasks',
    'modules.agent_tasks',
]

# --- Flask App Context for Celery Tasks ---
# IMPORTANT: This MUST be defined BEFORE importing task modules
# so that all @celery.task decorators use ContextTask as their base class

_flask_app = None


def _get_flask_app():
    global _flask_app
    if _flask_app is None:
        # IMPORTANT: app.py forces multiprocessing start method to 'spawn',
        # so worker child processes start fresh and do NOT inherit the parent's
        # sys.path. We must insert the project root here, inside this function,
        # so it runs in the spawned process before the import.
        project_root = os.path.abspath(os.path.dirname(__file__))
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
            logger.info("[Celery Worker] Inserted project root into sys.path: %s", project_root)
        try:
            from app import create_app
            _flask_app = create_app()
        except ImportError as e:
            logger.error("[Celery Worker] Failed to import 'app' module: %s (sys.path=%s)", e, sys.path)
            raise
    return _flask_app


# Create a custom Task class that runs in the Flask app context
class ContextTask(celery.Task):
    def __call__(self, *args, **kwargs):
        app = _get_flask_app()
        with app.app_context():
            return self.run(*args, **kwargs)


# Set the custom Task class as the default - MUST be before task imports!
celery.Task = ContextTask


def _register_task_modules():
    """Import task modules to register Celery tasks. Also adds to celery.conf.include."""
    # Add modules to Celery's include config for proper task discovery
    celery.conf.include = list(TASK_MODULES)
    logger.info("Celery include set to: %s", celery.conf.include)
    
    for module in TASK_MODULES:
        try:
            __import__(module)
            logger.info("Registered Celery tasks from %s", module)
        except ImportError as exc:
            if "docling" in str(exc) or "No module named 'docling'" in str(exc):
                # Web container does not have docling, this is expected.
                logger.info(f"Skipping worker-only task module {module} (missing dependency: {exc})")
            else:
                logger.error(f"Failed to import Celery task module {module}", exc_info=True)


# Only register task modules if we're being run as a Celery worker
# This prevents heavy imports (docling etc) from blocking web container startup
import sys
is_celery_worker = (
    'celery' in sys.argv[0].lower() or  # Running via celery CLI
    os.environ.get('CELERY_WORKER') == '1' or  # Explicit worker flag
    any('worker' in arg for arg in sys.argv)  # Worker argument passed
)

if is_celery_worker:
    # Log version banner for WORKER container
    try:
        from config import Config
        logger.info("=" * 60)
        logger.info(f"SmartLib WORKER Build: v{Config.APP_VERSION} ({Config.BUILD_DATE})")
        logger.info("=" * 60)
    except ImportError:
        pass
    logger.info("Detected Celery worker context, registering task modules...")
    _register_task_modules()

# Worker keep-alive heartbeat to prevent Azure App Service cold starts
# Runs every 5 minutes to ensure worker stays warm
# NOTE: Defined BEFORE task registry logging so it appears in the list
@celery.task(name="celery_app.worker_heartbeat")
def worker_heartbeat():
    """Simple heartbeat task to keep worker warm and prevent cold starts."""
    import datetime
    logger.info(f"[Heartbeat] Worker is alive at {datetime.datetime.utcnow().isoformat()}")
    return {"status": "alive", "timestamp": datetime.datetime.utcnow().isoformat()}

if is_celery_worker:
    # Log all registered tasks at startup for debugging
    logger.info("=== Registered Celery Tasks ===")
    for task_name in sorted(celery.tasks.keys()):
        if not task_name.startswith('celery.'):  # Skip built-in celery tasks
            logger.info("  - %s", task_name)
    logger.info("=== End Registered Tasks ===")
else:
    # Log version banner for WEB container
    try:
        from config import Config
        logger.info("=" * 60)
        logger.info(f"SmartLib WEB Build: v{Config.APP_VERSION} ({Config.BUILD_DATE})")
        logger.info("=" * 60)
    except ImportError:
        pass
    logger.info("Not in Celery worker context, skipping heavy task module imports")

# Production-recommended Celery configuration
# Reference: https://medium.com/@hankehly/10-essential-lessons-for-running-celery-workloads-in-production
celery.conf.update(
    # Task acknowledgement - only ack AFTER task completes (prevents lost tasks on crash)
    task_acks_late=True,
    
    # Prefetch - set to 1 for long-running tasks like document processing
    worker_prefetch_multiplier=1,
    
    # Restart worker after N tasks to prevent memory leaks
    worker_max_tasks_per_child=100,
    
    # Worker pool — default 'solo' for single-container GPU deployments.
    # 'solo' runs tasks in the same process: no forking, no CUDA re-initialization crash.
    # Override with CELERY_WORKER_POOL=prefork for multi-worker (non-GPU) deployments.
    worker_pool=os.environ.get('CELERY_WORKER_POOL', 'solo'),
    
    # Result expiry
    result_expires=3600,
    
    # Broker connection retry settings (Redis)
    broker_connection_retry=True,
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=0,  # Unlimited retries
    
    # Redis transport options for retry policy
    broker_transport_options={
        'visibility_timeout': 43200,  # 12 hours - tasks won't be redelivered until this
        'retry_policy': {
            'timeout': 5.0,
        },
    },
    
    # Cancel long-running tasks if broker connection lost (Celery 5.1+)
    worker_cancel_long_running_tasks_on_connection_loss=True,
)

map_cleanup_interval = int(os.environ.get('MAP_CLEANUP_INTERVAL_HOURS', '6') or 0)
if map_cleanup_interval > 0:
    beat_schedule = getattr(celery.conf, 'beat_schedule', {})
    beat_schedule.update({
        'cleanup-generated-maps': {
            'task': 'modules.agent.cleanup_generated_maps',
            'schedule': timedelta(hours=map_cleanup_interval),
        }
    })
    celery.conf.beat_schedule = beat_schedule

message_cleanup_interval = int(os.environ.get('MESSAGE_CLEANUP_INTERVAL_HOURS', '24') or 0)
if message_cleanup_interval > 0:
    beat_schedule = getattr(celery.conf, 'beat_schedule', {})
    beat_schedule.update({
        'cleanup-message-history': {
            'task': 'modules.agent.cleanup_message_history',
            'schedule': timedelta(hours=message_cleanup_interval),
        }
    })
    celery.conf.beat_schedule = beat_schedule


# Enable heartbeat by default, can be disabled with WORKER_HEARTBEAT_ENABLED=false
heartbeat_enabled = os.environ.get('WORKER_HEARTBEAT_ENABLED', 'true').lower() == 'true'
heartbeat_interval = int(os.environ.get('WORKER_HEARTBEAT_INTERVAL_MINUTES', '5') or 5)
if heartbeat_enabled and heartbeat_interval > 0:
    beat_schedule = getattr(celery.conf, 'beat_schedule', {})
    beat_schedule.update({
        'worker-heartbeat': {
            'task': 'celery_app.worker_heartbeat',
            'schedule': timedelta(minutes=heartbeat_interval),
        }
    })
    celery.conf.beat_schedule = beat_schedule
    logger.info(f"[Celery] Worker heartbeat enabled, interval: {heartbeat_interval} minutes")

if __name__ == '__main__':
    celery.start()


# Remove the init_celery function as configuration/context is handled by ContextTask now

# Usage:
# from flask import Flask
# from celery import Celery
# from celery import current_app as current_celery_app
# from celery import shared_task
#
# app = Flask(__name__)
# celery = make_celery(app)
#
# @celery.task()
# def my_background_task():
#     pass
