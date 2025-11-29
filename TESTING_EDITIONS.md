# Testing SmartLib Editions Locally

This guide explains how to test both Basic and Enterprise editions of SmartLib using Docker Compose.

## Edition Overview

| Edition | Database | Vector Store | Configuration |
|---------|----------|--------------|---------------|
| **BASIC** | SQLite | ChromaDB | Default |
| **ENT** (Enterprise) | PostgreSQL | PGVector | Requires PostgreSQL |

## Testing Basic Edition (Default)

The Basic edition uses SQLite and ChromaDB. This is the default configuration.

### Start Basic Edition
```bash
# Default - runs as BASIC edition
docker compose up --build

# Or explicitly set APP_EDITION
APP_EDITION=BASIC docker compose up --build
```

### What You Get
- ✅ SQLite database at `./data/app.db`
- ✅ ChromaDB vector store at `./data/chroma/`
- ✅ Redis for Celery tasks
- ✅ 10 user limit (configurable)

### Access
- Web UI: http://localhost:8000
- Redis: localhost:6379

---

## Testing Enterprise Edition

The Enterprise edition uses PostgreSQL with pgvector extension.

### Start Enterprise Edition

**Step 1: Start the containers**
```bash
# Use docker-compose.enterprise.yaml overlay
docker compose -f docker-compose.yaml -f docker-compose.enterprise.yaml up --build
```

**Step 2: Enable pgvector extension (one-time setup)**

In a new terminal, run:
```bash
./enable-pgvector.sh
```

Or manually:
```bash
docker exec smartlib-postgres-1 psql -U smartlib_admin -d smartlibdb -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### What You Get
- ✅ PostgreSQL 16 with pgvector extension
- ✅ PGVector vector store
- ✅ Redis for Celery tasks
- ✅ Unlimited users

### Access
- Web UI: http://localhost:8000
- PostgreSQL: localhost:5432
  - User: `smartlib_admin`
  - Password: `smartlib_dev_password`
  - Database: `smartlibdb`
- Redis: localhost:6379

### Verify PostgreSQL Setup
```bash
# Connect to PostgreSQL
docker exec -it smartlib-postgres-1 psql -U smartlib_admin -d smartlibdb

# Check pgvector extension
\dx vector

# Should show:
#  Name   | Version | Schema |         Description
# --------+---------+--------+------------------------------
#  vector | 0.7.0   | public | vector data type and ivfflat and hnsw access methods
```

---

## Environment Variable Control

You can also control the edition using environment variables or `.env.dev`:

### Option 1: Environment Variable
```bash
# Basic
APP_EDITION=BASIC docker compose up

# Enterprise (requires PostgreSQL)
APP_EDITION=ENT docker compose up
```

### Option 2: Update .env.dev
Add to `.env.dev`:
```bash
# For Basic tier
APP_EDITION=BASIC

# For Enterprise tier
APP_EDITION=ENT
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=smartlib_admin
POSTGRES_PASSWORD=smartlib_dev_password
POSTGRES_DATABASE=smartlibdb
POSTGRES_SSL_MODE=disable
```

---

## Switching Between Editions

### From Basic → Enterprise
```bash
# Stop Basic edition
docker compose down

# Start Enterprise edition
docker compose -f docker-compose.yaml -f docker-compose.enterprise.yaml up --build
```

**Note:** Data is NOT automatically migrated. You'll start with a fresh PostgreSQL database.

### From Enterprise → Basic
```bash
# Stop Enterprise edition
docker compose -f docker-compose.yaml -f docker-compose.enterprise.yaml down

# Start Basic edition
docker compose up --build
```

---

## Cleanup

### Remove Basic edition data
```bash
docker compose down -v
rm -rf ./data/app.db ./data/chroma/
```

### Remove Enterprise edition data
```bash
docker compose -f docker-compose.yaml -f docker-compose.enterprise.yaml down -v
```

---

## Troubleshooting

### "pgvector extension not found"
The PostgreSQL container should automatically enable pgvector via `init-pgvector.sql`. If it fails:

```bash
# Connect to PostgreSQL
docker exec -it smartlib-postgres-1 psql -U smartlib_admin -d smartlibdb

# Manually enable extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### "Connection refused to PostgreSQL"
Wait for PostgreSQL health check to pass:
```bash
docker compose -f docker-compose.yaml -f docker-compose.enterprise.yaml logs postgres
```

Look for: `database system is ready to accept connections`

### Check which edition is running
```bash
# View web container logs
docker compose logs web | grep "APP_EDITION"

# Should show:
# DEBUG [config.py]: APP_EDITION set to: BASIC
# or
# DEBUG [config.py]: APP_EDITION set to: ENT
```

---

## Production Deployment

For production Azure deployments:
- **Basic tier**: Uses `ARMtemplate/catalog/mainTemplate.json`
- **Enterprise tier**: Uses `ARMtemplate/catalog/mainTemplate_enterprise.json`

The ARM templates automatically set `APP_EDITION` to the appropriate value.
