# Roadmap: SmartLib BASIC FastAPI Migration

**Created:** 2026-02-24
**Goal:** Migrate from Flask to FastAPI while maintaining production availability

---

## Milestones

- ✅ **v1.0 FastAPI Foundation** — Phases 1-2 (shipped 2026-02-26)
- ✅ **v1.1 Admin Dashboard** — Phases 3-8 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 FastAPI Foundation (Phases 1-2) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: API Foundation (5 waves) — completed 2026-02-25
- [x] Phase 2: Frontend User App (6 waves + UAT) — completed 2026-02-26

**Delivered:**
- JWT authentication with FastAPI
- CRUD endpoints for all 11 models
- Admin API endpoints
- User registration, login, logout, password reset
- File upload with progress tracking
- Libraries & Knowledges management
- Conversation threads and message history
- Configuration and branding endpoints
- Nginx dual-backend routing
- **See:** [.planning/milestones/v1.0-FastAPI-Foundation-ROADMAP.md](.planning/milestones/v1.0-FastAPI-Foundation-ROADMAP.md)

</details>

### 🚧 v1.1 Admin Dashboard (In Progress)

**Milestone Goal:** Custom React admin frontend at /admin-app with system stats, user management, LLM configuration, and content management capabilities.

#### Phase 3: Frontend Infrastructure & Authentication
**Goal**: Admin app foundation with React setup, authentication flow, and UI framework
**Depends on**: Phase 2 (v1.0)
**Requirements**: FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Admin can access /admin-app and see authenticated dashboard layout with sidebar navigation
  2. Non-admin users are automatically redirected to /app with access denied message
  3. Admin can toggle between dark and light themes with preference persisted across sessions
  4. Admin can log out from any page and be redirected to login
**Plans**: 3

Plans:
- [x] 03-01: React app setup with shadcn/ui components - completed 2026-02-26
- [x] 03-02: Layout components (Sidebar, Header, ThemeToggle) - completed 2026-02-26
- [x] 03-03: Authentication integration with JWT validation - completed 2026-02-26

#### Phase 4: Dashboard & User Management (Frontend)
**Goal**: System statistics dashboard and user management frontend
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, USER-01, USER-02, USER-03
**Success Criteria** (what must be TRUE):
  1. Admin sees dashboard with stats cards (user/file/message counts) and interactive charts
  2. Admin can search and view users in a paginated list
  3. Dashboard charts display data from /api/v1/admin/stats
**Plans**: 8

Plans:
- [x] 04-01: Dashboard components (useDashboardData hook, StatCard, ChartSection) - completed 2026-02-27
- [x] 04-02: Dashboard integration (Dashboard page, UserStatsTable, UI components) - completed 2026-02-27
- [x] 04-03: User management list (useUsers hook, UserList table, UserDialog) - completed 2026-02-27
- [x] 04-GAP-01: Dashboard chart implementation (Recharts integration, 4 chart types) - completed 2026-02-27
- [x] 04-GAP-02: AdminLayout children prop fix - completed 2026-02-27
- [x] 04-GAP-03: UserList undefined props fix - completed 2026-02-27
- [x] 04-GAP-05: TypeScript type annotations for PasswordResetRequests - completed 2026-02-26

#### Phase 5: LLM, Model & Language Management (Frontend)
**Goal**: AI configuration interface for providers, models, and languages
**Depends on**: Phase 4
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08, MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05, MODEL-06, MODEL-07, LANG-01, LANG-02, LANG-03, LANG-04, LANG-05
**Success Criteria** (what must be TRUE):
  1. Admin can interact with LLM provider, model, and language management UI
  2. Frontend components are ready for backend integration
**Plans**: 4

Plans:
- [x] 05-01: LLM Provider management frontend - completed 2026-02-27
- [x] 05-02: Provider health monitoring UI - completed 2026-02-27
- [x] 05-03: Model configuration UI - completed 2026-02-27
- [x] 05-04: Language management UI - completed 2026-02-27

#### Phase 6: Backend User Action Endpoints (GAP CLOSURE)
**Goal**: Port Flask user management actions to FastAPI
**Depends on**: Phase 4, Phase 1
**Requirements**: USER-04, USER-05, USER-07, USER-08, USER-09, USER-10
**Success Criteria** (what must be TRUE):
  1. Admin can toggle admin status, active status, and delete users via custom React UI
  2. Admin can manage password reset requests (approve/deny) via FastAPI endpoints
  3. Pagination response format matches frontend expectations
**Plans**: TBD

