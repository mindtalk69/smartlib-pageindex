# Phase 08: Backend LLM Model & Language Endpoints - Research

**Researched:** 2026-02-27
**Domain:** FastAPI admin endpoints for LLM Model configuration and Language management
**Confidence:** HIGH

## Summary

This phase ports Flask model and language management endpoints (`modules/admin_models.py` and `modules/admin_languages.py`) to FastAPI. The work follows the exact pattern established in Phase 07 for LLM Provider endpoints.

**Primary recommendation:** Implement all endpoints in `main_fastapi.py` following the Phase 07 provider endpoint patterns, reusing existing helper functions from `modules/llm_utils.py` for model deployment validation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115.x+ | Web framework | Already adopted as project standard (Phase 1) |
| SQLModel | latest | ORM | Unified SQLAlchemy + Pydantic, consistent with Phase 1 |
| Pydantic | 2.x | Data validation | Built into FastAPI, type-safe schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| langchain_openai | latest | LLM client | Model deployment validation (test connectivity) |
| sqlalchemy | 2.x | Database utilities | Count queries, ordering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FastAPI | Flask (existing) | FastAPI provides async, better OpenAPI docs, type safety |
| SQLModel | SQLAlchemy only | SQLModel adds Pydantic integration, cleaner schemas |

**Installation:** Already installed (Phase 1 dependencies)

## Architecture Patterns

### Endpoint Structure

All endpoints follow the Phase 07 pattern:
1. Path prefix: `/api/v1/admin/`
2. Admin authentication: `Depends(get_current_admin_user)`
3. Response models: Typed Pydantic schemas
4. Database sessions: `Depends(get_db)`

### Recommended Endpoint Organization

```python
# main_fastapi.py - Phase 08 endpoints

# ============================================================================
# Model Config Admin CRUD Endpoints (Phase 08 - MODEL-01 through MODEL-07)
# ============================================================================

@app.get("/api/v1/admin/models", response_model=ModelConfigListResponse)
def list_admin_models(...)

@app.post("/api/v1/admin/models/add", response_model=ModelConfigCreateResponse)
def create_admin_model(...)

@app.post("/api/v1/admin/models/edit/{model_id}", response_model=ModelConfigUpdateResponse)
def update_admin_model(...)

@app.post("/api/v1/admin/models/delete/{model_id}", response_model=ModelConfigDeleteResponse)
def delete_admin_model(...)

@app.post("/api/v1/admin/models/set-default/{model_id}", response_model=ModelConfigDefaultResponse)
def set_default_model(...)

@app.post("/api/v1/admin/models/set-multimodal/{model_id}", response_model=ModelConfigMultimodalResponse)
def set_multimodal_model(...)

@app.post("/api/v1/admin/models/validate", response_model=ModelValidationResponse)
def validate_deployment(...)

# ============================================================================
# LLM Language Admin CRUD Endpoints (Phase 08 - LANG-01 through LANG-05)
# ============================================================================

@app.get("/api/v1/admin/languages", response_model=LLMLanguageListResponse)
def list_admin_languages(...)

@app.post("/api/v1/admin/languages/add", response_model=LLMLanguageCreateResponse)
def create_admin_language(...)

@app.post("/api/v1/admin/languages/edit/{language_id}", response_model=LLMLanguageUpdateResponse)
def update_admin_language(...)

@app.post("/api/v1/admin/languages/delete/{language_id}", response_model=LLMLanguageDeleteResponse)
def delete_admin_language(...)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deployment validation | Custom HTTP client | `modules/llm_utils.validate_deployment_configuration()` | Already handles streaming, temperature, connectivity |
| Temperature coercion | Manual parsing | `_coerce_temperature()` helper | Edge cases handled (None, empty string, invalid) |
| Uniqueness checks | Raw SQL | SQLModel `select().where()` | Type-safe, consistent with Phase 1/07 |
| Admin auth | Manual JWT parsing | `get_current_admin_user()` dependency | Tested, handles edge cases |

**Key insight:** All helper functions from Flask (`modules/admin_models.py`, `modules/admin_languages.py`, `modules/llm_utils.py`) can be directly adapted or reused.

## Common Pitfalls

### Pitfall 1: Temperature Validation Scope
**What goes wrong:** Accepting any temperature value without checking deployment capabilities
**Why it happens:** Different providers support different temperature ranges
**How to avoid:** Use `validate_temperature_for_deployment()` from `modules/llm_utils.py`
**Warning signs:** Temperature > 2.0 or < 0 accepted without validation

### Pitfall 2: Streaming Support Assumptions
**What goes wrong:** Allowing streaming=true for deployments that don't support it
**Why it happens:** Not all LLM providers/deployments support streaming
**How to avoid:** Use `is_streaming_supported_for_deployment()` from `modules/llm_utils.py`
**Warning signs:** Streaming flag accepted without validation

### Pitfall 3: Model Deletion Cascading
**What goes wrong:** Deleting models without checking if they're set as default/multimodal
**Why it happens:** AppSettings stores references to default/multimodal models
**How to avoid:** Check `AppSettings` for `multimodal_model_id` before deletion
**Warning signs:** Orphaned app settings after model deletion

### Pitfall 4: Language Code/Name Uniqueness
**What goes wrong:** Allowing duplicate language codes or names
**Why it happens:** Missing uniqueness validation
**How to avoid:** Catch `IntegrityError` on insert/update, check existence before write
**Warning signs:** Duplicate languages in database

## Code Examples

### Model Creation (from Phase 07 pattern)

```python
from sqlmodel import select
from sqlalchemy import func

