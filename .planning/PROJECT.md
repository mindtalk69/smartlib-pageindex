# SmartLib BASIC - FastAPI Migration

## What This Is

SmartLib BASIC is a RAG (Retrieval-Augmented Generation) application for document management and intelligent Q&A. It allows users to upload documents, extract knowledge via OCR, store vectors in SQLite using sqlite-vec, and chat with documents using LLMs. The project is migrating from Flask to FastAPI for better production performance while keeping the existing Flask app running during transition.

## Current State

**Shipped v1.1 (2026-02-27): Admin Dashboard**
- ✅ Custom React admin frontend at /admin-app
- ✅ Admin dashboard with statistics charts (user/file/message counts, distribution charts)
- ✅ LLM provider management UI (CRUD, health check, model discovery, priority ordering)
- ✅ Model configuration management UI (list/add/edit/delete, set default/multimodal, validate deployment)
- ✅ Language management UI (list/add/edit/delete, toggle active)
- ✅ User management UI (list, search, toggle admin/active, delete)
- ✅ Password reset request management (approve/deny with temp password generation)
- ✅ Activity log endpoints (upload/download with filtering)
- ✅ File management endpoints (details, deletion with vector cleanup)
- ✅ Catalog & Category CRUD operations
- ✅ Application settings (view/edit with persistence)
- ✅ 33 FastAPI admin endpoints for all management operations

**Shipped v1.0 (2026-02-26): FastAPI Foundation**
- ✅ JWT authentication system with FastAPI
- ✅ FastAPI server running on port 8001
- ✅ CRUD endpoints for all 11 SQLModel models
- ✅ Admin API endpoints at `/api/v1/admin/*`
- ✅ User registration, login, logout, password reset endpoints
- ✅ File upload endpoint with progress tracking
- ✅ Libraries & Knowledges management endpoints
- ✅ Conversation threads and message history endpoints
- ✅ Configuration and branding endpoints
- ✅ Nginx dual-backend routing configured
- ✅ UAT verified: 18/30 tests passed, 0 failures

**Technical Stack:**
- FastAPI + Uvicorn (port 8001)
- Flask (port 8000) - legacy backend
- SQLModel for database models
- SQLite with sqlite-vec extension
- Redis + Celery for async tasks
- React frontends (/app, /admin-app)
- shadcn/ui component library

**Milestone Stats (v1.1):**
- Phases: 7 (3-9)
- Plans: 30
- Feature commits: 70
- Timeline: 1 day (Feb 26-27, 2026)

## Future Milestones (v1.2+)

**RAG Integration:**
- FastAPI endpoints for RAG queries
- Vector similarity search via sqlite-vec
- Citation generation from source documents
- Suggested follow-up questions

**Production Migration:**
- Complete Flask cutover
- Performance optimization

## Core Value

Users can upload documents (including OCR processing), organize them into libraries/knowledges, and get intelligent answers to questions by querying document vectors via embedding-based retrieval.

## Requirements

### Validated

**v1.1 (Admin Dashboard):**
- ✓ Custom React admin frontend at /admin-app with shadcn/ui
- ✓ Admin dashboard with statistics charts (Recharts)
- ✓ LLM provider management UI (full CRUD + health monitoring)
- ✓ Model configuration management UI (full CRUD + validation)
- ✓ Language management UI (full CRUD)
- ✓ User management UI (list, search, toggle admin/active, delete)
- ✓ Password reset request management (approve/deny)
- ✓ Dark/light theme toggle with persistence
- ✓ 33 FastAPI admin endpoints for all management operations

**v1.0 (FastAPI Foundation):**
- ✓ JWT authentication system with register/login/logout/password reset
- ✓ FastAPI CRUD endpoints for all models
- ✓ OpenAPI documentation at `/docs`
- ✓ Admin API endpoints for user management
- ✓ File upload endpoint with Celery integration
- ✓ Libraries & Knowledges management API
- ✓ Conversation history API (threads, messages)
- ✓ Configuration & branding endpoints
- ✓ Nginx dual-backend routing

### Active (v1.2 - RAG Integration)

- [ ] RAG query endpoint with streaming SSE
- [ ] Vector similarity search via sqlite-vec
- [ ] Citation generation in RAG responses
- [ ] Suggested follow-up questions

### Deferred (v1.3+ - Production Migration)

- [ ] Complete Flask cutover
- [ ] Performance optimization
- [ ] Production hardening

### Out of Scope

- ~~Switching to PostgreSQL/PGVector~~ — sqlite-vec in SQLite is the chosen architecture
- ~~Replacing Celery with other task queues~~ — Existing Celery + Redis works well
- ~~Rewriting document processing pipeline~~ — Docling + RapidOCR pipeline stays

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
| JWT Authentication | Stateless tokens, easier scaling, no CSRF complexity | ✓ Good — v1.0 delivered |
| Nginx Dual-Backend Routing | Path-based routing allows gradual transition, zero downtime | ✓ Good — v1.0 delivered |
| Hard Cut to JWT | Faster migration, cleaner codebase vs dual-auth complexity | ✓ Good — v1.0 delivered |
| Custom React Admin Frontend | Replace SQLAdmin with polished custom UI for better UX | ✓ Good — v1.1 delivered, shadcn/ui excellent |
| FastAPI + Uvicorn | Async support, auto-generated OpenAPI docs, better production performance | ✓ Driver for migration |
| CRUDRouter Pattern | Standardized API endpoints for all models | ✓ Implemented |

---
*Last updated: 2026-02-27 after v1.1 Admin Dashboard milestone*
