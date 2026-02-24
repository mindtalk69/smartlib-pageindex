# Research: Phase 1 - API Foundation

**Phase Goal:** Analyze Flask endpoints and create FastAPI equivalents with CRUD API, authentication, and admin API

---

## What We Need to Know to Plan This Phase

### 1. Existing FastAPI Foundation

**Already in place:**
- `main_fastapi.py` - FastAPI app with lifespan context, SQLAdmin integration
- `database_fastapi.py` - Async engine (aiosqlite) + sync engine for SQLAdmin
- `modules/models.py` - 11 SQLModel models already defined
- `modules/crud_router.py` - Generic CRUD router with pagination

**SQLModel models ready:**
1. User - user_id (string PK), username, auth_provider, azure_oid, email, password_hash, is_admin, is_disabled, created_at
2. Group - group_id, name, description, created_by_user_id, created_at
3. Library - library_id, name, description, created_by_user_id, created_at
4. Knowledge - id, name, description, brand_manufacturer_organization, product_model_name_service, created_by_user_id, embedding_model
5. UploadedFile - file_id, user_id, library_id, knowledge_id, original_filename, stored_filename, file_size, upload_time, is_ocr, is_az_doci
6. MessageHistory - message_id, user_id, thread_id, message_text, answer, timestamp, citations, usage_metadata, suggested_questions, structured_query
7. LLMProvider - id, name, provider_type, base_url, api_key, is_active, is_default, priority, config, last_health_check, health_status, error_message
8. ModelConfig - id, provider_id, name, deployment_name, provider, temperature, streaming, description, is_default, created_by, created_at
9. AppSettings - key (string PK), value
10. LLMPrompt - id, name, content, description, is_active, created_at, updated_at
11. LLMLanguage - id, language_code, language_name, is_active, created_by, created_at

**Current main_fastapi.py endpoints:**
- `GET /` - Root health check
- SQLAdmin views registered for all 11 models at `/admin`
- CRUDRouter registered for all models at `/api/v1/{model}`

### 2. Gaps to Fill

**Missing from current FastAPI:**

1. **Authentication Layer**
   - JWT token generation and validation
   - Password hashing (bcrypt/argon2)
   - Login/register/logout endpoints
   - `get_current_user` dependency for protected routes
   - Session management (replacing Flask session with JWT)

2. **Enhanced CRUDRouter**
   - Currently has basic CRUD but may need filtering/sorting
   - May need custom endpoints per model

3. **CORS Configuration**
   - Need to add CORSMiddleware for React frontend domains

4. **Admin-Specific API Endpoints**
   - User management (toggle admin, toggle status)
   - System statistics
   - Provider/model management beyond basic CRUD

5. **Flask Parity for P0 Routes**
   - `/api/login` → FastAPI `/api/v1/auth/login`
   - `/api/me` → FastAPI `/api/v1/auth/me`
   - `/api/logout` → FastAPI `/api/v1/auth/logout`
   - `/api/config` → FastAPI `/api/v1/config`
   - `/api/branding` → FastAPI `/api/v1/branding`
   - `/api/libraries` → FastAPI `/api/v1/libraries`
   - `/api/knowledges` → FastAPI `/api/v1/knowledges`

### 3. Flask Logic to Port

**From `modules/api_auth.py`:**
- `/api/login` (POST) - User authentication, returns user data
- `/api/me` (GET) - Get current user info
- `/api/logout` (POST/GET) - Clear session
- `/api/config` (GET) - App configuration
- `/api/branding` (GET) - Branding settings
- `/api/libraries` (GET) - List libraries for user
- `/api/knowledges` (GET) - List knowledges for user
- `/api/document_content` (GET) - Get document content

**From `modules/login.py`:**
- Login form handling
- Password validation
- Session management

**From `modules/register.py`:**
- User registration with email/password
- Password hashing
- Duplicate user check

### 4. Technical Decisions Needed

**Authentication:**
- JWT vs session-based? → JWT recommended for FastAPI + React
- Where to store tokens? → HttpOnly cookies or localStorage
- Token expiry? → 7 days refresh, 1 hour access
- Password hashing? → bcrypt (industry standard)

**Dependencies:**
- `PyJWT` or `python-jose` for JWT
- `passlib[bcrypt]` for password hashing
- `fastapi.middleware.cors` for CORS
- `python-multipart` for form data

**Async Considerations:**
- Database: Already using aiosqlite ✓
- Password hashing: Run in executor (blocking)
- JWT encoding: Synchronous (fast enough)

### 5. File Structure to Create

```
smartlib-basic/
├── main_fastapi.py          # Extend with auth routes
├── database_fastapi.py      # Already good
├── modules/
│   ├── models.py            # Already good
│   ├── crud_router.py       # Already good
│   ├── auth.py              # NEW - JWT auth logic
│   └── schemas.py           # NEW - Pydantic schemas for auth
└── api/
│   └── v1/
│       ├── auth.py          # NEW - Auth endpoints
│       ├── config.py        # NEW - Config/branding endpoints
│       └── __init__.py      # NEW - API router aggregation
└── .planning/
    └── phases/
        └── 01-api-foundation/
            └── 1-PLAN.md    # To be created
```

### 6. Test Strategy

**Unit Tests:**
- JWT token generation and validation
- Password hashing and verification
- CRUD operations per model

**Integration Tests:**
- Auth flow: register → login → protected endpoint → logout
- CRUD endpoint responses match Flask equivalents

**Manual Verification:**
- `/docs` shows all endpoints
- `/admin` accessible with proper auth
- CORS allows React frontend

---

## Recommended Implementation Approach

1. **Start with auth.py** - Core authentication utilities
2. **Add auth endpoints** - `/api/v1/auth/login`, `/register`, `/logout`, `/me`
3. **Extend CRUDRouter** - Ensure pagination, filtering work
4. **Add CORS middleware** - Configure for React domains
5. **Create config/branding endpoints** - Match Flask behavior
6. **Test with existing React /app** - Verify API compatibility

---
*Research completed: 2026-02-24*
