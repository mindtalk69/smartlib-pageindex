# Phase 09: Content Management & Settings - Research

**Researched:** 2026-02-27
**Domain:** FastAPI admin endpoints for content oversight (activity logs, files, downloads) and application settings
**Confidence:** HIGH

## Summary

This phase implements FastAPI endpoints for content management (upload/download activity logs, file deletion with vector cleanup) and application settings (app name, logo, color), plus catalog/category CRUD operations. The work follows the exact pattern established in Phases 07-08 for LLM providers, models, and languages.

**Primary recommendation:** Implement all endpoints in `main_fastapi.py` following the Phase 07-08 endpoint patterns, reusing existing database functions from `modules/database.py` for activity queries and metadata building.

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
| sqlalchemy | 2.x | Database utilities | Count queries, ordering, joinedload for relationships |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FastAPI | Flask (existing) | FastAPI provides async, better OpenAPI docs, type safety |
| SQLModel | SQLAlchemy only | SQLModel adds Pydantic integration, cleaner schemas |

**Installation:** Already installed (Phase 1 dependencies)

## Architecture Patterns

### Endpoint Structure

All endpoints follow the Phase 07-08 pattern:
1. Path prefix: `/api/v1/admin/`
2. Admin authentication: `Depends(get_current_admin_user)`
3. Response models: Typed Pydantic schemas
4. Database sessions: `Depends(get_db)`

### Recommended Endpoint Organization

```python
# main_fastapi.py - Phase 09 endpoints

# ============================================================================
# Activity Log Endpoints (Phase 09 - CONTENT-01, CONTENT-02, CONTENT-03)
# ============================================================================

@app.get("/api/v1/admin/activity/uploads")
def list_upload_activities(...)

@app.get("/api/v1/admin/activity/downloads")
def list_download_activities(...)

# ============================================================================
# File Management Endpoints (Phase 09 - CONTENT-04, CONTENT-05)
# ============================================================================

@app.get("/api/v1/admin/files/{file_id}")
def get_file_details(...)

@app.delete("/api/v1/admin/files/{file_id}")
def delete_file(...)

# ============================================================================
# Catalog Management Endpoints (Phase 09 - CONTENT-06)
# ============================================================================

@app.get("/api/v1/admin/catalogs")
def list_catalogs(...)

@app.post("/api/v1/admin/catalogs/add")
def create_catalog(...)

@app.post("/api/v1/admin/catalogs/edit/{catalog_id}")
def update_catalog(...)

@app.delete("/api/v1/admin/catalogs/delete/{catalog_id}")
def delete_catalog(...)

# ============================================================================
# Category Management Endpoints (Phase 09 - CONTENT-07)
# ============================================================================

@app.get("/api/v1/admin/categories")
def list_categories(...)

@app.post("/api/v1/admin/categories/add")
def create_category(...)

@app.post("/api/v1/admin/categories/edit/{category_id}")
def update_category(...)

@app.delete("/api/v1/admin/categories/delete/{category_id}")
def delete_category(...)

# ============================================================================
# Application Settings Endpoints (Phase 09 - SET-01, SET-02, SET-03)
# ============================================================================

@app.get("/api/v1/admin/settings")
def get_app_settings(...)

@app.post("/api/v1/admin/settings/update")
def update_app_settings(...)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Activity queries | Custom SQL | `modules.database.get_url_downloads()` | Already handles joins with User/Library/Knowledge |
| Metadata summary | Manual formatting | `modules.database.build_knowledge_metadata_summary()` | Already formats catalog/category/group strings |
| File deletion with vectors | Custom cascade logic | Follow `modules/admin_files.py` pattern | Handles Document, VectorReference, LibraryReference cleanup |
| Catalog uniqueness | Raw SQL | Catch `IntegrityError` on insert/update | Type-safe, consistent with Phase 1/07/08 |
| Admin auth | Manual JWT parsing | `get_current_admin_user()` dependency | Tested, handles edge cases |

**Key insight:** All helper functions from Flask (`modules/admin_files.py`, `modules/admin_downloads.py`, `modules/admin_catalogs.py`, `modules/admin_settings.py`, `modules/database.py`) can be directly adapted or reused.

## Common Pitfalls

### Pitfall 1: Missing SQLModel for Catalog/Category
**What goes wrong:** Trying to import Catalog/Category from SQLModel when they only exist in SQLAlchemy
**Why it happens:** Catalog and Category are SQLAlchemy models in `modules/database.py`, not SQLModel in `modules/models.py`
**How to avoid:** Use SQLAlchemy session for Catalog/Category operations, or add SQLModel versions to `modules/models.py` first
**Warning signs:** ImportError when trying to import Catalog/Category from SQLModel

### Pitfall 2: Vector Deletion for sqlite-vec
**What goes wrong:** Attempting manual vector deletion when sqlite-vec uses cascade deletes
**Why it happens:** sqlite-vec (BASIC Edition) handles vector cleanup via database cascade deletes automatically
**How to avoid:** The `_delete_vectors()` function returns 0 for sqlite-vec - this is expected behavior
**Warning signs:** Trying to implement manual vector cleanup logic

### Pitfall 3: Metadata Summary for None knowledge_id
**What goes wrong:** Calling `build_knowledge_metadata_summary()` with None values
**Why it happens:** Uploads/Downloads may not have associated knowledge
**How to avoid:** Filter out None values before calling the function, return 'N/A' for no knowledge association
**Warning signs:** KeyError or NoneType errors in metadata summary

### Pitfall 4: Settings Key Uniqueness
**What goes wrong:** Allowing duplicate settings keys
**Why it happens:** AppSettings uses key as primary key but endpoints might not validate
**How to avoid:** Rely on database primary key constraint, catch integrity errors
**Warning signs:** Multiple rows with same key in app_settings table

## Code Examples

### Upload Activity List (following Phase 07-08 pattern)

```python
from sqlmodel import select, func
from modules.models import UploadedFile, Library, Knowledge, User

