# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartLib is a Retrieval-Augmented Generation (RAG) application built with Flask, designed for enterprise document processing and intelligent question answering. The application uses LangChain/LangGraph for agent workflows, Docling and Azure Document Intelligence for document processing, and supports both ChromaDB and PGVector for vector storage.

## Architecture

### Multi-Container Architecture
- **Web Container**: Flask application with Gunicorn, handles HTTP requests and user interactions
- **Worker Container**: Celery worker for background processing (document ingestion, embeddings, agent tasks)
- **Redis**: Message broker for Celery task queue and streaming bus
- **Database**: SQLite (Basic tier) or PostgreSQL (Enterprise tier with pgvector extension)

### Key Technologies
- **Backend**: Python 3.11+ with Flask
- **Agent Framework**: LangChain + LangGraph for conversational agents
- **Document Processing**: Docling, Azure Document Intelligence (OCR)
- **Vector Stores**: ChromaDB (local), PGVector (enterprise)
- **Task Queue**: Celery with Redis broker
- **Frontend**: Vite for asset bundling, vanilla JavaScript
- **Database ORM**: SQLAlchemy with Flask-Migrate (Alembic)

### Module Organization

The `modules/` directory contains the core application logic:

- **database.py**: SQLAlchemy models (User, Knowledge, Library, Catalog, MessageHistory, VectorReference, etc.)
- **agent.py**: LangGraph-based conversational agent with tool calling, human-in-the-loop confirmation, and memory management
- **query.py**: Query endpoints, streaming responses, evidence rendering (bounding boxes, visual grounding)
- **upload.py** & **upload_processing.py**: File upload handling and document processing pipeline
- **vector_store_utils.py**: Vector store abstraction for ChromaDB/PGVector
- **llm_utils.py**: LLM provider abstraction, embedding functions, prompt management
- **admin*.py**: Admin interface modules (users, files, knowledges, libraries, catalogs, models, embeddings)
- **celery_tasks.py**: Celery task definitions for offloading agent invocations and vector operations
- **selfquery.py**: Self-query retriever for metadata filtering
- **dataframe_agent.py**: Pandas DataFrame agent for data analysis
- **callbacks.py**: LangChain callbacks for usage tracking
- **access_control.py**: Group-based access control for knowledge bases

## Common Development Commands

### Environment Setup
```bash
# Create virtual environment (Python 3.11+ recommended)
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements-dev.txt  # Full dev environment
pip install -r requirements-web.txt  # Web container only
pip install -r requirements-worker.txt  # Worker container only
```

### Running the Application

**Local Development (Flask dev server)**:
```bash
# Load environment variables from .env.dev
export FLASK_APP=app.py
export FLASK_ENV=development
flask run --debug
```

**Docker Compose (Recommended for local testing)**:
```bash
# Build and start all services (web, worker, redis)
docker compose up --build

# Stop services
docker compose down

# View logs
docker compose logs -f web
docker compose logs -f worker
```

**Rebuild Docker Images**:
```bash
./rebuild-micro.sh       # Minimal image (~1GB, no local embeddings)
./rebuild-flask.sh       # Full featured build
./rebuild-minimal.sh     # Minimal with basic dependencies
```

### Database Migrations

```bash
# Create a new migration after model changes
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Verify migrations (custom script)
./verify_migrations.sh
```

### Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_query_resume.py

# Run specific test class or method
pytest tests/test_query_resume.py::TestClassName::test_method_name

# Run tests matching keyword
pytest -k "keyword"
```

### Frontend Asset Building

```bash
# Development build with hot reload
npm run dev

# Production build
npm run build

# Production build with source maps (debug)
npm run build:debug
```

### Code Quality

```bash
# Format code
black .
isort .

# Lint
flake8

