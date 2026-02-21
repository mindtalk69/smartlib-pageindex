# CLAUDE.md

SmartLib BASIC Edition - RAG application with sqlite-vec vector storage.

## Stack
- **Backend**: Flask + SQLAlchemy (SQLite)
- **Agent**: LangChain + LangGraph
- **Vector Store**: sqlite-vec (embedded in SQLite)
- **Embeddings**: Qwen3-Embedding-0.6B (API)
- **Task Queue**: Celery + Redis
- **Document Processing**: Docling + RapidOCR

## Architecture
```
┌─────────┐     ┌────────┐     ┌──────────┐
│   Web   │────▶│ Redis  │◀────│  Worker  │
│ (Flask) │     │ (Broker)│    │ (Celery) │
└────┬────┘     └────────┘     └────┬─────┘
     │                               │
     └───────────┬───────────────────┘
                 ▼
          ┌─────────────┐
          │ SQLite DB   │
          │ + sqlite-vec│
          └─────────────┘
```

## Quick Start
```bash
# Install
pip install -r requirements-web.txt      # Web container
pip install -r requirements-worker.txt   # Worker container

# Run local
docker compose up --build

# Or Flask dev
flask run --debug
```

## Key Modules
| File | Purpose |
|------|---------|
| `modules/database.py` | SQLAlchemy models |
| `modules/agent.py` | LangGraph agent |
| `modules/vector_store_utils.py` | sqlite-vec storage |
| `modules/upload_processing.py` | Document ingestion |
| `modules/celery_tasks.py` | Background tasks |

## Config
- `APP_EDITION=BASIC` (default)
- `VECTOR_STORE_PROVIDER=sqlite-vec`
- `SQLITE_VECTOR_TABLE_NAME=document_vectors`
- `DEFAULT_EMBEDDING_MODEL=Qwen3-Embedding-0.6B`

## Vector Storage
Vectors stored directly in SQLite via sqlite-vec:
- No separate ChromaDB directories
- No PostgreSQL/PGVector needed
- Single `app.db` file contains all data

---
*Last updated: 2026-02-21 - sqlite-vec migration complete*
