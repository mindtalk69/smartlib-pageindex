# Architecture: SmartLib BASIC FastAPI Migration

## Current Architecture (Flask)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│    Flask    │────▶│   SQLite    │
│   (static)  │     │  (app.py)   │     │  + sqlite-vec│
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Redis    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Celery    │
                    │   Worker    │
                    └─────────────┘
```

## Target Architecture (FastAPI)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│   FastAPI   │────▶│   SQLite    │
│   (port 80) │     │ (main_      │     │  + sqlite-vec│
│             │     │  fastapi.py)│     └─────────────┘
│             │────▶│             │
│             │     │  + SQLAdmin │
│             │     │  (port 8001)│
└─────────────┘     └──────┬──────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │    Redis    │
       │            └──────┬──────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │   Celery    │
       │            │   Worker    │
       │            └─────────────┘
       │
       │ (during migration)
       │
       ▼
┌─────────────┐
│    Flask    │
│  (port 5000)│
└─────────────┘
```

## Component Boundaries

### 1. API Layer (FastAPI)
**Location:** `main_fastapi.py`, `modules/crud_router.py`

**Responsibilities:**
- REST API endpoints for all models
- Authentication/authorization
- Request validation via Pydantic
- OpenAPI documentation

**Files to Create/Modify:**
- `main_fastapi.py` - Main app entry (exists, needs API expansion)
- `modules/crud_router.py` - Generic CRUD operations (exists)
- `modules/auth.py` - JWT authentication (new)
- `api/v1/*.py` - Domain-specific routers (new)

### 2. Admin Dashboard (SQLAdmin)
**Location:** `main_fastapi.py` (embedded)

**Responsibilities:**
- CRUD UI for all database models
- User management
- System configuration

**Files to Create/Modify:**
- `main_fastapi.py` - Admin views already configured
- Potentially extract to `admin/views.py` if grows too large

### 3. Frontend - User App (/app)
**Location:** `frontend/`

**Responsibilities:**
- Document upload UI
- Library/Knowledge management
- RAG chat interface
- User profile

**Files to Create/Modify:**
- React components in `frontend/src/`
- API client using TanStack Query

### 4. Frontend - Admin App (/admin-app)
**Location:** `admin-frontend/`

**Responsibilities:**
- User management
- System configuration
- Analytics dashboard

**Note:** SQLAdmin may replace most of this

### 5. Background Processing (Celery)
**Location:** `celery_app.py`, `modules/celery_tasks.py`

**Responsibilities:**
- Document OCR processing
- Vector generation
- Email notifications

**No changes needed** - stays as-is

## Data Flow

### Document Upload
```
User → React → FastAPI (/api/v1/files) → DB (UploadedFile record)
                                    → Celery (async OCR + vector generation)
                                    → DB (Knowledge records + vectors)
```

### RAG Query
```
User → React → FastAPI (/api/v1/chat) → LangGraph Agent
                                           │
                                           ▼
                                    sqlite-vec (similarity search)
                                           │
                                           ▼
                                    LLM Provider API
                                           │
                                           ▼
User ← React ← Streaming Response ←────────┘
```

## Build Order (Phase Structure)

**Phase 1: API Foundation**
- Complete CRUD API for all models
- Authentication layer

**Phase 2: Frontend - User App**
- Connect React to FastAPI
- Document upload/management

**Phase 3: Frontend - Admin**
- SQLAdmin customization
- Or React admin if needed

**Phase 4: RAG Integration**
- Migrate chat endpoint to FastAPI
- LangGraph agent integration

**Phase 5: Coexistence & Migration**
- Nginx routing setup
- Flask deprecation plan

---
*Last updated: 2026-02-24*
