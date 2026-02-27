# Phase 5: LLM, Model & Language Management

**Milestone:** v1.1 Admin Dashboard
**Depends on:** Phase 4 (Dashboard & User Management)
**Requirements:** 20 (PROV-01 to PROV-08, MODEL-01 to MODEL-07, LANG-01 to LANG-05)

---

## Phase Goal

Complete AI configuration interface for providers, models, and languages.

## Success Criteria

1. Admin can add, edit, delete, and prioritize LLM providers with health status visibility
2. Admin can test provider connectivity and discover available models
3. Admin can configure models (temperature, streaming, default/multimodal flags) and validate deployment
4. Admin can manage languages (CRUD, toggle active status)

---

## Plans

| Plan | Title | Requirements | Status |
|------|-------|--------------|--------|
| 05-01 | LLM Provider Management | PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08 | Pending |
| 05-02 | Provider Health Monitoring | PROV-05, PROV-08 | Pending |
| 05-03 | Model Configuration | MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05, MODEL-06, MODEL-07 | Pending |
| 05-04 | Language Management | LANG-01, LANG-02, LANG-03, LANG-04, LANG-05 | Pending |

---

## Plan Details

### 05-01: LLM Provider Management

**Files:**
- `frontend/src/admin-app/src/hooks/useProviders.ts`
- `frontend/src/admin-app/src/components/providers/ProviderList.tsx`
- `frontend/src/admin-app/src/components/providers/ProviderDialog.tsx`
- `frontend/src/admin-app/src/pages/Providers.tsx`

**Features:**
- Provider CRUD operations (add, edit, delete)
- Provider types: azure_openai, ollama, openai, anthropic
- Priority ordering with drag-and-drop support
- Test connection button
- Discover models from provider
- Health status display

**API Endpoints:**
- `GET /api/v1/admin/providers` - List providers
- `POST /api/v1/admin/providers` - Add provider
- `PUT /api/v1/admin/providers/:id` - Update provider
- `DELETE /api/v1/admin/providers/:id` - Delete provider
- `POST /api/v1/admin/providers/:id/test` - Test connection
- `POST /api/v1/admin/providers/:id/discover-models` - Discover models
- `POST /api/v1/admin/providers/priority` - Update priorities

---

### 05-02: Provider Health Monitoring

**Files:**
- `frontend/src/admin-app/src/hooks/useProviderHealth.ts`
- `frontend/src/admin-app/src/components/providers/ProviderHealth.tsx`

**Features:**
- Health status badges (healthy/degraded/offline/unknown)
- Last health check timestamp
- Error message display
- Manual health check trigger
- Auto-refresh option

**Health Status Values:**
- `healthy`: Provider responding normally
- `degraded`: Provider responding slowly or with errors
- `offline`: Provider not responding
- `unknown`: Health check not yet performed

---

### 05-03: Model Configuration

**Files:**
- `frontend/src/admin-app/src/hooks/useModels.ts`
- `frontend/src/admin-app/src/components/models/ModelList.tsx`
- `frontend/src/admin-app/src/components/models/ModelDialog.tsx`
- `frontend/src/admin-app/src/pages/Models.tsx`

**Features:**
- Model CRUD operations
- Temperature configuration (0-2 range)
- Streaming toggle
- Set default model (mutually exclusive)
- Set multimodal model (mutually exclusive)
- Deployment validation (streaming, temperature, connectivity)
- Provider association display

**API Endpoints:**
- `GET /api/v1/admin/models` - List models
- `POST /api/v1/admin/models/add` - Add model
- `POST /api/v1/admin/models/edit/:id` - Update model
- `DELETE /api/v1/admin/models/delete/:id` - Delete model
- `POST /api/v1/admin/models/set-default/:id` - Set as default
- `POST /api/v1/admin/models/set-multimodal/:id` - Set as multimodal
- `POST /api/v1/admin/models/validate` - Validate deployment

---

### 05-04: Language Management

**Files:**
- `frontend/src/admin-app/src/hooks/useLanguages.ts`
- `frontend/src/admin-app/src/components/languages/LanguageList.tsx`
- `frontend/src/admin-app/src/components/languages/LanguageDialog.tsx`
- `frontend/src/admin-app/src/pages/Languages.tsx`

**Features:**
- Language CRUD operations
- Language code and name fields
- Active status toggle
- Search/filter by code, name, status
- Common language code suggestions

**API Endpoints:**
- `GET /api/v1/admin/languages` - List languages
- `POST /api/v1/admin/languages/add` - Add language
- `POST /api/v1/admin/languages/edit/:id` - Update language
- `DELETE /api/v1/admin/languages/delete/:id` - Delete language

---

## Architecture

### Component Pattern

All modules follow the same pattern established in Phase 4:

```
hooks/
  useXxx.ts          # Data fetching + CRUD operations
components/
  XxxList.tsx        # Table display with actions
  XxxDialog.tsx      # Add/Edit form dialog
pages/
  Xxx.tsx            # Page integration + routing
```

### State Management

- React Context + hooks (no external library)
- Each hook manages its own state
- Success/error callbacks via props
- Toast notifications via sonner

### UI Components

Reusing shadcn/ui components from Phase 3-4:
- Table, Card, Dialog, AlertDialog
- Button, Input, Label, Textarea, Select
- Badge, Tabs, DropdownMenu
- Toast (sonner)

---

## Backend API Reference

Existing Flask blueprints provide the API:

| Module | File | Routes |
|--------|------|--------|
| Providers | `modules/admin_providers.py` | `/admin/providers/*` |
| Models | `modules/admin_models.py` | `/admin/models/*` |
| Languages | `modules/admin_languages.py` | `/admin/languages/*` |

**Note:** These are Flask routes. Frontend calls FastAPI endpoints at `/api/v1/admin/*`. Ensure FastAPI wrappers exist or add them.

---

## Database Schema

### LLMProvider Table
```sql
- id (PK)
- name (unique)
- provider_type (azure_openai, ollama, openai, etc.)
- base_url
- api_key
- is_active
- is_default
- priority
- config (JSON)
- last_health_check
- health_status (healthy, degraded, offline)
- error_message
- created_at
- updated_at
```

### ModelConfig Table
```sql
- id (PK)
- provider_id (FK -> LLMProvider)
- name (unique)
- deployment_name
- provider (legacy)
- temperature
- streaming
- description
- is_default
- created_by
- created_at
```

### LlmLanguage Table
```sql
- id (PK)
- language_code (unique)
- language_name (unique)
- is_active
- created_by
- created_at
```

---

## Verification Checklist

Before marking phase complete:

- [ ] All 4 plans executed and summaries created
- [ ] Providers page accessible at /admin/providers
- [ ] Models page accessible at /admin/models
- [ ] Languages page accessible at /admin/languages
- [ ] All CRUD operations work via UI
- [ ] Provider health checks functional
- [ ] Model deployment validation works
- [ ] TypeScript compilation passes
- [ ] Navigation links added to sidebar

---

*Phase 5 Plans created: 2026-02-27*
