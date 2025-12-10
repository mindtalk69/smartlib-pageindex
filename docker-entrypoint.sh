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

    # Retry configuration
    local max_retries="${MOUNT_CHECK_RETRIES:-5}"
    local retry_delay="${MOUNT_CHECK_DELAY:-2}"
    local attempt=1

    echo "Validating data directory mount at ${target_dir}..."
    echo "Will retry up to ${max_retries} times with ${retry_delay}s initial delay..."

    while [ $attempt -le $max_retries ]; do
        echo "Mount check attempt ${attempt}/${max_retries}..."

        if python scripts/check_data_mount.py --path "${target_dir}"; then
            echo "✓ Mount validation successful on attempt ${attempt}"
            return 0
        fi

        if [ $attempt -lt $max_retries ]; then
            local wait_time=$((retry_delay * attempt))
            echo "Mount not ready yet. Waiting ${wait_time}s before retry ${attempt}/${max_retries}..."
            sleep $wait_time
        fi

        attempt=$((attempt + 1))
    done

    echo "ERROR: Data directory ${target_dir} failed mount validation after ${max_retries} attempts." >&2
    echo "Set SKIP_DATA_MOUNT_CHECK=true to bypass (not recommended)." >&2
    echo "Or increase MOUNT_CHECK_RETRIES/MOUNT_CHECK_DELAY environment variables." >&2
    exit 1
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

start_sshd() {
    if ! command -v /usr/sbin/sshd >/dev/null 2>&1; then
        echo "sshd not available; skipping SSH startup."
        return 0
    fi

    local ssh_user="${SSH_USERNAME:-appuser}"
    local ssh_pass="${SSH_PASSWORD:-Docker!123}"

    if ! id -u "$ssh_user" >/dev/null 2>&1; then
        echo "Creating SSH user $ssh_user"
        useradd -m -s /bin/bash "$ssh_user"
    fi

    echo "$ssh_user:$ssh_pass" | chpasswd
    mkdir -p /var/run/sshd

    if pgrep -x sshd >/dev/null 2>&1; then
        echo "sshd already running."
        return 0
    fi

    echo "Starting sshd on port 2222 for Azure Web App access..."
    /usr/sbin/sshd -D &
}


# Check the first argument to decide which process to start
if [ "$1" = "web" ]; then
    echo "Starting Flask web application..."

    check_data_mount

    start_sshd

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

        # Check if we need to wait for PostgreSQL (Enterprise Edition)
        # We check if APP_EDITION is ENT OR if the URI looks like postgres
        if [ "${APP_EDITION}" = "ENT" ] || [[ "${SQLALCHEMY_DATABASE_URI}" == postgres* ]]; then
             echo "PostgreSQL detected (Edition: ${APP_EDITION}). Waiting for database to be ready..."
             
             # Use a small python script to wait for DB connection
             python <<'PY'
import os
import time
import sys
import psycopg
from sqlalchemy.engine import make_url

# Debug: Print env vars
print(f"DEBUG: APP_EDITION={os.environ.get('APP_EDITION')}")
print(f"DEBUG: POSTGRES_HOST={os.environ.get('POSTGRES_HOST')}")
# Don't print password in logs for security, just check if it exists
print(f"DEBUG: POSTGRES_PASSWORD set? {'Yes' if os.environ.get('POSTGRES_PASSWORD') else 'No'}")

# Parse connection params from env vars (preferred for ENT) or URI
host = os.environ.get("POSTGRES_HOST")
user = os.environ.get("POSTGRES_USER")
password = os.environ.get("POSTGRES_PASSWORD")
dbname = os.environ.get("POSTGRES_DATABASE")
port = os.environ.get("POSTGRES_PORT", "5432")

# Fallback to parsing URI if individual vars aren't set
uri = os.environ.get("SQLALCHEMY_DATABASE_URI", "")
if not host and uri and uri.startswith("postgres"):
    try:
        url = make_url(uri)
        host = url.host
        port = url.port or 5432
        user = url.username
        password = url.password
        dbname = url.database
        print(f"DEBUG: Parsed host from URI: {host}")
    except Exception as e:
        print(f"Warning: Failed to parse SQLALCHEMY_DATABASE_URI: {e}")

# Fallback defaults for Enterprise edition
if os.environ.get("APP_EDITION") == "ENT":
    if not host:
        print("Warning: POSTGRES_HOST not set, defaulting to 'postgres'")
        host = "postgres"
    if not user:
        print("Warning: POSTGRES_USER not set, defaulting to 'smartlib_admin'")
        user = "smartlib_admin"
    if not password:
        print("Warning: POSTGRES_PASSWORD not set, defaulting to 'smartlib_dev_password'")
        password = "smartlib_dev_password"
    if not dbname:
        print("Warning: POSTGRES_DATABASE not set, defaulting to 'smartlibdb'")
        dbname = "smartlibdb"

