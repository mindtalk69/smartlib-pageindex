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
│             │     │  (port 8001)│
│             │     └──────┬──────┘
│             │            │
│             │            ▼
│             │     ┌─────────────┐
│             │     │    Redis    │
│             │     └──────┬──────┘
│             │            │
│             │            ▼
│             │     ┌─────────────┐
│             │     │   Celery    │
│             │     │   Worker    │
│             │     └─────────────┘
│             │
│             │ (during migration)
│             │
│             ▼
│     ┌─────────────┐
│     │    Flask    │
│     │  (port 5000)│
│     └──────┬──────┘
│            │
│            ▼
│     ┌─────────────┐
│     │ React /app  │
│     │  (existing) │
│     └─────────────┘
│
└──▶ React Builds
     - /app (user)
     - /admin-app (admin)
```

**Nginx Routing:**
- `/api/v1/*` → FastAPI (new API endpoints)
- `/admin-app/*` → React admin build
- `/app/*` → React user build (or Flask during transition)
- `/*` → Flask (legacy catch-all during transition)

**Migration Path for /app:**
1. Initially: /app calls Flask (proven working)
2. Phase 2: FastAPI endpoints compatible with /app API contracts
3. Phase 5: Feature flag to switch /app to FastAPI
4. Final: All /app API calls → FastAPI, Flask deprecated

## Flask to FastAPI Migration Strategy

**Key Insight:** The fastest path is to analyze existing Flask endpoints in `app.py` and `main.py`, then create equivalent FastAPI endpoints.

**Flask Endpoints to Analyze:**
1. Read `app.py` - main Flask application with all routes
2. Read `main.py` - additional routes
3. Identify all `@app.route` decorators
4. Map each Flask route to FastAPI equivalent

**Migration Approach:**
```
Flask Route → FastAPI Router
@app.route('/api/xyz', methods=['POST']) → @router.post('/api/v1/xyz')
Flask request.json → FastAPI Body()
Flask jsonify() → FastAPI return dict
Flask @login_required → FastAPI Depends(get_current_user)
```

**Files to Analyze First:**
1. `app.py` - All Flask routes (primary)
2. `main.py` - Additional routes
3. `modules/` - Shared logic to reuse
4. `config.py` - Configuration to port

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

### 2. Admin Frontend (/admin-app)
**Location:** `admin-frontend/`

**Responsibilities:**
- Custom React admin UI to replace SQLAdmin
- User management
- System configuration
- LLM provider/model management

**Files to Create/Modify:**
- React components in `admin-frontend/src/`
- API client using TanStack Query

### 3. Frontend - User App (/app)
**Location:** `frontend/`

**Responsibilities:**
- Document upload UI
- Library/Knowledge management
- RAG chat interface
- User profile

**Migration Strategy:**
- Currently calls Flask (existing, working)
- Phase 2: Ensure FastAPI has compatible endpoints
- Phase 5: Gradual switchover via feature flag
- Eventually: All API calls to FastAPI

**Files to Create/Modify:**
- Existing React components (already working)
- API client configuration (base URL switch)

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
