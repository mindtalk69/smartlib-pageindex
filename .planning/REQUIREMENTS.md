# Requirements: SmartLib BASIC - v1.1 Admin Dashboard

**Defined:** 2026-02-26
**Core Value:** Users can upload documents, organize them into libraries/knowledges, and get intelligent answers to questions by querying document vectors via embedding-based retrieval.
**Based on:** shadcn/ui with dark/light theme support

---

## v1.1 Requirements

Requirements for Admin Dashboard (React frontend at /admin-app).

### Frontend Infrastructure (FE)

- [x] **FE-01**: Admin app built with React + TypeScript
- [ ] **FE-02**: UI components using shadcn/ui library
- [ ] **FE-03**: Client-side routing with React Router
- [ ] **FE-04**: Dark/light theme toggle with persistence
- [ ] **FE-05**: Responsive admin layout with sidebar navigation
- [x] **FE-06**: JWT authentication integration (reuse from /app)

### Authentication (AUTH)

- [ ] **AUTH-01**: Admin-only access control (is_admin check)
- [ ] **AUTH-02**: JWT token validation on protected routes
- [ ] **AUTH-03**: Auto-redirect to login if token invalid/missing
- [ ] **AUTH-04**: Logout functionality

### Dashboard (DASH)

- [x] **DASH-01**: Stats cards showing user count, file count, message count
- [x] **DASH-02**: Statistics charts (Library Ref Distribution, Users per Library, File vs URL, Knowledge Stats)
- [x] **DASH-03**: User reference statistics table
- [x] **DASH-04**: Chart toggle buttons to switch between views
- [x] **DASH-05**: Real-time data refresh capability

### User Management (USER)

- [x] **USER-01**: List all users with pagination (10 per page)
- [x] **USER-02**: Search users by username or user_id
- [x] **USER-03**: View user details (username, email, is_admin, is_disabled, created_at)
- [x] **USER-04**: Toggle user admin status (grant/revoke admin)
- [x] **USER-05**: Toggle user active status (enable/disable account)
- [x] **USER-06**: Reset user password (generate temporary password)
- [x] **USER-07**: Delete user (with confirmation)
- [x] **USER-08**: View password reset requests (pending, completed, denied)
- [x] **USER-09**: Approve password reset request (generate temp password)
- [x] **USER-10**: Deny password reset request (with admin notes)

### LLM Provider Management (PROV)

- [x] **PROV-01**: List all LLM providers with priority ordering
- [x] **PROV-02**: Add new provider (name, provider_type, base_url, api_key, is_active, priority, config)
- [x] **PROV-03**: Edit existing provider details
- [x] **PROV-04**: Delete provider (if no associated models)
- [x] **PROV-05**: Test provider connectivity (health check)
- [x] **PROV-06**: Discover available models from provider
- [x] **PROV-07**: Update provider priorities (drag-and-drop reordering)
- [x] **PROV-08**: View provider health status (last_health_check, health_status, error_message)

### Model Configuration (MODEL)

- [ ] **MODEL-01**: List all models with provider association
- [ ] **MODEL-02**: Add new model (name, deployment_name, provider_id, temperature, streaming, description)
- [ ] **MODEL-03**: Edit model configuration
- [ ] **MODEL-04**: Delete model
- [ ] **MODEL-05**: Set model as default
- [ ] **MODEL-06**: Set model as multimodal
- [ ] **MODEL-07**: Validate deployment configuration (streaming support, temperature range, connectivity)

### Language Management (LANG)

- [x] **LANG-01**: List all LLM languages (language_code, language_name, is_active)
- [x] **LANG-02**: Add new language
- [x] **LANG-03**: Edit language details
- [x] **LANG-04**: Toggle language active status
- [x] **LANG-05**: Delete language

### Content Management (CONTENT)

- [ ] **CONTENT-01**: Activity log showing upload activities (filename, file_size, upload_time, username, library, knowledge, is_ocr, metadata_summary)
- [ ] **CONTENT-02**: Activity log showing download activities (url, library, knowledge, status, error_message, processed_at)
- [ ] **CONTENT-03**: Filter activities by type (upload/download) and status
- [ ] **CONTENT-04**: View file details with metadata summary
- [ ] **CONTENT-05**: Delete file records (with vector cleanup confirmation)
- [ ] **CONTENT-06**: Catalog CRUD operations (name, description, created_by)
- [ ] **CONTENT-07**: Category CRUD operations (name, description, created_by_user_id)

### Settings (SET)

- [ ] **SET-01**: View and edit app settings (app_name, logo_url, primary_color)
- [ ] **SET-02**: Save settings with confirmation
- [ ] **SET-03**: Settings persistence to database

### API Integration (API)

All features must use existing FastAPI admin endpoints:
- `/api/v1/admin/*` — Admin API endpoints (already implemented)
- JWT Bearer token authentication
- Error handling with user-friendly messages

---

## v2 Requirements (Deferred)

### Prompts Management
- **PROMPT-01**: List system prompts
- **PROMPT-02**: Create/edit/delete prompts
- **PROMPT-03**: Test prompts with LLM
- **PROMPT-04**: Set default prompts

