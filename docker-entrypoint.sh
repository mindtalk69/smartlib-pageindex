#!/bin/bash
set -e

UPLOAD_TEMP_DIR="${UPLOAD_TEMP_DIR:-/app/data/tmp_uploads}"
mkdir -p "$UPLOAD_TEMP_DIR"

# Check the first argument to decide which process to start
if [ "$1" = "web" ]; then
    echo "Starting Flask web application..."

    # Environment detection with better Azure check
    IS_AZURE=false

    if [ "$LOCAL_MODE" = "true" ] || [ "$RUNNING_LOCALLY" = "true" ]; then
        echo "LOCAL_MODE detected. Skipping Azure authentication..."
        IS_AZURE=false
    elif [ -n "$WEBSITE_INSTANCE_ID" ] && [ -n "$WEBSITE_SITE_NAME" ]; then
        if command -v az &> /dev/null; then
            echo "Running in Azure Web App. Using Managed Identity..."
            IS_AZURE=true
        else
            echo "Azure env vars detected but az CLI not available. Running locally..."
            IS_AZURE=false
        fi
    else
        echo "Running locally. Skipping Azure authentication..."
        IS_AZURE=false
    fi

    if [ "$IS_AZURE" = true ]; then
        # Azure-specific setup will be added when needed
        az login --identity 2>/dev/null || echo "Managed Identity login attempted"
    fi

    # Set environment defaults
    export HOST=${HOST:-0.0.0.0}
    export PORT=${PORT:-8000}
    export WORKERS=${WORKERS:-1}
    export GUNICORN_TIMEOUT=${GUNICORN_TIMEOUT:-120}

    echo "Starting Flask app on $HOST:$PORT with $WORKERS workers (timeout ${GUNICORN_TIMEOUT}s)..."

    # Initialize database if not exists and run migrations
    echo "Checking and initializing database..."
    if command -v alembic &> /dev/null; then
        echo "Running alembic upgrade to ensure database is up to date..."
        alembic upgrade head
    else
        echo "Alembic not found, running direct database initialization..."
        python -c "from modules.database import init_db; init_db()"
    fi

    if [ -f add_llm_languages_table.py ]; then
        echo "Seeding default LLM languages if needed..."
        python add_llm_languages_table.py
    else
        echo "Language seed script not found; skipping."
    fi

    if [ -f add_catalogs_table.py ]; then
        echo "Seeding default catalogs if needed..."
        python add_catalogs_table.py
    else
        echo "Catalog seed script not found; skipping."
    fi

    if [ -f add_categories_table.py ]; then
        echo "Seeding default categories if needed..."
        python add_categories_table.py
    else
        echo "Category seed script not found; skipping."
    fi

    # Create default models if explicitly requested (handled by worker normally)
    if [ "$IS_AZURE" = false ] && [ -f create_default_models.py ] && [ "$RUN_DEFAULT_MODELS" = "true" ]; then
        echo "RUN_DEFAULT_MODELS=true detected. Creating default models..."
        python create_default_models.py
    else
        echo "Skipping local default model creation in web container. Set RUN_DEFAULT_MODELS=true to enable."
    fi

    # Determine which app file to use
    APP_MODULE=${APP_MODULE:-"main:app"}

    # Try to start with gunicorn if available, otherwise use Flask
    if command -v gunicorn &> /dev/null; then
        echo "Starting with gunicorn..."
        exec gunicorn \
            --bind "$HOST:$PORT" \
            --workers "$WORKERS" \
            --timeout "$GUNICORN_TIMEOUT" \
            --access-logfile - \
            --error-logfile - \
            --log-level info \
            "$APP_MODULE"
    else
        echo "Gunicorn not found, starting with Flask development server..."
        # Extract module and app variable
        MODULE=$(echo $APP_MODULE | cut -d: -f1)

        export FLASK_APP="$MODULE"
        export FLASK_ENV=${FLASK_ENV:-production}

        exec python -m flask run --host="$HOST" --port="$PORT"
    fi

elif [ "$1" = "worker" ]; then
    echo "Starting Celery worker..."

    # Environment detection (simplified for worker)
    if [ "$LOCAL_MODE" = "true" ] || [ "$RUNNING_LOCALLY" = "true" ]; then
        echo "Local mode detected for worker..."
    fi

    # Start the Celery worker
    exec celery -A celery_app.celery worker --loglevel=info

else
    echo "Error: Must specify 'web' or 'worker' as the first argument."
    exit 1
fi