if not host:
    print("Error: Could not determine PostgreSQL host from env vars or URI.")
    # We don't exit here to allow the script to fail naturally or maybe it's a local socket case (unlikely in Docker)
    pass

print(f"Waiting for PostgreSQL at {host}:{port}...")

for i in range(30): # Wait up to 30 seconds
    try:
        # Try to connect (Azure PostgreSQL requires SSL)
        ssl_mode = os.environ.get("POSTGRES_SSL_MODE", "require")
        conn = psycopg.connect(
            host=host,
            user=user,
            password=password,
            dbname=dbname,
            port=port,
            sslmode=ssl_mode,
            connect_timeout=3
        )
        conn.close()
        print("PostgreSQL is ready!")
        sys.exit(0)
    except Exception as e:
        print(f"Waiting for DB... ({e})")
        time.sleep(1)

print("Error: Timed out waiting for PostgreSQL.")
sys.exit(1)
PY
             
             # Build and export SQLALCHEMY_DATABASE_URI for Alembic
             # This ensures migrations run against PostgreSQL, not SQLite
             if [ -n "${POSTGRES_HOST}" ] && [ -n "${POSTGRES_USER}" ] && [ -n "${POSTGRES_PASSWORD}" ] && [ -n "${POSTGRES_DATABASE}" ]; then
                 POSTGRES_SSL_MODE="${POSTGRES_SSL_MODE:-disable}"
                 # URL-encode the password to handle special characters like @, :, /, etc.
                 ENCODED_PASSWORD=$(python -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))")
                 export SQLALCHEMY_DATABASE_URI="postgresql+psycopg://${POSTGRES_USER}:${ENCODED_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DATABASE}?sslmode=${POSTGRES_SSL_MODE}"
                 echo "INFO: Set SQLALCHEMY_DATABASE_URI for PostgreSQL (host: ${POSTGRES_HOST}, db: ${POSTGRES_DATABASE})"
             fi
        fi

        echo "Running alembic upgrade to ensure database is up to date..."
        alembic upgrade head
    else
        echo "Alembic not found, running direct database initialization..."
        python -c "from modules.database import init_db; init_db()"
    fi

    # Optional admin bootstrap (runs once when AUTO_PROMOTE_ADMIN=true)
    # MUST run before catalogs and categories since they need a user to exist
    if [ "${AUTO_PROMOTE_ADMIN:-false}" = "true" ]; then
        if [ -f promote_admin_sqlalchemy.py ]; then
            echo "Auto-promoting admin user..."
            python promote_admin_sqlalchemy.py
        else
            echo "promote_admin_sqlalchemy.py not found; skipping admin promotion."
        fi
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
    if [ -f create_default_models.py ] && [ "${RUN_DEFAULT_MODELS:-false}" = "true" ]; then
        echo "RUN_DEFAULT_MODELS=true detected. Creating default models..."
        python create_default_models.py
    else
        echo "Skipping default model creation. Set RUN_DEFAULT_MODELS=true to enable."
    fi

    # Determine which app file to use
    APP_MODULE=${APP_MODULE:-"app:app"}

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

    start_sshd

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

        # Check if we need to wait for PostgreSQL (Enterprise Edition)
        if [ "${APP_EDITION}" = "ENT" ] || [[ "${SQLALCHEMY_DATABASE_URI}" == postgres* ]]; then
             echo "PostgreSQL detected (Edition: ${APP_EDITION}). Waiting for database to be ready..."
             
             # Use a small python script to wait for DB connection
             python <<'PY'
import os
import time
import sys
import psycopg
from sqlalchemy.engine import make_url

# Debug: Print env vars
print(f"DEBUG: APP_EDITION={os.environ.get('APP_EDITION')}")
print(f"DEBUG: POSTGRES_HOST={os.environ.get('POSTGRES_HOST')}")
print(f"DEBUG: POSTGRES_PASSWORD set? {'Yes' if os.environ.get('POSTGRES_PASSWORD') else 'No'}")

# Parse connection params from env vars (preferred for ENT) or URI
host = os.environ.get("POSTGRES_HOST")
user = os.environ.get("POSTGRES_USER")
password = os.environ.get("POSTGRES_PASSWORD")
dbname = os.environ.get("POSTGRES_DATABASE")
port = os.environ.get("POSTGRES_PORT", "5432")