#### Phase 7: Backend LLM Provider Endpoints (GAP CLOSURE)
**Goal**: Port Flask LLM provider endpoints to FastAPI
**Depends on**: Phase 5, Phase 1
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08
**Success Criteria** (what must be TRUE):
  1. Admin can manage LLM providers (CRUD) with functional test connection and model discovery
  2. Provider health status is correctly tracked and updated in the backend
**Plans**: 2

Plans:
- [x] 07-01: Provider CRUD endpoints (PROV-01 through PROV-04) - completed 2026-02-27
- [x] 07-02: Provider action endpoints (PROV-05 through PROV-08) - completed 2026-02-27

#### Phase 8: Backend LLM Model & Language Endpoints (GAP CLOSURE)
**Goal**: Port Flask model and language endpoints to FastAPI
**Depends on**: Phase 7, Phase 1
**Requirements**: MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05, MODEL-06, MODEL-07, LANG-01, LANG-02, LANG-03, LANG-04, LANG-05
**Success Criteria** (what must be TRUE):
  1. Admin can manage AI models and languages (CRUD) via FastAPI endpoints
  2. Model deployment validation and default/multimodal flags are functional
**Plans**: 5

Plans:
- [x] 08-01: Model Config CRUD endpoints (MODEL-01, MODEL-02) - completed 2026-02-27
- [ ] 08-02: Model Config action endpoints (MODEL-03, MODEL-04, MODEL-05, MODEL-06, MODEL-07) - planned 2026-02-27
- [x] 08-03: Language list/create endpoints (LANG-01, LANG-02) - completed 2026-02-27
- [ ] 08-04: Language edit/delete endpoints (LANG-03, LANG-04, LANG-05) - planned 2026-02-27
- [ ] 08-05: [TBD] - planned 2026-02-27

#### Phase 9: Content Management & Settings
**Goal**: Activity logs, content oversight, and application settings
**Depends on**: Phase 8
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, CONTENT-06, CONTENT-07, SET-01, SET-02, SET-03
**Success Criteria** (what must be TRUE):
  1. Admin can view upload/download activity logs with filtering by type and status
  2. Admin can view file details, delete files with vector cleanup confirmation
  3. Admin can manage catalogs and categories (CRUD operations)
  4. Admin can view and edit app settings (name, logo, color) with persistence
**Plans**: TBD

Plans:
- [ ] 09-01: Activity log with upload/download filtering and file details
- [ ] 09-02: File deletion with vector cleanup confirmation
- [ ] 09-03: Catalog and Category CRUD operations
- [ ] 09-04: App settings with edit/save functionality

### 📋 v1.2 RAG Integration (Planned)

**Milestone Goal:** Complete RAG query pipeline with vector search, citations, and streaming responses.

[Phases to be defined after v1.1 completion]

### 📋 v1.3 Production Migration (Planned)

**Milestone Goal:** Complete Flask cutover and performance optimization.

[Phases to be defined after v1.2 completion]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. API Foundation | v1.0 | 5/5 | Complete | 2026-02-25 |
| 2. Frontend User App | v1.0 | 6/6 | Complete | 2026-02-26 |
| 3. Frontend Infrastructure & Auth | v1.1 | 3/3 | Complete | 2026-02-26 |
| 4. Dashboard & User Management (FE) | v1.1 | 8/8 | Complete | 2026-02-26 |
| 5. LLM/Model/Language (FE) | v1.1 | 4/4 | Complete | 2026-02-27 |
| 6. Backend User Actions (GAP) | v1.1 | 0/2 | Not started | - |
| 7. Backend LLM Providers (GAP) | v1.1 | 2/2 | Complete | 2026-02-27 |
| 8. Backend Models & Languages (GAP) | 5/5 | Complete   | 2026-02-27 | 2026-02-27 |
| 9. Content Management & Settings | v1.1 | 0/4 | Not started | - |

---

## Phase Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1 | API-01-05, AUTH-01-05, ADM-01-02 | 12 |
| 2 | AUTH-06, DOC-01-07, FEA-01-05 | 13 |
| 3 | FE-01-06, AUTH-01-04 | 10 |
| 4 | DASH-01-05, USER-01-03 | 8 |
| 5 | (Frontend only - PROV, MODEL, LANG) | 0 |
| 6 | USER-04-10 | 7 |
| 7 | PROV-01-08 | 8 |
| 8 | MODEL-01-07, LANG-01-05 | 12 |
| 9 | CONTENT-01-07, SET-01-03 | 10 |
| **v1.1 Total** | | **55** |
| **Grand Total** | | **110** |

---

*Last updated: 2026-02-27 after 08-03 LLM Language Schemas and Base CRUD Endpoints completion (LANG-01, LANG-02)*

