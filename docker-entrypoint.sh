#!/bin/bash
set -e

UPLOAD_TEMP_DIR="${UPLOAD_TEMP_DIR:-/app/data/tmp_uploads}"
mkdir -p "$UPLOAD_TEMP_DIR"

# Normalize arguments when invoked via Azure startup shim
if [ "$1" = "./docker-entrypoint.sh" ] || [ "$1" = "docker-entrypoint.sh" ]; then
    shift
fi

if [ -z "$1" ]; then
    set -- web "$@"
fi

check_data_mount() {
    local target_dir="${DATA_VOLUME_PATH:-/app/data}"
    if [ "${SKIP_DATA_MOUNT_CHECK:-false}" = "true" ]; then
        echo "Skipping data mount check (SKIP_DATA_MOUNT_CHECK=true)."
        return 0
    fi

    if [ ! -f scripts/check_data_mount.py ]; then
        echo "Mount check script not found; skipping." >&2
        return 0
    fi

    echo "Validating data directory mount at ${target_dir}..."
    if ! python scripts/check_data_mount.py --path "${target_dir}"; then
        echo "ERROR: Data directory ${target_dir} failed mount validation." >&2
        echo "Set SKIP_DATA_MOUNT_CHECK=true to bypass (not recommended)." >&2
        exit 1
    fi
}

prepare_sqlite_db() {
    if [ -z "${SQLALCHEMY_DATABASE_URI:-}" ]; then
        return 0
    fi

    python <<'PY'
import os
import sqlite3
import time
from sqlalchemy.engine import make_url

uri = os.environ.get("SQLALCHEMY_DATABASE_URI")
if not uri or not uri.startswith("sqlite"):
    raise SystemExit(0)

url = make_url(uri)
db_path = url.database
if not db_path or db_path == ":memory:":
    raise SystemExit(0)

if not os.path.isabs(db_path):
    db_path = os.path.abspath(db_path)

parent_dir = os.path.dirname(db_path)
os.makedirs(parent_dir, exist_ok=True)

try:
    open(db_path, "a", encoding="utf-8").close()
except Exception as exc:
    print(f"WARNING: SQLite preflight could not touch {db_path}: {exc}")

journal_mode = os.environ.get("SQLITE_JOURNAL_MODE", "DELETE").upper()
last_exc = None
for attempt in range(5):
    try:
        conn = sqlite3.connect(db_path, timeout=30)
        conn.execute(f"PRAGMA journal_mode={journal_mode};")
        conn.execute("PRAGMA busy_timeout = 10000;")
        conn.close()
        if attempt:
            print(f"INFO: SQLite preflight succeeded for {db_path} after {attempt + 1} attempts.")
        break
    except Exception as exc:
        last_exc = exc
        time.sleep(1 + attempt)
else:
    print(f"WARNING: SQLite preflight failed for {db_path}: {last_exc}")
PY
}


# Check the first argument to decide which process to start
if [ "$1" = "web" ]; then
    echo "Starting Flask web application..."

    check_data_mount

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
        prepare_sqlite_db
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

    # Optional admin bootstrap (runs once when AUTO_PROMOTE_ADMIN=true)
    if [ "${AUTO_PROMOTE_ADMIN:-false}" = "true" ]; then
        ADMIN_SENTINEL="${ADMIN_SENTINEL_PATH:-/app/data/.admin_seeded}"
        if [ -f "$ADMIN_SENTINEL" ]; then
            echo "Admin bootstrap already completed (found $ADMIN_SENTINEL)."
        elif [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
            echo "AUTO_PROMOTE_ADMIN=true but ADMIN_EMAIL or ADMIN_PASSWORD not provided. Skipping admin bootstrap."
        elif [ ! -f promote_admin_sqlalchemy.py ]; then
            echo "promote_admin_sqlalchemy.py not found; cannot bootstrap admin user."
        else
            ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
            echo "Bootstrapping admin user $ADMIN_EMAIL (username: $ADMIN_USERNAME)..."
            if python promote_admin_sqlalchemy.py --email "$ADMIN_EMAIL" --username "$ADMIN_USERNAME" --password "$ADMIN_PASSWORD"; then
                touch "$ADMIN_SENTINEL"
                echo "Admin bootstrap completed. Sentinel created at $ADMIN_SENTINEL."
            else
                echo "Admin bootstrap script reported an error." >&2
            fi
        fi
    fi

    # Create default models if explicitly requested (handled by worker normally)
    if [ -f create_default_models.py ] && [ "${RUN_DEFAULT_MODELS:-false}" = "true" ]; then
        echo "RUN_DEFAULT_MODELS=true detected. Creating default models..."
        python create_default_models.py
    else
        echo "Skipping default model creation. Set RUN_DEFAULT_MODELS=true to enable."
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

    check_data_mount

    # Environment detection (simplified for worker)
    if [ "$LOCAL_MODE" = "true" ] || [ "$RUNNING_LOCALLY" = "true" ]; then
        echo "Local mode detected for worker..."
    fi

    HEALTH_ENABLED="${ENABLE_WORKER_HEALTH_SERVER:-true}"
    HEALTH_PORT="${WORKER_HEALTH_PORT:-8080}"
    if [ "$HEALTH_ENABLED" = "true" ]; then
        echo "Launching lightweight health server on port ${HEALTH_PORT} for App Service warmup checks..."
        python -m http.server "$HEALTH_PORT" --bind 0.0.0.0 >/tmp/worker-health.log 2>&1 &
    else
        echo "Worker health server disabled (ENABLE_WORKER_HEALTH_SERVER=false)."
    fi

    # Ensure database schema is current before starting the worker
    echo "Ensuring database schema is up to date before starting worker..."
    if command -v alembic &> /dev/null; then
        prepare_sqlite_db
        echo "Running alembic upgrade to ensure database is up to date..."
        alembic upgrade head
    else
        echo "Alembic not found, running direct database initialization..."
        python -c "from modules.database import init_db; init_db()"
    fi

    # Start the Celery worker
    exec celery -A celery_app.celery worker --loglevel=info

else
    echo "Error: Must specify 'web' or 'worker' as the first argument."
    exit 1
fi