# Fallback to parsing URI if individual vars aren't set
uri = os.environ.get("SQLALCHEMY_DATABASE_URI", "")
if not host and uri and uri.startswith("postgres"):
    try:
        url = make_url(uri)
        host = url.host
        port = url.port or 5432
        user = url.username
        password = url.password
        dbname = url.database
        print(f"DEBUG: Parsed host from URI: {host}")
    except Exception as e:
        print(f"Warning: Failed to parse SQLALCHEMY_DATABASE_URI: {e}")

# Fallback defaults for Enterprise edition
if os.environ.get("APP_EDITION") == "ENT":
    if not host:
        print("Warning: POSTGRES_HOST not set, defaulting to 'postgres'")
        host = "postgres"
    if not user:
        print("Warning: POSTGRES_USER not set, defaulting to 'smartlib_admin'")
        user = "smartlib_admin"
    if not password:
        print("Warning: POSTGRES_PASSWORD not set, defaulting to 'smartlib_dev_password'")
        password = "smartlib_dev_password"
    if not dbname:
        print("Warning: POSTGRES_DATABASE not set, defaulting to 'smartlibdb'")
        dbname = "smartlibdb"

if not host:
    print("Error: Could not determine PostgreSQL host from env vars or URI.")
    pass

print(f"Waiting for PostgreSQL at {host}:{port}...")

for i in range(30): # Wait up to 30 seconds
    try:
        # Try to connect (Azure PostgreSQL requires SSL)
        ssl_mode = os.environ.get("POSTGRES_SSL_MODE", "require")
        conn = psycopg.connect(
            host=host,
            user=user,
            password=password,
            dbname=dbname,
            port=port,
            sslmode=ssl_mode,
            connect_timeout=3
        )
        conn.close()
        print("PostgreSQL is ready!")
        sys.exit(0)
    except Exception as e:
        print(f"Waiting for DB... ({e})")
        time.sleep(1)

print("Error: Timed out waiting for PostgreSQL.")
sys.exit(1)
PY
             
             # Build and export SQLALCHEMY_DATABASE_URI for Alembic
             if [ -n "${POSTGRES_HOST}" ] && [ -n "${POSTGRES_USER}" ] && [ -n "${POSTGRES_PASSWORD}" ] && [ -n "${POSTGRES_DATABASE}" ]; then
                 POSTGRES_SSL_MODE="${POSTGRES_SSL_MODE:-disable}"
                 # URL-encode the password to handle special characters like @, :, /, etc.
                 ENCODED_PASSWORD=$(python -c "import urllib.parse; print(urllib.parse.quote('${POSTGRES_PASSWORD}', safe=''))")
                 export SQLALCHEMY_DATABASE_URI="postgresql+psycopg://${POSTGRES_USER}:${ENCODED_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DATABASE}?sslmode=${POSTGRES_SSL_MODE}"
                 echo "INFO: Set SQLALCHEMY_DATABASE_URI for PostgreSQL (host: ${POSTGRES_HOST}, db: ${POSTGRES_DATABASE})"
             fi
        fi

        echo "Running alembic upgrade to ensure database is up to date..."
        alembic upgrade head
    else
        echo "Alembic not found, running direct database initialization..."
        python -c "from modules.database import init_db; init_db()"
    fi

    # Start the Celery worker with embedded beat scheduler for heartbeat and scheduled tasks
    # IMPORTANT: --without-heartbeat --without-gossip --without-mingle fixes Celery issue #8030
    # where worker stops consuming tasks after Redis reconnection
    # See: https://github.com/celery/celery/issues/8030
    CELERY_POOL=${CELERY_POOL:-prefork}
    CELERY_BEAT_ENABLED=${CELERY_BEAT_ENABLED:-true}
    echo "Starting Celery worker with pool type: ${CELERY_POOL}, beat enabled: ${CELERY_BEAT_ENABLED}..."
    
    # Common args to fix Redis reconnection issue (Celery #8030)
    CELERY_WORKER_ARGS="--without-heartbeat --without-gossip --without-mingle"
    
    if [ "$CELERY_BEAT_ENABLED" = "true" ]; then
        # Run worker with embedded beat scheduler (-B) for heartbeat and scheduled cleanup tasks
        exec celery -A celery_app.celery worker --loglevel=info --pool="${CELERY_POOL}" -B ${CELERY_WORKER_ARGS}
    else
        exec celery -A celery_app.celery worker --loglevel=info --pool="${CELERY_POOL}" ${CELERY_WORKER_ARGS}
    fi

else
    echo "Error: Must specify 'web' or 'worker' as the first argument."
    exit 1
fi
