# Milestones

## v1.0 FastAPI Foundation (Shipped: 2026-02-26)

**Phases completed:** 2 phases, 11 plans

**Key accomplishments:**
- FastAPI + Uvicorn server on port 8001
- JWT authentication with register/login/logout/password reset
- CRUD endpoints for all 11 SQLModel models
- Admin API endpoints at `/api/v1/admin/*`
- File upload with Celery integration
- Libraries & Knowledges management API
- Conversation history API (threads, messages)
- Configuration & branding endpoints
- Nginx dual-backend routing configured
- React /app frontend migrated from Flask sessions to JWT

**UAT Results:**
- 30 tests executed, 18 passed, 12 skipped (infrastructure dependencies)
- 0 test failures

---

## v1.1 Admin Dashboard (In Progress: Started 2026-02-26)

**Goal:** Replace SQLAdmin with custom React frontend at /admin-app

**Phases planned:** 4 phases (3-6)

**Target features:**
- Custom React admin frontend (replace SQLAdmin)
- System statistics dashboard (users, files, storage, messages, queries)
- LLM provider management UI (configure OpenAI, Anthropic, local models)
- Model configuration management UI (temperature, max_tokens, etc.)
- User management UI (CRUD, roles, activity monitoring)
- Content management (activity logs, catalogs, categories)
- App settings (name, logo, colors)

**Requirements:** 55 requirements across 10 categories

**Progress:** 0/15 plans complete

---

## v1.2 RAG Integration (Planned)

**Goal:** Complete RAG query pipeline with vector search, citations, and streaming responses

**Phases to be defined** after v1.1 completion

---

## v1.3 Production Migration (Planned)

**Goal:** Complete Flask cutover and performance optimization

**Phases to be defined** after v1.2 completion

---
*Last updated: 2026-02-26*