@app.post("/api/v1/admin/models/add", response_model=ModelConfigCreateResponse, status_code=status.HTTP_201_CREATED)
def create_admin_model(
    model_data: ModelConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new model configuration (admin only)."""
    from modules.llm_utils import (
        is_streaming_supported_for_deployment,
        validate_temperature_for_deployment,
        get_llm,
    )

    # Validate required fields
    name = model_data.name.strip() if model_data.name else ""
    deployment_name = model_data.deployment_name.strip() if model_data.deployment_name else ""

    if not name or not deployment_name or not model_data.provider_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name, deployment_name, and provider_id are required"
        )

    # Get provider object
    provider = db.get(LLMProvider, model_data.provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid provider"
        )

    # Validate deployment configuration
    if model_data.streaming and not is_streaming_supported_for_deployment(deployment_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deployment '{deployment_name}' does not support streaming"
        )

    temp_ok, _, temp_error = validate_temperature_for_deployment(deployment_name, model_data.temperature)
    if not temp_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=temp_error
        )

    # Check for duplicate name
    existing = db.exec(select(ModelConfig).where(ModelConfig.name == name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with name '{name}' already exists"
        )

    # Clear other defaults if setting as default
    if model_data.is_default:
        db.exec(update(ModelConfig).values(is_default=False))

    # Create model
    model = ModelConfig(
        name=name,
        deployment_name=deployment_name,
        provider=provider.provider_type,
        provider_id=provider.id,
        temperature=model_data.temperature,
        streaming=model_data.streaming,
        description=model_data.description,
        is_default=model_data.is_default,
        created_by=current_user.user_id,
    )

    db.add(model)
    db.commit()
    db.refresh(model)

    return {"success": True, "model": model}
```

### Language List (from Phase 07 pattern)

```python
@app.get("/api/v1/admin/languages", response_model=LLMLanguageListResponse)
def list_admin_languages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List all LLM languages (admin only)."""
    statement = select(LLMLanguage).order_by(LLMLanguage.language_name)
    result = db.exec(statement)
    languages = result.all()

    items = []
    for lang in languages:
        items.append({
            "id": lang.id,
            "language_code": lang.language_code,
            "language_name": lang.language_name,
            "is_active": lang.is_active,
            "created_by": lang.created_by,
            "created_at": lang.created_at.isoformat() if lang.created_at else None,
        })

    return {
        "success": True,
        "data": {
            "items": items,
            "total": len(items),
        },
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flask Blueprint | FastAPI router | Phase 1 | Better OpenAPI docs, async support |
| Flask sessions | JWT authentication | Phase 1 | Stateless, scalable auth |
| Flask form data | Pydantic models | Phase 1 | Type safety, auto-validation |
| Manual SQL | SQLModel | Phase 1 | Cleaner ORM, type hints |

**Deprecated/outdated:**
- Flask Blueprint patterns: Still in `modules/admin_models.py`, `modules/admin_languages.py` - to be replaced
- Session-based admin checks: Replaced with `get_current_admin_user()` dependency

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MODEL-01 | List all models with provider association | GET /api/v1/admin/models with provider_obj |
| MODEL-02 | Add new model | POST /api/v1/admin/models/add with validation |
| MODEL-03 | Edit model configuration | POST /api/v1/admin/models/edit/{id} |
| MODEL-04 | Delete model | POST /api/v1/admin/models/delete/{id} |
| MODEL-05 | Set model as default | POST /api/v1/admin/models/set-default/{id} |
| MODEL-06 | Set model as multimodal | POST /api/v1/admin/models/set-multimodal/{id} |
| MODEL-07 | Validate deployment configuration | POST /api/v1/admin/models/validate |
| LANG-01 | List all LLM languages | GET /api/v1/admin/languages |
| LANG-02 | Add new language | POST /api/v1/admin/languages/add |
| LANG-03 | Edit language details | POST /api/v1/admin/languages/edit/{id} |
| LANG-04 | Toggle language active status | Handled via edit endpoint |
| LANG-05 | Delete language | POST /api/v1/admin/languages/delete/{id} |

## User Constraints (from CONTEXT.md)

*No CONTEXT.md exists for this phase - full discretion on implementation approach.*

## Frontend Integration

The Phase 05 frontend already expects these endpoints:

### useModels Hook (`frontend/src/admin-app/src/hooks/useModels.ts`)
```typescript
GET  /api/v1/admin/models
POST /api/v1/admin/models/add
POST /api/v1/admin/models/edit/{id}
POST /api/v1/admin/models/delete/{id}
POST /api/v1/admin/models/set-default/{id}
POST /api/v1/admin/models/set-multimodal/{id}
POST /api/v1/admin/models/validate
```

### useLanguages Hook (`frontend/src/admin-app/src/hooks/useLanguages.ts`)
```typescript
GET  /api/v1/admin/languages
POST /api/v1/admin/languages/add
POST /api/v1/admin/languages/edit/{id}
POST /api/v1/admin/languages/delete/{id}
```

## Schema Definitions Needed

Add to `schemas.py`:

```python
# Model Config Admin Schemas (Phase 08)
class ModelConfigListResponse(SmartLibBase):
    """Response for list models endpoint."""
    success: bool = True
    data: Dict[str, Any] = {}  # Contains items list and total

class ModelConfigCreateRequest(SmartLibBase):
    """Request to create a model."""
    name: str
    deployment_name: str
    provider_id: Optional[int] = None
    temperature: Optional[float] = None
    streaming: bool = False
    description: Optional[str] = None
    is_default: bool = False

class ModelConfigCreateResponse(SmartLibBase):
    """Response for create model endpoint."""
    success: bool = True
    model: ModelConfigRead

class ModelConfigUpdateRequest(SmartLibBase):
    """Request to update a model (all fields optional)."""
    name: Optional[str] = None
    deployment_name: Optional[str] = None
    provider_id: Optional[int] = None
    temperature: Optional[float] = None
    streaming: Optional[bool] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None

class ModelConfigUpdateResponse(SmartLibBase):
    """Response for update model endpoint."""
    success: bool = True
    model: ModelConfigRead

class ModelConfigDeleteResponse(SmartLibBase):
    """Response for delete model endpoint."""
    success: bool = True
    message: str

class ModelConfigDefaultResponse(SmartLibBase):
    """Response for set default model endpoint."""
    success: bool = True
    message: str

class ModelConfigMultimodalResponse(SmartLibBase):
    """Response for set multimodal model endpoint."""
    success: bool = True
    message: str

class ModelValidationRequest(SmartLibBase):
    """Request to validate deployment configuration."""
    deployment_name: str
    temperature: Optional[float] = None
    streaming: bool = False
    provider_id: Optional[int] = None

class ModelValidationResponse(SmartLibBase):
    """Response for validation endpoint."""
    success: bool = True
    valid: bool
    message: str
    streaming_supported: Optional[bool] = None
    temperature_valid: Optional[bool] = None
    connectivity_ok: Optional[bool] = None

# LLM Language Admin Schemas (Phase 08)
class LLMLanguageListResponse(SmartLibBase):
    """Response for list languages endpoint."""
    success: bool = True
    data: Dict[str, Any] = {}  # Contains items list and total

class LLMLanguageCreateRequest(SmartLibBase):
    """Request to create a language."""
    language_code: str
    language_name: str
    is_active: bool = True

class LLMLanguageCreateResponse(SmartLibBase):
    """Response for create language endpoint."""
    success: bool = True
    message: str
    language: Dict[str, Any]

class LLMLanguageUpdateRequest(SmartLibBase):
    """Request to update a language."""
    language_code: str
    language_name: str
    is_active: bool

class LLMLanguageUpdateResponse(SmartLibBase):
    """Response for update language endpoint."""
    success: bool = True
    message: str
    language: Dict[str, Any]

class LLMLanguageDeleteResponse(SmartLibBase):
    """Response for delete language endpoint."""
    success: bool = True
    message: str
```

## Sources

### Primary (HIGH confidence)
- **Phase 07 Implementation** (`main_fastapi.py` lines 720-1100) - Provider endpoint patterns
- **Flask Admin Models** (`modules/admin_models.py`) - Existing business logic
- **Flask Admin Languages** (`modules/admin_languages.py`) - Existing business logic
- **SQLModel Models** (`modules/models.py`) - ModelConfig, LLMLanguage definitions
- **Frontend Hooks** (`frontend/src/admin-app/src/hooks/useModels.ts`, `useLanguages.ts`) - Expected API shape

### Secondary (MEDIUM confidence)
- **LLM Utils** (`modules/llm_utils.py`) - Deployment validation helpers
- **Phase 07 Plan Summary** (`.planning/phases/07-backend-llm-providers/07-PLAN-SUMMARY.md`) - Reference patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already established in Phase 1
- Architecture: HIGH - Follows Phase 07 provider patterns
- Pitfalls: MEDIUM - Inferred from Flask code analysis
- Code examples: HIGH - Directly adapted from Phase 07 implementation

**Research date:** 2026-02-27
**Valid until:** Codebase migration complete (Phase 08)
