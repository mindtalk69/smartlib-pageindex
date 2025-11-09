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
            logger.debug("Skipping Celery task module %s: %s", module, exc)


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

# Optional configuration
celery.conf.update(
    result_expires=3600,
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
