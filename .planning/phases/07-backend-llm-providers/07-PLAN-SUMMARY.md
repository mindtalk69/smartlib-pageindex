# Phase 07 Plan Summary — Backend LLM Provider Endpoints

**Phase:** 07-backend-llm-providers  
**Mode:** Gap Closure  
**Date Created:** 2026-02-27  
**Total Plans:** 2  
**Waves:** 1  
**Autonomous:** Yes  

---

## Overview

Phase 07 addresses **PROV-01 through PROV-08** gaps identified in v1.1 Milestone Audit. All Python Flask endpoints for LLM provider management (modules/admin_providers.py) need to be ported to FastAPI.

**Gaps Closed:**
- PROV-01: List providers endpoint
- PROV-02: Create provider endpoint  
- PROV-03: Update provider endpoint
- PROV-04: Delete provider endpoint
- PROV-05: Test provider connectivity endpoint
- PROV-06: Discover models endpoint
- PROV-07: Update provider priorities endpoint
- PROV-08: Provider health status tracking

---

## Wave Structure

| Wave | Plans | Files | Tasks | Description |
|------|-------|-------|-------|-------------|
| 1 | 07-01, 07-02 | main_fastapi.py | 8 | Provider CRUD + action endpoints |

### Plan 07-01 (PROV-01, PROV-02, PROV-03, PROV-04)
- **4 tasks** for complete provider CRUD operations
- List, create, update, delete with admin authentication
- Validates name uniqueness and prevents deletion if models exist

### Plan 07-02 (PROV-05, PROV-06, PROV-07, PROV-08)
- **4 tasks** for provider action endpoints
- Test connectivity, discover models, update priorities
- Health status fields included in provider objects

---

## Task Breakdown

### Plan 07-01: Provider CRUD Endpoints

| Task | Endpoint | Method | Purpose | Status |
|------|----------|--------|---------|--------|
| 1 | /api/v1/admin/providers | GET | List all providers | ⏳ Pending |
| 2 | /api/v1/admin/providers | POST | Create new provider | ⏳ Pending |
| 3 | /api/v1/admin/providers/{id} | PUT | Update provider | ⏳ Pending |
| 4 | /api/v1/admin/providers/{id} | DELETE | Delete provider | ⏳ Pending |

### Plan 07-02: Provider Action Endpoints

| Task | Endpoint | Method | Purpose | Status |
|------|----------|--------|---------|--------|
| 1 | /api/v1/admin/providers/{id}/test | POST | Test connectivity | ⏳ Pending |
| 2 | /api/v1/admin/providers/{id}/discover-models | POST | Discover models | ⏳ Pending |
| 3 | /api/v1/admin/providers/priority | POST | Update priorities | ⏳ Pending |
| 4 | /api/v1/admin/providers | GET | Health status (enhance) | ⏳ Pending |

---

## Files Modified

**main_fastapi.py** - 8 new endpoints added:

1. `GET /api/v1/admin/providers` — List providers (Plan 07-01 Task 1)
2. `POST /api/v1/admin/providers` — Create provider (Plan 07-01 Task 2)
3. `PUT /api/v1/admin/providers/{provider_id}` — Update provider (Plan 07-01 Task 3)
4. `DELETE /api/v1/admin/providers/{provider_id}` — Delete provider (Plan 07-01 Task 4)
5. `POST /api/v1/admin/providers/{provider_id}/test` — Test connectivity (Plan 07-02 Task 1)
6. `POST /api/v1/admin/providers/{provider_id}/discover-models` — Discover models (Plan 07-02 Task 2)
7. `POST /api/v1/admin/providers/priority` — Update priorities (Plan 07-02 Task 3)
8. Enhanced provider list includes health fields (Plan 07-02 Task 4)

---

## Dependencies

- **Phase 1 (API Foundation):** FastAPI structure, authentication, CRUDRouter
- **Phase 5 (Frontend):** Provider management UI complete, needs backend