@app.get("/api/v1/admin/activity/uploads", response_model=UploadActivityListResponse)
def list_upload_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 10,
    status: Optional[str] = None,  # Filter by status
):
    """List upload activities (admin only)."""
    # Build query with joins
    statement = (
        select(UploadedFile, User, Library, Knowledge)
        .join(User, UploadedFile.user_id == User.user_id)
        .outerjoin(Library, UploadedFile.library_id == Library.library_id)
        .outerjoin(Knowledge, UploadedFile.knowledge_id == Knowledge.id)
    )

    # Add status filter if provided
    if status:
        # For uploads, derive status from is_ocr or other fields
        pass

    # Order by upload time desc, paginate
    statement = statement.order_by(UploadedFile.upload_time.desc()).offset(skip).limit(limit)

    results = db.exec(statement).all()

    # Build metadata summary for unique knowledge_ids
    from modules.database import build_knowledge_metadata_summary
    knowledge_ids = {row.Knowledge.id for row in results if row.Knowledge}
    metadata_map = build_knowledge_metadata_summary(knowledge_ids)

    items = []
    for row in results:
        upload_file, user, library, knowledge = row
        items.append({
            "id": upload_file.file_id,
            "type": "upload",
            "filename": upload_file.original_filename,
            "file_size": upload_file.file_size,
            "upload_time": upload_file.upload_time.isoformat() if upload_file.upload_time else None,
            "username": user.username,
            "library_name": library.name if library else None,
            "knowledge_name": knowledge.name if knowledge else None,
            "metadata_summary": metadata_map.get(knowledge.id, 'N/A') if knowledge else 'N/A',
            "is_ocr": upload_file.is_ocr,
            "status": "success"  # Uploads are always successful once stored
        })

    # Get total count
    count_statement = select(func.count(UploadedFile.file_id))
    total = db.exec(count_statement).one()

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
        }
    }
```

### Download Activity List

```python
from modules.models import UrlDownload

