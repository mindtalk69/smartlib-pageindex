# Requirements: SmartLib BASIC FastAPI Migration

**Defined:** 2026-02-24
**Core Value:** Users can upload documents, organize them into libraries/knowledges, and get intelligent answers to questions by querying document vectors via embedding-based retrieval.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can register with email and password
- [ ] **AUTH-02**: User can log in and receive JWT token
- [ ] **AUTH-03**: User can log out (invalidate token)
- [ ] **AUTH-04**: User session persists across page refresh
- [ ] **AUTH-05**: Admin users can manage other users (enable/disable, set roles)
- [ ] **AUTH-06**: Password reset via email link

### Document Management

- [ ] **DOC-01**: User can upload documents (PDF, images, Office formats)
- [ ] **DOC-02**: User can organize documents into Libraries
- [ ] **DOC-03**: User can organize documents into Knowledges (product-specific)
- [ ] **DOC-04**: User can view list of uploaded files with metadata
- [ ] **DOC-05**: User can delete their uploaded files
- [ ] **DOC-06**: Upload triggers async OCR processing (for images)
- [ ] **DOC-07**: Upload triggers async vector generation

### Vector Storage & Retrieval

- [ ] **VEC-01**: Vectors automatically generated from uploaded documents
- [ ] **VEC-02**: Similarity search returns relevant document chunks
- [ ] **VEC-03**: Search can be filtered by Library
- [ ] **VEC-04**: Search can be filtered by Knowledge

### RAG Q&A

- [ ] **RAG-01**: User can ask questions about uploaded documents
- [ ] **RAG-02**: Answers include citations to source documents
- [ ] **RAG-03**: Conversation history is saved per thread
- [ ] **RAG-04**: Suggested follow-up questions shown after answer

### Admin Dashboard

- [ ] **ADM-01**: Admin can view all users in SQLAdmin
- [ ] **ADM-02**: Admin can set user roles (admin/regular)
- [ ] **ADM-03**: Admin can view system statistics
- [ ] **ADM-04**: Admin can manage LLM providers
- [ ] **ADM-05**: Admin can manage model configurations

### API Foundation

- [ ] **API-01**: All models have CRUD endpoints via CRUDRouter
- [ ] **API-02**: OpenAPI documentation available at /docs
- [ ] **API-03**: Authentication middleware protects protected endpoints
- [ ] **API-04**: CORS configured for frontend domains
- [ ] **API-05**: Pagination on list endpoints

### Frontend - User App (/app)

- [ ] **FEA-01**: React app connects to FastAPI backend
- [ ] **FEA-02**: Document upload UI with progress indicator
- [ ] **FEA-03**: Library/Knowledge management UI
- [ ] **FEA-04**: RAG chat interface with streaming responses
- [ ] **FEA-05**: Conversation history view

### Coexistence

- [ ] **COX-01**: Nginx routes /api/v1/* to FastAPI
- [ ] **COX-02**: Nginx routes /admin to SQLAdmin
- [ ] **COX-03**: Nginx routes /app to React build
- [ ] **COX-04**: Flask remains functional for legacy routes
- [ ] **COX-05**: Both apps share same SQLite database safely

---

## v2 Requirements

### Advanced Features

- **ADV-01**: Multi-language support for Q&A (LLM Languages)
- **ADV-02**: Custom prompts for RAG behavior (LLM Prompts)
- **ADV-03**: Multiple embedding model support per Knowledge
- **ADV-04**: Export conversation history to PDF/text

### User Experience

- **UX-01**: Real-time upload progress via WebSocket/SSE
- **UX-02**: Advanced search (date range, file type filters)
- **UX-03**: Bulk document operations

### Moderation

- **MOD-01**: Admin can view reported content
- **MOD-02**: Admin can remove documents
- **MOD-03**: Usage analytics dashboard

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| OAuth login (Google, GitHub) | Email/password sufficient for v1, add later |
| PostgreSQL/PGVector migration | sqlite-vec works well, no need to change |
| Real-time chat | High complexity, not core to RAG value |
| Video/audio uploads | Storage/bandwidth costs, defer to future |
| Mobile native apps | Web-first, responsive design sufficient |
| Advanced analytics | Nice-to-have, not core value |
| Custom admin React frontend | SQLAdmin provides instant CRUD, skip custom work |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 2 | Pending |
| DOC-01 | Phase 2 | Pending |
| DOC-02 | Phase 2 | Pending |
| DOC-03 | Phase 2 | Pending |
| DOC-04 | Phase 2 | Pending |
| DOC-05 | Phase 2 | Pending |
| DOC-06 | Phase 2 | Pending |
| DOC-07 | Phase 2 | Pending |
| VEC-01 | Phase 4 | Pending |
| VEC-02 | Phase 4 | Pending |
| VEC-03 | Phase 4 | Pending |
| VEC-04 | Phase 4 | Pending |
| RAG-01 | Phase 4 | Pending |
| RAG-02 | Phase 4 | Pending |
| RAG-03 | Phase 4 | Pending |
| RAG-04 | Phase 4 | Pending |
| ADM-01 | Phase 1 | Pending |
| ADM-02 | Phase 1 | Pending |
| ADM-03 | Phase 3 | Pending |
| ADM-04 | Phase 3 | Pending |
| ADM-05 | Phase 3 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 1 | Pending |
| API-05 | Phase 1 | Pending |
| FEA-01 | Phase 2 | Pending |
| FEA-02 | Phase 2 | Pending |
| FEA-03 | Phase 2 | Pending |
| FEA-04 | Phase 2 | Pending |
| FEA-05 | Phase 2 | Pending |
| COX-01 | Phase 5 | Pending |
| COX-02 | Phase 5 | Pending |
| COX-03 | Phase 5 | Pending |
| COX-04 | Phase 5 | Pending |
| COX-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
