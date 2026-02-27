# Roadmap: SmartLib BASIC FastAPI Migration

**Created:** 2026-02-24
**Goal:** Migrate from Flask to FastAPI while maintaining production availability

---

## Milestones

- ✅ **v1.0 FastAPI Foundation** — Phases 1-2 (shipped 2026-02-26)
- 🚧 **v1.1 Admin Dashboard** — Phases 3-6 (in progress)
- 📋 **v1.2 RAG Integration** — Future (planned)
- 📋 **v1.3 Production Migration** — Future (planned)

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
- [ ] 03-01-PLAN.md — React app setup with shadcn/ui components and TypeScript configuration
- [ ] 03-02-PLAN.md — Layout components (Sidebar, Header, ThemeToggle) with responsive design
- [ ] 03-03-PLAN.md — Authentication integration with JWT validation and admin-only access control

#### Phase 4: Dashboard & User Management
**Goal**: System statistics dashboard and comprehensive user CRUD operations
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, USER-08, USER-09, USER-10
**Success Criteria** (what must be TRUE):
  1. Admin sees dashboard with stats cards (user/file/message counts) and interactive charts
  2. Admin can search, view, enable/disable, grant/revoke admin, and delete users
  3. Admin can view and manage password reset requests (approve/deny with notes)
  4. Admin can switch between different chart views and refresh data in real-time
**Plans**: TBD

Plans:
- [x] 04-01: Dashboard components (useDashboardData hook, StatCard, ChartSection) - completed 2026-02-27
- [x] 04-02: Dashboard integration (Dashboard page, UserStatsTable, UI components) - completed 2026-02-27
- [x] 04-03: User management list (useUsers hook, UserList table, UserDialog) - completed 2026-02-27
- [x] 04-04: User actions (toggle admin/status, password reset, delete) with confirmations - completed 2026-02-27
- [x] 04-05: Password reset requests management (approve/deny with admin notes) - completed 2026-02-27
- [x] 04-GAP-01: Dashboard chart implementation (Recharts integration, 4 chart types) - completed 2026-02-27
- [x] 04-GAP-02: AdminLayout children prop fix (LAYOUT-01 gap closed) - completed 2026-02-27
- [x] 04-GAP-03: UserList undefined props fix (action callbacks wired, USER-01 gap closed) - completed 2026-02-27
- [x] 04-GAP-05: TypeScript type annotations for PasswordResetRequests (TS-TYPE-01 gap closed) - completed 2026-02-26

#### Phase 5: LLM, Model & Language Management
**Goal**: Complete AI configuration interface for providers, models, and languages
**Depends on**: Phase 4
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08, MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05, MODEL-06, MODEL-07, LANG-01, LANG-02, LANG-03, LANG-04, LANG-05
**Success Criteria** (what must be TRUE):
  1. Admin can add, edit, delete, and prioritize LLM providers with health status visibility
  2. Admin can test provider connectivity and discover available models
  3. Admin can configure models (temperature, streaming, default/multimodal flags) and validate deployment
  4. Admin can manage languages (CRUD, toggle active status)
**Plans**: TBD

Plans:
- [x] 05-01: LLM Provider management (list, add, edit, delete, test, discover models, prioritize) - completed 2026-02-27
- [ ] 05-02: Provider health monitoring and connectivity testing
- [ ] 05-03: Model configuration (list, add, edit, delete, set default/multimodal, validate deployment)
- [ ] 05-04: Language management (list, add, edit, delete, toggle active)

#### Phase 6: Content Management & Settings
**Goal**: Activity logs, content oversight, and application settings
**Depends on**: Phase 5
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, CONTENT-06, CONTENT-07, SET-01, SET-02, SET-03
**Success Criteria** (what must be TRUE):
  1. Admin can view upload/download activity logs with filtering by type and status
  2. Admin can view file details, delete files with vector cleanup confirmation
  3. Admin can manage catalogs and categories (CRUD operations)
  4. Admin can view and edit app settings (name, logo, color) with persistence
**Plans**: TBD

Plans:
- [ ] 06-01: Activity log with upload/download filtering and file details
- [ ] 06-02: File deletion with vector cleanup confirmation
- [ ] 06-03: Catalog and Category CRUD operations
- [ ] 06-04: App settings with edit/save functionality

### 📋 v1.2 RAG Integration (Planned)

**Milestone Goal:** Complete RAG query pipeline with vector search, citations, and streaming responses.

[Phases to be defined after v1.1 completion]

### 📋 v1.3 Production Migration (Planned)

**Milestone Goal:** Complete Flask cutover and performance optimization.

[Phases to be defined after v1.2 completion]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. API Foundation | v1.0 | 5/5 | Complete | 2026-02-25 |
| 2. Frontend User App | v1.0 | 6/6 | Complete | 2026-02-26 |
| 3. Frontend Infrastructure & Auth | v1.1 | 3/3 | Complete | 2026-02-26 |
| 4. Dashboard & User Management | v1.1 | 8/8 | Complete | 2026-02-26 |
| 5. LLM/Model/Language Management | v1.1 | 0/4 | Not started | - |
| 6. Content Management & Settings | v1.1 | 0/4 | Not started | - |

---

## Phase Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1 | API-01-05, AUTH-01-05, ADM-01-02 | 12 |
| 2 | AUTH-06, DOC-01-07, FEA-01-05 | 13 |
| 3 | FE-01-06, AUTH-01-04 | 10 |
| 4 | DASH-01-05, USER-01-10 | 15 |
| 5 | PROV-01-08, MODEL-01-07, LANG-01-05 | 20 |
| 6 | CONTENT-01-07, SET-01-03 | 10 |
| **v1.1 Total** | | **55** |
| **Grand Total** | | **110** |

---

*Last updated: 2026-02-26 after 04-GAP-05 TypeScript Type Annotations completion*