# All three before commits
black . && isort . && flake8
```

## Configuration

Configuration is managed through environment variables, loaded from `.env.dev` (development) or Azure App Settings (production).

**Key Configuration Classes** (config.py):
- `Config`: Base configuration with environment variable loading
- `DevelopmentConfig`: Development-specific settings (DEBUG=True, SQLALCHEMY_ECHO)
- `ProductionConfig`: Production settings (DEBUG=False, stricter logging)

**Critical Environment Variables**:
- `VECTOR_STORE_PROVIDER`: `chromadb` or `pgvector`
- `SQLALCHEMY_DATABASE_URI`: Database connection string
- `CELERY_BROKER_URL`: Redis URL for Celery tasks
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`: Azure OpenAI credentials
- `DATA_VOLUME_PATH`: Shared data directory for uploads, logs, vector stores
- `VECTOR_STORE_MODE`: `knowledge` (per-knowledge isolation) or other modes

## Agent System Architecture

The agent system (`modules/agent.py`) uses LangGraph for state management and tool orchestration:

### Agent Flow
1. **User Input** → Parsed and added to conversation state
2. **Self-Query Retrieval** → Metadata filtering + similarity search
3. **Tool Selection** → Agent decides which tools to invoke (search, maps, pandas, web)
4. **Human-in-Loop** → Confirmation prompt for certain actions
5. **Tool Execution** → Tools run and return results
6. **Response Generation** → LLM synthesizes final answer with citations
7. **Streaming** → Response streamed via SSE to frontend

### Key Agent Tools
- **retrieval_tool**: Vector store similarity search with metadata filtering
- **GoogleSerperResults**: Web search
- **folium map tools**: Geospatial visualization
- **pandas_repl_tool**: DataFrame operations for data analysis
- **visual_grounding_tool**: Image bounding box rendering

### Agent Checkpointing
- Uses `MemorySaver` for conversation persistence
- Thread-based isolation per conversation
- Resume capability for interrupted agent workflows

## Database Schema Highlights

**Core Models**:
- `User`: Authentication (local or Azure), admin/disabled flags
- `Knowledge`: Document collections with access control (groups, libraries, catalogs)
- `Library`: Organizational unit for grouping documents
- `Catalog`: Marketplace-style categorization
- `UploadedFile`: Tracks uploaded files with metadata
- `VectorReference`: Maps chunks to source files (logged to files, not DB in some modes)
- `MessageHistory`: Conversation threads with citations and usage metadata
- `Document`: Docling document metadata (JSON path, visual grounding)

**Many-to-Many Relationships**:
- Knowledge ↔ Catalogs (knowledge_catalogs_table)
- Knowledge ↔ Categories (knowledge_category_association)
- Knowledge ↔ Libraries (knowledge_libraries_association)
- Knowledge ↔ Groups (knowledge_groups_association)
- User ↔ Groups (user_groups)

## Deployment

### Local Docker Deployment
See `LOCAL_DOCKER_SETUP_SUMMARY.md` for detailed Docker Compose setup and testing instructions.

### Azure Deployment
ARM templates in `ARMtemplate/` directory:
- `flask_appservice_template_shared_plan.json`: Shared App Service Plan (~30% cost savings)
- `docs/`: Deployment documentation and quick start guides

**Azure Resources Created**:
- App Service Plan (Shared or dedicated)
- Web App Service (web container)
- Web App Service (worker container)
- Redis Cache
- Storage Account (document storage)
- Key Vault (secrets management)
- PostgreSQL Server (Enterprise tier only)

## Vector Store Modes

### ChromaDB Mode (Default for Basic tier)
- Local disk-based storage under `DATA_VOLUME_PATH/chroma/`
- Collection name: `documents-vectors` (configurable via `CHROMA_COLLECTION_NAME`)
- Per-knowledge isolation when `VECTOR_STORE_MODE=knowledge`

### PGVector Mode (Enterprise tier)
- PostgreSQL extension for vector similarity
- Collection name: `documents_vectors` (configurable via `PGVECTOR_COLLECTION_NAME`)
- Shared connection pool via `PGVECTOR_CONNECTION_STRING`