### Additional Admin Features
- Libraries management
- Knowledges management
- Groups management
- User Groups management
- Feedback management
- Vector reference logs
- Visual grounding activities
- Folder upload management

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| SQLAdmin replacement | Building custom React UI instead |
| PostgreSQL/PGVector | sqlite-vec in SQLite is the chosen architecture |
| Real-time websocket updates | Not required for v1.1, can be added later |
| Advanced analytics | Basic stats sufficient for v1.1 |
| Multi-tenant support | Single-tenant application |

---

## Technical Specifications

### UI Framework
- **Component Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Theme**: Dark/light mode with next-themes
- **Routing**: React Router v6
- **State Management**: React Context + hooks
- **Forms**: React Hook Form + Zod validation
- **Data Fetching**: fetch API with JWT tokens
- **Charts**: Chart.js (reuse from Flask admin)

### Folder Structure
```
frontend/
  src/
    admin-app/
      components/
        layout/
          Sidebar.tsx
          Header.tsx
          ThemeToggle.tsx
        dashboard/
          StatCard.tsx
          ChartSection.tsx
        users/
          UserList.tsx
          UserDialog.tsx
          PasswordResetRequests.tsx
        providers/
          ProviderList.tsx
          ProviderDialog.tsx
        models/
          ModelList.tsx
          ModelDialog.tsx
        content/
          ActivityLog.tsx
          Catalogs.tsx
          Categories.tsx
        settings/
          AppSettings.tsx
      pages/
        Dashboard.tsx
        Users.tsx
        Providers.tsx
        Models.tsx
        Languages.tsx
        Content.tsx
        Settings.tsx
      hooks/
        useAuth.ts
        useTheme.ts
        useAdminApi.ts
      lib/
        apiClient.ts (reuse from /app)
        types.ts
      App.tsx
      main.tsx
```

### Authentication Flow
1. User logs in via /app (JWT token issued)
2. Navigate to /admin-app
3. Check is_admin claim in JWT
4. If not admin, redirect to /app with error
5. Admin access granted to all /admin-app routes

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FE-01 | Phase 3 | Complete |
| FE-02 | Phase 3 | Pending |
| FE-03 | Phase 3 | Pending |
| FE-04 | Phase 3 | Pending |
| FE-05 | Phase 3 | Pending |
| FE-06 | Phase 3 | Complete |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Complete (04-01) |
| DASH-02 | Phase 4 | Complete (04-GAP-01) |
| DASH-03 | Phase 4 | Complete (04-02) |
| DASH-04 | Phase 4 | Complete (04-01) |
| DASH-05 | Phase 4 | Complete (04-01) |
| USER-01 | Phase 4 | Complete (04-03) |
| USER-02 | Phase 4 | Complete (04-03) |
| USER-03 | Phase 4 | Complete (04-03) |
| USER-04 | Phase 4 | Complete (04-04) |
| USER-05 | Phase 4 | Complete (04-04) |
| USER-06 | Phase 4 | Complete (04-04) |
| USER-07 | Phase 4 | Complete (04-04) |
| USER-08 | Phase 4 | Complete (04-05) |
| USER-09 | Phase 4 | Complete (04-05) |
| USER-10 | Phase 4 | Complete (04-05) |
| PROV-01 | Phase 5 | Complete (05-01) |
| PROV-02 | Phase 5 | Complete (05-01) |
| PROV-03 | Phase 5 | Complete (05-01) |
| PROV-04 | Phase 5 | Complete (05-01) |
| PROV-05 | Phase 5 | Complete (05-01) |
| PROV-06 | Phase 5 | Complete (05-01) |
| PROV-07 | Phase 5 | Complete (05-01) |
| PROV-08 | Phase 5 | Complete (05-01) |
| MODEL-01 | Phase 5 | Pending |
| MODEL-02 | Phase 5 | Pending |
| MODEL-03 | Phase 5 | Pending |
| MODEL-04 | Phase 5 | Pending |
| MODEL-05 | Phase 5 | Pending |
| MODEL-06 | Phase 5 | Pending |
| MODEL-07 | Phase 5 | Pending |
| LANG-01 | Phase 5 | Complete (05-04) |
| LANG-02 | Phase 5 | Complete (05-04) |
| LANG-03 | Phase 5 | Complete (05-04) |
| LANG-04 | Phase 5 | Complete (05-04) |
| LANG-05 | Phase 5 | Complete (05-04) |
| CONTENT-01 | Phase 6 | Pending |
| CONTENT-02 | Phase 6 | Pending |
| CONTENT-03 | Phase 6 | Pending |
| CONTENT-04 | Phase 6 | Pending |
| CONTENT-05 | Phase 6 | Pending |
| CONTENT-06 | Phase 6 | Pending |
| CONTENT-07 | Phase 6 | Pending |
| SET-01 | Phase 6 | Pending |
| SET-02 | Phase 6 | Pending |
| SET-03 | Phase 6 | Pending |

**Coverage:** 55/55 requirements mapped ✓

---

*Requirements defined: 2026-02-26*
*Last updated: 2026-02-27 after 05-04 Language Management completion (LANG-01 to LANG-05 complete)*
