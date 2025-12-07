from celery import Celery
import logging
import os
from datetime import timedelta
from flask import current_app

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

TASK_MODULES = (
    'modules.admin_folder_upload',
    'modules.upload_processing',
    'modules.vector_tasks',
    'modules.agent_tasks',
)


def _register_task_modules():
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


_register_task_modules()

_flask_app = None


def _get_flask_app():
    global _flask_app
    if _flask_app is None:
        from app import create_app
        _flask_app = create_app()
    return _flask_app


# Create a custom Task class that runs in the Flask app context
class ContextTask(celery.Task):
    def __call__(self, *args, **kwargs):
        app = _get_flask_app()
        with app.app_context():
            return self.run(*args, **kwargs)

# Set the custom Task class as the default
celery.Task = ContextTask

# Production-recommended Celery configuration
# Reference: https://medium.com/@hankehly/10-essential-lessons-for-running-celery-workloads-in-production
celery.conf.update(
    # Task acknowledgement - only ack AFTER task completes (prevents lost tasks on crash)
    task_acks_late=True,
    
    # Prefetch - set to 1 for long-running tasks like document processing
    worker_prefetch_multiplier=1,
    
    # Restart worker after N tasks to prevent memory leaks
    worker_max_tasks_per_child=100,
    
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

# Worker keep-alive heartbeat to prevent Azure App Service cold starts
# Runs every 5 minutes to ensure worker stays warm
@celery.task(name="celery_app.worker_heartbeat")
def worker_heartbeat():
    """Simple heartbeat task to keep worker warm and prevent cold starts."""
    import datetime
    logger.info(f"[Heartbeat] Worker is alive at {datetime.datetime.utcnow().isoformat()}")
    return {"status": "alive", "timestamp": datetime.datetime.utcnow().isoformat()}

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
