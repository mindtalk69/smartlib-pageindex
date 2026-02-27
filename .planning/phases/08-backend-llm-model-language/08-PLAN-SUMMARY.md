---
phase: 08-backend-llm-model-language
summary_version: 2.0
generated: 2026-02-27
status: ready_for_execution
---

# Phase 08 Plan Summary: Backend LLM Model & Language Endpoints

## Phase Goal

Port Flask model configuration and language management endpoints to FastAPI.

**Requirements:**
- MODEL-01 through MODEL-07 (Model Config CRUD + validation)
- LANG-01 through LANG-05 (Language CRUD)

## Plans Overview

| Plan | Wave | Requirements | Tasks | Files |
|------|------|--------------|-------|-------|
| 08-01 | 1 | MODEL-01, MODEL-02 | 3 | main_fastapi.py, schemas.py |
| 08-02 | 2 | MODEL-03, MODEL-04 | 2 | main_fastapi.py |
| 08-03 | 1 | LANG-01, LANG-02 | 3 | main_fastapi.py, schemas.py |
| 08-04 | 2 | LANG-03, LANG-04, LANG-05 | 2 | main_fastapi.py |
| 08-05 | 2 | MODEL-05, MODEL-06, MODEL-07 | 3 | main_fastapi.py |

**Total:** 5 plans, 13 tasks, 2 files modified

## Execution Order

```
Wave 1 (Parallel):
├── 08-01: Model Schemas + List/Create (MODEL-01, MODEL-02)
│   ├── Task 1: Add ModelConfig schemas (10 classes)
│   ├── Task 2: GET /api/v1/admin/models - List models
│   └── Task 3: POST /api/v1/admin/models/add - Create model
│
└── 08-03: Language Schemas + List/Create (LANG-01, LANG-02)
    ├── Task 1: Add LLMLanguage schemas (6 classes)
    ├── Task 2: GET /api/v1/admin/languages - List languages
    └── Task 3: POST /api/v1/admin/languages/add - Create language

Wave 2 (Parallel, after Wave 1):
├── 08-02: Model Update/Delete (MODEL-03, MODEL-04)
│   ├── Task 1: POST /api/v1/admin/models/edit/{id}
│   └── Task 2: POST /api/v1/admin/models/delete/{id}
│
├── 08-04: Language Update/Delete (LANG-03, LANG-04, LANG-05)
│   ├── Task 1: POST /api/v1/admin/languages/edit/{id}
│   └── Task 2: POST /api/v1/admin/languages/delete/{id}
│
└── 08-05: Model Actions (MODEL-05, MODEL-06, MODEL-07)
    ├── Task 1: POST /api/v1/admin/models/set-default/{id}
    ├── Task 2: POST /api/v1/admin/models/set-multimodal/{id}
    └── Task 3: POST /api/v1/admin/models/validate
```

## Endpoints to Implement

### Model Config (08-01, 08-02, 08-05)

| Plan | Method | Path | Requirement | Description |
|------|--------|------|-------------|-------------|
| 08-01 | GET | /api/v1/admin/models | MODEL-01 | List all models with provider_obj |
| 08-01 | POST | /api/v1/admin/models/add | MODEL-02 | Create new model with validation |
| 08-02 | POST | /api/v1/admin/models/edit/{id} | MODEL-03 | Update model configuration |
| 08-02 | POST | /api/v1/admin/models/delete/{id} | MODEL-04 | Delete model |
| 08-05 | POST | /api/v1/admin/models/set-default/{id} | MODEL-05 | Set model as default |
| 08-05 | POST | /api/v1/admin/models/set-multimodal/{id} | MODEL-06 | Set model as multimodal |
| 08-05 | POST | /api/v1/admin/models/validate | MODEL-07 | Validate deployment configuration |

### Language (08-03, 08-04)

| Plan | Method | Path | Requirement | Description |
|------|--------|------|-------------|-------------|
| 08-03 | GET | /api/v1/admin/languages | LANG-01 | List all languages |
| 08-03 | POST | /api/v1/admin/languages/add | LANG-02 | Create new language |
| 08-04 | POST | /api/v1/admin/languages/edit/{id} | LANG-03, LANG-04 | Update language / toggle active |
| 08-04 | POST | /api/v1/admin/languages/delete/{id} | LANG-05 | Delete language |

## Schemas to Add (schemas.py)