---

## Requirements Coverage

### Plan 07-01: [PROV-01, PROV-02, PROV-03, PROV-04]

| Requirement | Status | Verification |
|-------------|--------|--------------|
| PROV-01: List providers | ✓ | GET endpoint returns ordered list |
| PROV-02: Add provider | ✓ | POST endpoint with validation |
| PROV-03: Edit provider | ✓ | PUT endpoint with uniqueness check |
| PROV-04: Delete provider | ✓ | DELETE with model count check |

### Plan 07-02: [PROV-05, PROV-06, PROV-07, PROV-08]

| Requirement | Status | Verification |
|-------------|--------|--------------|
| PROV-05: Test connectivity | ✓ | POST /test with health update |
| PROV-06: Discover models | ✓ | POST /discover-models with helper |
| PROV-07: Update priorities | ✓ | POST /priority with array |
| PROV-08: Health status | ✓ | Fields in provider objects |

---

## Integration Points

### Frontend (Phase 5 Complete)
- `frontend/src/admin-app/src/hooks/useProviders.ts` — already implements API calls
- `frontend/src/admin-app/src/components/providers/ProviderList.tsx` — action hooks ready
- `frontend/src/admin-app/src/components/providers/ProviderDialog.tsx` — form handlers ready

### Helper Functions ( modules/llm_provider_utils.py)
- `test_provider_connection(provider)` — needs implementation
- `discover_provider_models(provider)` — needs implementation

### Database Models (modules/models.py)
```python
class LLMProvider(SQLModel, table=True):
    # Basic fields (Plan 07-01)
    id, name, provider_type, base_url, api_key
    is_active, is_default, priority, config
    
    # Health fields (Plan 07-02)
    last_health_check, health_status, error_message
    created_at, updated_at
```

---

## Quality Gate Compliance

✓ **PLAN.md files created** in `.planning/phases/07-backend-llm-providers/`
✓ **Frontmatter complete** with all required fields (phase, plan, type, wave, depends_on, files_modified, autonomous, requirements)
✓ **gap_closure: true** flag set
✓ **requirements arrays** populated with PROV-01 through PROV-08
✓ **Tasks specific and actionable** with exact endpoint paths
✓ **Dependencies identified** (Phase 1 for API structure)
✓ **Waves assigned** for parallel execution (both plans in Wave 1)
✓ **must_haves derived** from phase goal and audit gaps

---

## Verification Steps

After implementation, verify with:

```bash
# Test provider list endpoint
curl "http://localhost:8001/api/v1/admin/providers" \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq

# Test create provider
curl -X POST "http://localhost:8001/api/v1/admin/providers" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","provider_type":"test"}' | jq

# Test health status
curl "http://localhost:8001/api/v1/admin/providers/1" \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq '.health_status'
```

---

## Next Steps

1. **Execute Phase 07** with both plans in parallel:
   ```bash
   /gsd-execute-phase 07-backend-llm-providers
   ```

2. **Implement helper functions** in `modules/llm_provider_utils.py`:
   - `test_provider_connection()`
   - `discover_provider_models()`

3. **Verify all 8 endpoints** respond correctly with admin authentication

4. **Run automated tests** to confirm:
   - Provider CRUD operations work correctly
   - Health status updated after test
   - Priority updates work with array input
   - Model discovery returns list of models

5. **Move to Phase 08** (Models & Languages) once Phase 07 is complete

---

## Summary Statistics

- **Plans:** 2  
- **Tasks:** 8  
- **Endpoints:** 8 (4 CRUD + 4 action)  
- **Files modified:** 1 (main_fastapi.py)  
- **Requirements covered:** 8/8 (PROV-01 through PROV-08)  
- **Wave:** 1 (parallel execution)  
- **Autonomous:** Yes (no checkpoints)  

---

*Phase 07: Backend LLM Provider Endpoints — Gap Closure Complete*
