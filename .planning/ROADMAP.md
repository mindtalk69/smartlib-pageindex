# Roadmap: SmartLib BASIC FastAPI Migration

**Created:** 2026-02-24
**Goal:** Migrate from Flask to FastAPI while maintaining production availability

---

## Phase 1: API Foundation ✓ COMPLETE

**Goal:** Analyze Flask endpoints and create FastAPI equivalents with CRUD API, authentication, and admin API

**Status:** COMPLETE (2026-02-25)

**Requirements:** API-01, API-02, API-03, API-04, API-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ADM-01, ADM-02

**Success Criteria:**
1. Flask endpoints analyzed and documented (app.py, main.py) ✓
2. All 11 SQLModel models have working CRUD endpoints at /api/v1/* ✓
3. OpenAPI docs at /docs show all endpoints with request/response schemas ✓
4. JWT authentication protects all protected endpoints ✓
5. Admin API endpoints ready for custom React admin frontend ✓
6. CORS configured for frontend domains ✓
7. Pagination working on all list endpoints ✓

**Depends on:** None (foundation phase)

**Key First Step:** Analyze Flask `app.py` routes to create compatible FastAPI endpoints

**Artifacts:**
- `modules/auth.py` - JWT authentication utilities
- `schemas.py` - Pydantic auth schemas
- `modules/crud_router.py` - Generic CRUD router with auth
- `main_fastapi.py` - FastAPI app with all endpoints
- Verification: `.planning/phases/01-api-foundation/01-api-foundation-VERIFICATION.md`

---

## Phase 2: Frontend - User App (/app)

**Goal:** Migrate existing React /app from Flask to FastAPI backend with gradual transition

**Requirements:** AUTH-06, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, FEA-01, FEA-02, FEA-03, FEA-04, FEA-05

**Success Criteria:**
1. Existing /app React frontend continues working with Flask (no breaking changes)
2. FastAPI endpoints compatible with existing /app API contracts
3. User can register/login via FastAPI from React app
4. User can upload documents with progress indicator
5. User can create/manage Libraries and Knowledges
6. Upload triggers Celery tasks for OCR and vector generation
7. User can view uploaded files list with metadata
8. User can delete their files
9. RAG chat interface displays conversation history
10. Password reset flow works via email
11. Nginx can route /app API calls to Flask (default) or FastAPI (feature flag)

**Depends on:** Phase 1 (API Foundation)

**Migration Strategy:**
- Keep /app calling Flask initially (proven working)
- Add feature flag to switch API base URL to FastAPI
- Test each endpoint with subset of users before full switchover

---

## Phase 3: Admin Frontend

**Goal:** Build custom React admin frontend to replace SQLAdmin

**Requirements:** ADM-03, ADM-04, ADM-05, FEA-06, FEA-07, FEA-08

**Success Criteria:**
1. Admin can view system statistics dashboard
2. Admin can manage LLM providers (add, edit, activate/deactivate)
3. Admin can manage model configurations
4. Admin can manage users (enable/disable, set roles)
5. Sensitive fields (API keys) masked in UI
6. Admin authentication required for /admin-app routes

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

**Goal:** Nginx routing for Flask/FastAPI coexistence and gradual /app migration

**Requirements:** COX-01, COX-02, COX-03, COX-04, COX-05, COX-06

**Success Criteria:**
1. Nginx routes /api/v1/* to FastAPI (port 8001)
2. Nginx routes /admin-app to React admin build
3. Nginx routes /app to React build (user frontend)
4. /app React app initially calls Flask (existing, proven)
5. Feature flag enables switching /app API calls to FastAPI
6. Both apps share SQLite database without conflicts
7. Gradual migration: switch /app endpoints from Flask → FastAPI one at a time
8. Flask can be safely deprecated when all endpoints migrated

**Depends on:** Phase 2 (User App working), Phase 4 (RAG working)

---

## Phase Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1 | API-01-05, AUTH-01-05, ADM-01-02 | 12 |
| 2 | AUTH-06, DOC-01-07, FEA-01-05 | 13 |
| 3 | ADM-03-05, FEA-06-10 | 8 |
| 4 | VEC-01-04, RAG-01-04 | 8 |
| 5 | COX-01-06 | 6 |
| **Total** | | **47** |

**Coverage Validation:**
- Total v1 requirements: 47
- Mapped to phases: 47
- Unmapped: 0 ✓

---
*Last updated: 2026-02-24 after initial roadmap creation*