### Model Config Schemas (08-01)
```python
ModelConfigListResponse      # List response wrapper
ModelConfigCreateRequest     # Create request body
ModelConfigCreateResponse    # Create response wrapper
ModelConfigUpdateRequest     # Update request body (all optional)
ModelConfigUpdateResponse    # Update response wrapper
ModelConfigDeleteResponse    # Delete response wrapper
ModelConfigDefaultResponse   # Set default response
ModelConfigMultimodalResponse # Set multimodal response
ModelValidationRequest       # Validation request body
ModelValidationResponse      # Validation response with flags
```

### Language Schemas (08-03)
```python
LLMLanguageListResponse      # List response wrapper
LLMLanguageCreateRequest     # Create request body
LLMLanguageCreateResponse    # Create response wrapper
LLMLanguageUpdateRequest     # Update request body (all optional)
LLMLanguageUpdateResponse    # Update response wrapper
LLMLanguageDeleteResponse    # Delete response wrapper
```

## Key Implementation Patterns

### From Phase 07 (Provider Endpoints)
- Admin authentication: `Depends(get_current_admin_user)`
- Response format: `{ success: bool, data/model/language: object, message: str }`
- Database sessions: `db: Session = Depends(get_db)`
- Uniqueness checks: `select().where().first()` with IntegrityError handling

### From Flask (admin_models.py)
- Temperature coercion: `_coerce_temperature()` helper
- Deployment validation: `is_streaming_supported_for_deployment()`, `validate_temperature_for_deployment()`, `get_llm()`
- Default model clearing: `update(ModelConfig).values(is_default=False)`
- Multimodal in AppSettings: Update `AppSettings` table with `multimodal_model_id`

### From Flask (admin_languages.py)
- IntegrityError handling for unique constraints (code and name)
- Strip whitespace from code and name
- Boolean coercion for `is_active`

## Frontend Integration

### useModels Hook (frontend/src/admin-app/src/hooks/useModels.ts)
Already expects these endpoints. No frontend changes needed.

### useLanguages Hook (frontend/src/admin-app/src/hooks/useLanguages.ts)
Already expects these endpoints. No frontend changes needed.

## Verification Criteria

### Model Config (MODEL-*)
- [ ] MODEL-01: GET returns list with provider_obj association
- [ ] MODEL-02: POST /add creates model with validation (streaming, temperature, connectivity)
- [ ] MODEL-03: POST /edit updates model with validation
- [ ] MODEL-04: POST /delete removes model from database
- [ ] MODEL-05: POST /set-default clears other defaults and sets target
- [ ] MODEL-06: POST /set-multimodal updates AppSettings table
- [ ] MODEL-07: POST /validate returns detailed flags (streaming_supported, temperature_valid, connectivity_ok)

### Language (LANG-*)
- [ ] LANG-01: GET returns list ordered by language_name
- [ ] LANG-02: POST /add creates language with uniqueness validation
- [ ] LANG-03: POST /edit updates language with uniqueness validation
- [ ] LANG-04: is_active toggle works via edit endpoint
- [ ] LANG-05: POST /delete removes language from database

## Files Modified

| File | Changes |
|------|---------|
| main_fastapi.py | Add 11 new endpoints (7 model + 4 language) |
| schemas.py | Add 16 new schema classes (10 model + 6 language) |

## Dependencies

### Internal (Codebase)
- `modules/models.py` - ModelConfig, LLMLanguage, AppSettings models
- `modules/llm_utils.py` - Deployment validation functions
- `modules/auth.py` - get_current_admin_user dependency
- `database_fastapi.py` - get_db session dependency

### External (Phase 07)
- Phase 07 provider endpoints pattern (follow same structure)
- LLMProvider model (for provider_obj in model list)

## Success Criteria

1. All 11 endpoints respond correctly with proper status codes
2. All endpoints require admin authentication (403 for non-admin)
3. Model deployment validation works (streaming, temperature, connectivity)
4. Model/language name uniqueness enforced
5. Set default clears other model defaults
6. Set multimodal updates AppSettings correctly
7. Language is_active toggle works via edit endpoint
8. Response format matches frontend expectations

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Deployment validation logic complex | Reuse modules/llm_utils functions directly |
| AppSettings multimodal reference | Check existing pattern in codebase |
| IntegrityError handling for languages | Catch and return 409 Conflict |
| Temperature edge cases | Use _coerce_temperature helper pattern |

---

*Generated: 2026-02-27*
*Phase 08 ready for execution*
