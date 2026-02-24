# SmartLib BASIC - FastAPI Migration

## What This Is

SmartLib BASIC is a RAG (Retrieval-Augmented Generation) application for document management and intelligent Q&A. It allows users to upload documents, extract knowledge via OCR, store vectors in SQLite using sqlite-vec, and chat with documents using LLMs. The project is migrating from Flask to FastAPI for better production performance while keeping the existing Flask app running during transition.

## Core Value

Users can upload documents (including OCR processing), organize them into libraries/knowledges, and get intelligent answers to questions by querying document vectors via embedding-based retrieval.

## Requirements

### Validated

- ✓ Flask backend with SQLAlchemy models - existing production code
- ✓ sqlite-vec vector storage in SQLite - existing
- ✓ Document upload with OCR support (Docling + RapidOCR) - existing
- ✓ LangChain/LangGraph agent for RAG queries - existing
- ✓ Celery + Redis task queue for background processing - existing
- ✓ SQLModel models for FastAPI - partial migration complete
- ✓ SQLAdmin dashboard at /admin - partial migration complete
- ✓ FastAPI CRUD API endpoints - partial migration complete

### Active

- [ ] Complete FastAPI API layer to serve frontend (/app and /admin-app)
- [ ] Migrate all Flask routes to FastAPI endpoints
- [ ] Ensure both Flask and FastAPI can coexist during migration
- [ ] Frontend React app (/app) - user-facing interface
- [ ] Frontend React admin-app (/admin-app) - admin interface
- [ ] Maintain sqlite-vec vector storage compatibility
- [ ] Preserve Celery worker integration for document processing
- [ ] Migrate authentication/authorization from Flask to FastAPI

### Out of Scope

- ~~Switching to PostgreSQL/PGVector~~ — sqlite-vec in SQLite is the chosen architecture
- ~~Replacing Celery with other task queues~~ — Existing Celery + Redis works well
- ~~Rewriting document processing pipeline~~ — Docling + RapidOCR pipeline stays

## Context

**Current State:**
- Brownfield project with production Flask app (app.py, main.py)
- Partial FastAPI migration exists (main_fastapi.py, database_fastapi.py, modules/models.py with SQLModel)
- SQLAdmin dashboard partially configured for all models
- CRUD router exists for API endpoints
- Existing documentation from prior Gemini sessions describes "Turbo" migration approach

**Technical Environment:**
- Docker Compose deployment (multiple configurations: GPU, CPU, single, prod)
- Python 3.x with SQLAlchemy, SQLModel, FastAPI, Flask
- React frontends (frontend/ for /app, admin-frontend/ for /admin-app)
- SQLite with sqlite-vec extension for vector storage
- Redis broker for Celery workers

**Prior Work:**
- Implementation plan from Gemini session: FastAPI + SQLModel + SQLAdmin "Turbo" approach
- SQLModel models created for: User, Group, Library, Knowledge, UploadedFile, MessageHistory, LLMProvider, ModelConfig, AppSettings, LLMPrompt, LLMLanguage
- Admin views configured for all models
- CRUD API router module created

## Constraints

- **Coexistence**: Flask must remain operational during migration - cannot break existing app
- **SQLite Only**: Must maintain sqlite-vec compatibility, no PostgreSQL migration
- **Production Ready**: Performance was the driver for migration - Flask too slow in production
- **Frontend Separation**: Two distinct frontends - /app (user) and /admin-app (admin)
- **Minimal Disruption**: Existing production code should be reused where possible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SQLModel for models | Unify SQLAlchemy models with Pydantic schemas, eliminate code duplication | ✓ Good — already implemented |
| SQLAdmin for admin UI | Instant CRUD admin interface, reduces custom admin frontend work | ✓ Good — partially configured |
| FastAPI + Uvicorn | Async support, auto-generated OpenAPI docs, better production performance | ✓ Good — driver for migration |
| Keep Flask during migration | Production cannot go down, gradual migration safer | — Pending |
| CRUDRouter pattern | Standardized API endpoints for all models | — Pending completion |

---
*Last updated: 2026-02-24 after GSD project initialization*
