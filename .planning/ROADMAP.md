# Roadmap: SmartLib BASIC FastAPI Migration

**Created:** 2026-02-24
**Goal:** Migrate from Flask to FastAPI while maintaining production availability

---

## Phase 1: API Foundation

**Goal:** Complete FastAPI backend with CRUD API, authentication, and SQLAdmin dashboard

**Requirements:** API-01, API-02, API-03, API-04, API-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ADM-01, ADM-02

**Success Criteria:**
1. All 11 SQLModel models have working CRUD endpoints at /api/v1/*
2. OpenAPI docs at /docs show all endpoints with request/response schemas
3. JWT authentication protects all protected endpoints
4. SQLAdmin dashboard accessible at /admin with user management
5. CORS configured for frontend domains
6. Pagination working on all list endpoints

**Depends on:** None (foundation phase)

---

## Phase 2: Frontend - User App

**Goal:** Connect React user frontend to FastAPI backend with full document management

**Requirements:** AUTH-06, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, FEA-01, FEA-02, FEA-03, FEA-04, FEA-05

**Success Criteria:**
1. User can register/login via FastAPI from React app
2. User can upload documents with progress indicator
3. User can create/manage Libraries and Knowledges
4. Upload triggers Celery tasks for OCR and vector generation
5. User can view uploaded files list with metadata
6. User can delete their files
7. RAG chat interface displays conversation history
8. Password reset flow works via email

**Depends on:** Phase 1 (API Foundation)

---

## Phase 3: Admin Dashboard

**Goal:** Complete SQLAdmin customization and admin-only features

**Requirements:** ADM-03, ADM-04, ADM-05

**Success Criteria:**
1. Admin can view system statistics in SQLAdmin
2. Admin can manage LLM providers (add, edit, activate/deactivate)
3. Admin can manage model configurations
4. Sensitive fields (API keys) hidden/masked in admin UI
5. Admin authentication required for /admin routes

**Depends on:** Phase 1 (API Foundation)

---

## Phase 4: RAG Integration

**Goal:** Migrate RAG chat functionality from Flask to FastAPI

**Requirements:** VEC-01, VEC-02, VEC-03, VEC-04, RAG-01, RAG-02, RAG-03, RAG-04

**Success Criteria:**
1. User can ask questions about uploaded documents
2. Answers include citations linking to source documents
3. Conversation threads saved and retrievable
4. Suggested follow-up questions displayed
5. Vector similarity search returns relevant results
6. Search respects Library/Knowledge filters
7. LangGraph agent integrated with FastAPI

**Depends on:** Phase 1 (API Foundation), Phase 2 (document upload working)

---

## Phase 5: Coexistence & Migration

**Goal:** Nginx routing for Flask/FastAPI coexistence and migration path

**Requirements:** COX-01, COX-02, COX-03, COX-04, COX-05

**Success Criteria:**
1. Nginx routes /api/v1/* to FastAPI (port 8001)
2. Nginx routes /admin to SQLAdmin (FastAPI)
3. Nginx routes /app to React build
4. Nginx routes /admin-app to admin React build
5. Legacy routes fall back to Flask (port 5000)
6. Both apps share SQLite database without conflicts
7. Flask can be safely deprecated when ready

**Depends on:** Phase 2 (User App working), Phase 4 (RAG working)

---

## Phase Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1 | API-01-05, AUTH-01-05, ADM-01-02 | 12 |
| 2 | AUTH-06, DOC-01-07, FEA-01-05 | 13 |
| 3 | ADM-03-05 | 3 |
| 4 | VEC-01-04, RAG-01-04 | 8 |
| 5 | COX-01-05 | 5 |
| **Total** | | **41** |

**Coverage Validation:**
- Total v1 requirements: 42
- Mapped to phases: 41
- Unmapped: 1 (API-05 was counted, should be 42 total)

---
*Last updated: 2026-02-24 after initial roadmap creation*
