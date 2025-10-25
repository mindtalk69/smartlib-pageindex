from celery import Celery
import logging
import os
from flask import current_app

# Get the broker URL from environment variables
# Use a default for local development if not set
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

# Initialize Celery
celery = Celery(
    'flaskrag3',
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