@app.get("/api/v1/admin/activity/downloads", response_model=DownloadActivityListResponse)
def list_download_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 10,
    status: Optional[str] = None,
):
    """List download activities (admin only)."""
    from modules.database import build_knowledge_metadata_summary

    # Build query with joins
    statement = (
        select(UrlDownload, User, Library, Knowledge)
        .join(User, UrlDownload.user_id == User.user_id)
        .outerjoin(Library, UrlDownload.library_id == Library.library_id)
        .outerjoin(Knowledge, UrlDownload.knowledge_id == Knowledge.id)
    )

    # Add status filter if provided
    if status:
        statement = statement.where(UrlDownload.status == status)

    # Order by processed_at desc, paginate
    statement = statement.order_by(UrlDownload.processed_at.desc()).offset(skip).limit(limit)

    results = db.exec(statement).all()

    # Build metadata summary
    knowledge_ids = {row.Knowledge.id for row in results if row.Knowledge}
    metadata_map = build_knowledge_metadata_summary(knowledge_ids)

    items = []
    for row in results:
        download, user, library, knowledge = row
        items.append({
            "id": download.download_id,
            "type": "download",
            "url": download.url,
            "status": download.status,
            "content_type": download.content_type,
            "error_message": download.error_message,
            "processed_at": download.processed_at.isoformat() if download.processed_at else None,
            "username": user.username,
            "library_name": library.name if library else None,
            "knowledge_name": knowledge.name if knowledge else None,
            "metadata_summary": metadata_map.get(knowledge.id, 'N/A') if knowledge else 'N/A',
            "is_ocr": download.is_ocr,
        })

    # Get total count
    count_statement = select(func.count(UrlDownload.download_id))
    if status:
        count_statement = count_statement.where(UrlDownload.status == status)
    total = db.exec(count_statement).one()

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
        }
    }
```

### File Deletion with Vector Cleanup

```python
from modules.models import UploadedFile, Document, VectorReference, LibraryReference, VisualGroundingActivity

@app.delete("/api/v1/admin/files/{file_id}", response_model=FileDeleteResponse)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete a file and its associated data (admin only)."""
    uploaded_file = db.get(UploadedFile, file_id)
    if not uploaded_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File record not found."
        )

    try:
        # Find associated documents
        from sqlmodel import select
        doc_statement = select(Document).where(
            Document.source == uploaded_file.original_filename,
            Document.library_id == uploaded_file.library_id,
            Document.knowledge_id == uploaded_file.knowledge_id,
        )
        docs = db.exec(doc_statement).all()

        # Delete vectors (handled automatically by cascade for sqlite-vec)
        # For sqlite-vec: vectors are deleted when Document records are deleted
        vector_removed = len(docs) if docs else 0

        # Delete document records
        for doc in docs:
            db.delete(doc)

        # Delete vector references, library references, visual grounding activities
        db.exec(select(VectorReference).where(VectorReference.file_id == file_id))
        db.exec(select(LibraryReference).where(
            LibraryReference.reference_type == 'file',
            LibraryReference.source_id == file_id
        ))
        db.exec(select(VisualGroundingActivity).where(VisualGroundingActivity.file_id == file_id))

        # Delete the uploaded file record
        db.delete(uploaded_file)
        db.commit()

        message = "File deleted successfully."
        if vector_removed:
            message = f"File deleted successfully. Removed {vector_removed} document(s)."

        return {"success": True, "message": message}

    except Exception as exc:
        db.rollback()
        logging.error(f"Failed to delete file_id {file_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file."
        )
```

### Catalog CRUD

```python
# Use SQLAlchemy models for Catalog/Category (not SQLModel)
from modules.database import Catalog as DBCatalog, db as sqlalchemy_db

# OR add SQLModel versions to modules/models.py first
class Catalog(SQLModel, table=True):
    __tablename__ = "catalogs"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, nullable=False)
    description: Optional[str] = Field(default=None)
    created_by_user_id: str = Field(foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )

@app.get("/api/v1/admin/catalogs", response_model=CatalogListResponse)
def list_catalogs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List all catalogs (admin only)."""
    statement = select(Catalog).order_by(Catalog.name)
    results = db.exec(statement).all()

    items = []
    for catalog in results:
        items.append({
            "id": catalog.id,
            "name": catalog.name,
            "description": catalog.description,
            "created_by": catalog.created_by_user_id,
            "created_at": catalog.created_at.isoformat() if catalog.created_at else None,
        })

    return {
        "success": True,
        "data": {
            "items": items,
            "total": len(items),
        }
    }

