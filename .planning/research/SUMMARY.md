# Research Summary: SmartLib BASIC FastAPI Migration

## Stack Summary

**Backend:** FastAPI 0.115+ with Uvicorn, SQLModel 0.0.21+, SQLAdmin 0.18+
**Database:** SQLite + sqlite-vec (no PGVector needed)
**Frontend:** React 18.x + Vite + TanStack Query
**Infrastructure:** Docker, Redis, Celery (unchanged)

**Key Decision:** Keep Flask running during migration via Nginx reverse proxy routing:
- `/api/v1/*` → FastAPI
- `/admin/*` → SQLAdmin
- `/app/*`, `/admin-app/*` → React builds
- `/*` → Flask (legacy fallback)

---

## Table Stakes Features

**Authentication (4):** Registration, login/logout, roles, password reset

**Document Management (5):** Upload, organize in Libraries/Knowledges, view list, delete

**Vector Storage (3):** Auto-generation, similarity search, filtering

**RAG Q&A (4):** Questions, cited answers, conversation history, suggested questions

**Admin Dashboard (4):** User management, role management, stats, LLM config

---

## Architecture Highlights

**Component Boundaries:**
1. API Layer - FastAPI + CRUD routers
2. Admin Dashboard - SQLAdmin (instant CRUD UI)
3. User Frontend - React app at `/app`
4. Admin Frontend - React app at `/admin-app` (may be replaced by SQLAdmin)
5. Background Processing - Celery (unchanged)

**Build Order:**
1. API Foundation (CRUD + Auth)
2. Frontend - User App
3. Admin Dashboard
4. RAG Integration
5. Coexistence & Migration

---

## Critical Pitfalls to Avoid

1. **Breaking Flask during migration** - Keep shared models backward-compatible
2. **SQLite concurrency issues** - Use WAL mode, proper pooling
3. **Celery integration gaps** - Test end-to-end early
4. **SQLAdmin security gaps** - Add auth middleware, hide sensitive fields
5. **Frontend API mismatch** - Document in OpenAPI, test incrementally
6. **Vector storage compatibility** - Test in both sync/async contexts
7. **Skipping verification** - Phase gates with verifier agent

---

## Next Steps

Proceed to requirements definition based on this research.

---
*Last updated: 2026-02-24*