## Important Implementation Details

### Document Processing Pipeline
1. File uploaded via `modules/upload.py` → saved to `DATA_VOLUME_PATH/tmp_uploads/`
2. Celery task `process_uploaded_file_task` triggered
3. Document parsed with Docling (OCR if enabled)
4. Text chunked using LangChain splitters
5. Embeddings generated (Azure OpenAI or local models)
6. Chunks stored in vector database
7. Metadata logged to `VectorReference` (or log files in micro mode)

### Streaming SSE Responses
- Agent responses streamed via Server-Sent Events (SSE)
- Redis-backed streaming bus for worker-to-web communication
- Format: `data: {"type": "token"|"citations"|"metadata"|"error", ...}\n\n`
- Heartbeat mechanism to keep connections alive

### Access Control
- Group-based permissions for Knowledge resources
- Admin users bypass access checks
- Helpers in `modules/access_control.py`: `filter_accessible_knowledges`, `knowledge_is_accessible`

### Multiprocessing Safeguards
- `app.py` sets spawn method early to avoid semaphore leaks
- Graceful shutdown handlers for pools and managers
- Resource cleanup on SIGINT/SIGTERM

## Coding Standards

- **Line Length**: ≤88 characters (Black default)
- **Import Order**: stdlib → third-party → local (isort with Black profile)
- **Naming**:
  - snake_case: modules, functions, variables
  - PascalCase: classes, exceptions
  - UPPER_SNAKE_CASE: constants
- **Type Hints**: Preferred across modules; use `typing` and `pydantic` models
- **Docstrings**: Required for public functions/classes (purpose, params, errors)
- **Error Handling**: Structured exceptions, logging with context, meaningful Flask responses
- **No Secrets in Code**: Use `.env.dev` or Azure Key Vault references

## Troubleshooting

### Common Issues

**Celery tasks not running**:
- Check Redis connectivity: `docker exec -it <redis_container> redis-cli ping`
- Verify worker logs: `docker logs <worker_container>`
- Ensure `CELERY_BROKER_URL` matches Redis service name in docker-compose

**Vector store errors**:
- Check `VECTOR_STORE_PROVIDER` setting
- Verify embedding model is accessible (Azure OpenAI key or local model downloaded)
- Inspect logs in `DATA_VOLUME_PATH/logs/smartlib.log`

**Database migration conflicts**:
- Run `./verify_migrations.sh` after pulling changes
- Check for manual edits in migration files
- Rebuild from scratch: `rm -rf migrations/versions/* && flask db migrate`

**Frontend assets not loading**:
- Run `npm run build` to regenerate Vite manifest
- Check `static/dist/manifest.json` exists
- Verify Flask template references match manifest entries

### Logs

- **Application logs**: `DATA_VOLUME_PATH/logs/smartlib.log`
- **Vector references**: `DATA_VOLUME_PATH/logs/vector_references_YYYY-MM-DD.log`
- **Docker logs**: `docker logs <container_name>`
- **Celery worker**: Check container logs for task execution details

## Reference Documentation

- **AGENTS.md**: Detailed agent reorganization plan and coding standards
- **LOCAL_DOCKER_SETUP_SUMMARY.md**: Docker Compose setup and testing
- **ARMtemplate/docs/**: Azure deployment guides
- **README.md**: High-level project overview and quick start

## Daily latest development progress (Please to Read On)
smartlib/docs/dev_progress_log.md

## based on APP_EDITION

# APP_EDITION = "basic"

### build for azure basic
build-for-azure-basic.sh

### ARM Template:
ARMtemplate/catalogs/createUIDefinition.json
ARMtemplate/catalogs/mainTemplate.json 


# APP_EDITION = "enterprise"

### build for azure enterprise
build-for-azure-enterprise.sh

### ARM Template:
ARMtemplate/catalogs/createUIDefinition_enterprise.json
ARMtemplate/catalogs/mainTemplate_enterprise.json 