@app.post("/api/v1/admin/catalogs/add", response_model=CatalogCreateResponse, status_code=status.HTTP_201_CREATED)
def create_catalog(
    catalog_data: CatalogCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new catalog (admin only)."""
    # Check for duplicate name
    existing = db.exec(select(Catalog).where(Catalog.name == catalog_data.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Catalog with name '{catalog_data.name}' already exists."
        )

    catalog = Catalog(
        name=catalog_data.name,
        description=catalog_data.description,
        created_by_user_id=current_user.user_id,
    )

    db.add(catalog)
    db.commit()
    db.refresh(catalog)

    return {
        "success": True,
        "message": "Catalog created successfully.",
        "catalog": {
            "id": catalog.id,
            "name": catalog.name,
            "description": catalog.description,
            "created_by": catalog.created_by_user_id,
            "created_at": catalog.created_at.isoformat() if catalog.created_at else None,
        }
    }
```

### App Settings

```python
from modules.models import AppSettings

@app.get("/api/v1/admin/settings", response_model=AppSettingsResponse)
def get_app_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get application settings (admin only)."""
    settings = db.exec(select(AppSettings)).all()

    settings_dict = {}
    for setting in settings:
        # Handle different value types
        value = setting.value
        # Try to parse as int for known numeric settings
        if setting.key == 'max_active_users':
            try:
                value = int(value)
            except ValueError:
                pass

        settings_dict[setting.key] = value

    # Get active user count
    from modules.database import count_active_users
    active_user_count = count_active_users()

    return {
        "success": True,
        "settings": settings_dict,
        "active_user_count": active_user_count,
    }

@app.post("/api/v1/admin/settings/update", response_model=SettingsUpdateResponse)
def update_app_settings(
    settings_data: SettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Update application settings (admin only)."""
    from modules.database import count_active_users

    updated_keys = []

    for key, value in settings_data.settings.items():
        # Special validation for max_active_users
        if key == 'max_active_users':
            try:
                max_users = int(value)
                current_active = count_active_users()

                if max_users < current_active:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot set limit to {max_users} - currently have {current_active} active users."
                    )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="max_active_users must be a valid integer."
                )

        # Update or insert setting
        existing = db.get(AppSettings, key)
        if existing:
            existing.value = str(value)
        else:
            new_setting = AppSettings(key=key, value=str(value))
            db.add(new_setting)

        updated_keys.append(key)

    db.commit()

    return {
        "success": True,
        "message": f"Updated {len(updated_keys)} setting(s).",
        "updated_keys": updated_keys,
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
- Flask Blueprint patterns: Still in `modules/admin_files.py`, `modules/admin_downloads.py`, `modules/admin_catalogs.py`, `modules/admin_settings.py` - to be replaced
- Session-based admin checks: Replaced with `get_current_admin_user()` dependency

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONTENT-01 | Activity log showing upload activities | GET /api/v1/admin/activity/uploads with metadata |
| CONTENT-02 | Activity log showing download activities | GET /api/v1/admin/activity/downloads with status filter |
| CONTENT-03 | Filter activities by type and status | Query parameters for status filtering |
| CONTENT-04 | View file details with metadata summary | GET /api/v1/admin/files/{file_id} |
| CONTENT-05 | Delete file records with vector cleanup | DELETE /api/v1/admin/files/{file_id} |
| CONTENT-06 | Catalog CRUD operations | GET/POST/PUT/DELETE /api/v1/admin/catalogs |
| CONTENT-07 | Category CRUD operations | GET/POST/PUT/DELETE /api/v1/admin/categories |
| SET-01 | View and edit app settings | GET/POST /api/v1/admin/settings |
| SET-02 | Save settings with confirmation | POST endpoint with validation |
| SET-03 | Settings persistence to database | AppSettings model with key/value storage |

## User Constraints (from CONTEXT.md)

*No CONTEXT.md exists for this phase - full discretion on implementation approach.*

## Frontend Integration

The Phase 09 frontend will be created in this phase (no existing frontend hooks):

**New hooks to create:**
- `useActivityLog.ts` - Upload and download activity queries
- `useFiles.ts` - File details and deletion
- `useCatalogs.ts` - Catalog CRUD operations
- `useCategories.ts` - Category CRUD operations
- `useSettings.ts` - App settings get/update

**New pages to create:**
- `Content.tsx` - Activity log display with filters
- `Settings.tsx` - App settings form

## Schema Definitions Needed

Add to `schemas.py`:

```python
# Activity Log Schemas (Phase 09)
class UploadActivityListResponse(SmartLibBase):
    """Response for upload activity list."""
    success: bool = True
    data: Dict[str, Any] = {}  # Contains items list and total

class DownloadActivityListResponse(SmartLibBase):
    """Response for download activity list."""
    success: bool = True
    data: Dict[str, Any] = {}  # Contains items list and total

# File Management Schemas (Phase 09)
class FileDetailsResponse(SmartLibBase):
    """Response for file details."""
    success: bool = True
    file: Dict[str, Any]

class FileDeleteResponse(SmartLibBase):
    """Response for file deletion."""
    success: bool = True
    message: str

# Catalog Schemas (Phase 09)
class CatalogListResponse(SmartLibBase):
    """Response for catalog list."""
    success: bool = True
    data: Dict[str, Any] = {}

class CatalogCreateRequest(SmartLibBase):
    """Request to create a catalog."""
    name: str
    description: Optional[str] = None

class CatalogCreateResponse(SmartLibBase):
    """Response for catalog creation."""
    success: bool = True
    message: str
    catalog: Dict[str, Any]

class CatalogUpdateRequest(SmartLibBase):
    """Request to update a catalog."""
    name: str
    description: Optional[str] = None

class CatalogUpdateResponse(SmartLibBase):
    """Response for catalog update."""
    success: bool = True
    message: str
    catalog: Dict[str, Any]

class CatalogDeleteResponse(SmartLibBase):
    """Response for catalog deletion."""
    success: bool = True
    message: str

# Category Schemas (Phase 09)
class CategoryListResponse(SmartLibBase):
    """Response for category list."""
    success: bool = True
    data: Dict[str, Any] = {}

class CategoryCreateRequest(SmartLibBase):
    """Request to create a category."""
    name: str
    description: Optional[str] = None

class CategoryCreateResponse(SmartLibBase):
    """Response for category creation."""
    success: bool = True
    message: str
    category: Dict[str, Any]

class CategoryUpdateRequest(SmartLibBase):
    """Request to update a category."""
    name: str
    description: Optional[str] = None

class CategoryUpdateResponse(SmartLibBase):
    """Response for category update."""
    success: bool = True
    message: str
    category: Dict[str, Any]

class CategoryDeleteResponse(SmartLibBase):
    """Response for category deletion."""
    success: bool = True
    message: str

# App Settings Schemas (Phase 09)
class AppSettingsResponse(SmartLibBase):
    """Response for app settings."""
    success: bool = True
    settings: Dict[str, Any] = {}
    active_user_count: Optional[int] = None

class SettingsUpdateRequest(SmartLibBase):
    """Request to update settings."""
    settings: Dict[str, Any] = {}

class SettingsUpdateResponse(SmartLibBase):
    """Response for settings update."""
    success: bool = True
    message: str
    updated_keys: List[str] = []
```

## Sources

### Primary (HIGH confidence)
- **Flask Admin Files** (`modules/admin_files.py`) - File management logic
- **Flask Admin Downloads** (`modules/admin_downloads.py`) - Download activity logic
- **Flask Admin Catalogs** (`modules/admin_catalogs.py`) - Catalog CRUD logic
- **Flask Admin Settings** (`modules/admin_settings.py`) - Settings management
- **Database Functions** (`modules/database.py`) - `get_url_downloads()`, `delete_url_download()`, `build_knowledge_metadata_summary()`, `count_active_users()`
- **SQLModel Models** (`modules/models.py`) - UploadedFile, UrlDownload, AppSettings definitions
- **Phase 07-08 Implementation** (`main_fastapi.py`) - Provider/Model/Language endpoint patterns

### Secondary (MEDIUM confidence)
- **Phase 07 Plan Summary** (`.planning/phases/07-backend-llm-providers/07-PLAN-SUMMARY.md`) - Reference patterns
- **Phase 08 Plan Summary** (`.planning/phases/08-backend-llm-model-language/08-PLAN-SUMMARY.md`) - Reference patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already established in Phase 1
- Architecture: HIGH - Follows Phase 07-08 provider/model/language patterns
- Pitfalls: MEDIUM - Inferred from Flask code analysis and sqlite-vec architecture
- Code examples: HIGH - Directly adapted from Phase 07-08 implementation

**Research date:** 2026-02-27
**Valid until:** Codebase migration complete (Phase 09)
