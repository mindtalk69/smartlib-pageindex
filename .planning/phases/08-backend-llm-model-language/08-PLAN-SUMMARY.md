---
phase: 08-backend-llm-model-language
summary_version: 1.0
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
| 08-01 | 1 | MODEL-01 to MODEL-07 | 8 tasks | main_fastapi.py, schemas.py |
| 08-02 | 1 | LANG-01 to LANG-05 | 5 tasks | main_fastapi.py, schemas.py |

**Total:** 2 plans, 13 tasks, 2 files modified

## Execution Order

Both plans are Wave 1 (no inter-dependencies) and can execute in parallel:

```
Wave 1 (Parallel):
├── 08-01: Model Config Endpoints (8 tasks)
│   ├── Task 1: Add Model Config schemas
│   ├── Task 2: List models endpoint (MODEL-01)
│   ├── Task 3: Create model endpoint (MODEL-02)
│   ├── Task 4: Update model endpoint (MODEL-03)
│   ├── Task 5: Delete model endpoint (MODEL-04)
│   ├── Task 6: Set default endpoint (MODEL-05)
│   ├── Task 7: Set multimodal endpoint (MODEL-06)
│   └── Task 8: Validate deployment endpoint (MODEL-07)
│
└── 08-02: Language Endpoints (5 tasks)
    ├── Task 1: Add Language schemas
    ├── Task 2: List languages endpoint (LANG-01)
    ├── Task 3: Create language endpoint (LANG-02)
    ├── Task 4: Update language endpoint (LANG-03, LANG-04)
    └── Task 5: Delete language endpoint (LANG-05)
```

## Endpoints to Implement

### Model Config (08-01)

| Method | Path | Requirement | Description |
|--------|------|-------------|-------------|
| GET | /api/v1/admin/models | MODEL-01 | List all models with provider_obj |
| POST | /api/v1/admin/models/add | MODEL-02 | Create new model with validation |
| POST | /api/v1/admin/models/edit/{id} | MODEL-03 | Update model configuration |
| POST | /api/v1/admin/models/delete/{id} | MODEL-04 | Delete model |
| POST | /api/v1/admin/models/set-default/{id} | MODEL-05 | Set model as default |
| POST | /api/v1/admin/models/set-multimodal/{id} | MODEL-06 | Set model as multimodal |
| POST | /api/v1/admin/models/validate | MODEL-07 | Validate deployment configuration |

### Language (08-02)

| Method | Path | Requirement | Description |
|--------|------|-------------|-------------|
| GET | /api/v1/admin/languages | LANG-01 | List all languages |
| POST | /api/v1/admin/languages/add | LANG-02 | Create new language |
| POST | /api/v1/admin/languages/edit/{id} | LANG-03 | Update language details |
| POST | /api/v1/admin/languages/edit/{id} | LANG-04 | Toggle active status (via edit) |
| POST | /api/v1/admin/languages/delete/{id} | LANG-05 | Delete language |

## Schemas to Add (schemas.py)

### Model Config Schemas
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

### Language Schemas
```python
LLMLanguageListResponse      # List response wrapper
LLMLanguageCreateRequest     # Create request body
LLMLanguageCreateResponse    # Create response wrapper
LLMLanguageUpdateRequest     # Update request body
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

## Next Steps

After execution:
1. Run verification tests for all endpoints
2. Test frontend integration (useModels, useLanguages hooks)
3. Update .planning/STATE.md with phase completion
4. Update .planning/ROADMAP.md phase status

---

*Generated: 2026-02-27*
*Phase 08 ready for execution*
