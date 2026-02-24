# Plan: Phase 1 - API Foundation

**Phase Goal:** Analyze Flask endpoints and create FastAPI equivalents with CRUD API, authentication, and admin API

**Requirements:**
- API-01: All models have CRUD endpoints via CRUDRouter
- API-02: OpenAPI documentation available at /docs
- API-03: Authentication middleware protects protected endpoints
- API-04: CORS configured for frontend domains
- API-05: Pagination on list endpoints
- AUTH-01: User can register with email and password
- AUTH-02: User can log in and receive JWT token
- AUTH-03: User can log out (invalidate token)
- AUTH-04: User session persists across page refresh
- AUTH-05: Admin users can manage other users (enable/disable, set roles)
- ADM-01: Admin can view all users in SQLAdmin
- ADM-02: Admin can set user roles (admin/regular)

---

## Wave 1: Authentication Layer

**Depends on:** None
**Autonomous:** true

### Tasks

1. **Install auth dependencies**
   ```bash
   pip install python-jose[cryptography] passlib[bcrypt] python-multipart
   ```

2. **Create `modules/auth.py`** - Core authentication utilities:
   - `password_hasher` - bcrypt password hashing/verification
   - `create_access_token` - JWT token generation with expiry
   - `decode_access_token` - JWT token validation
   - `get_current_user` - FastAPI Depends() for protected routes
   - `authenticate_user` - Login credential validation

3. **Create `modules/schemas.py`** - Pydantic schemas for auth:
   - `Token` - JWT token response
   - `TokenData` - Decoded token payload
   - `UserCreate` - Registration request
   - `UserLogin` - Login request
   - `UserResponse` - User data response

4. **Extend `main_fastapi.py`**:
   - Add CORS middleware configuration
   - Import auth modules
   - Add auth endpoints (`/api/v1/auth/login`, `/register`, `/logout`, `/me`)

5. **Verify**: Run `python main_fastapi.py`, visit `/docs`, test auth endpoints

---

## Wave 2: CRUDRouter Enhancement

**Depends on:** Wave 1 (auth layer)
**Autonomous:** true

### Tasks

1. **Review existing `modules/crud_router.py`**:
   - Check pagination implementation
   - Verify filtering/sorting support
   - Ensure auth dependency integration

2. **Enhance CRUDRouter if needed**:
   - Add `Depends(get_current_user)` to all endpoints
   - Ensure pagination params work (`skip`, `limit`)
   - Add filtering by query params

3. **Register all model routers in `main_fastapi.py`**:
   - Import CRUDRouter for each model
   - Mount at `/api/v1/{model}`
   - Verify OpenAPI docs show all endpoints

4. **Verify**: Visit `/docs`, check all 11 models have CRUD endpoints with auth

---

## Wave 3: Config & Branding Endpoints

**Depends on:** Wave 1 (auth layer)
**Autonomous:** true

### Tasks

1. **Create `api/v1/config.py`** - Config endpoint:
   - Port logic from `modules/api_auth.py` `/api/config`
   - Return app configuration (features, settings)
   - Protect with auth dependency

2. **Create `api/v1/branding.py`** - Branding endpoint:
   - Port logic from `modules/api_auth.py` `/api/branding`
   - Return branding settings (logo, colors, etc.)
   - Public endpoint (no auth required)

3. **Create `api/v1/__init__.py`** - API router aggregation:
   - Combine all v1 routers
   - Export `api_router` for main app

4. **Mount routers in `main_fastapi.py`**:
   - Include config and branding routers
   - Test endpoints via `/docs`

5. **Verify**: Test `/api/v1/config` and `/api/v1/branding` return expected data

---

## Wave 4: Admin User Management API

**Depends on:** Wave 1 (auth layer), Wave 2 (CRUD)
**Autonomous:** true

### Tasks

1. **Create `api/v1/admin/users.py`** - Admin user management:
   - Port from `modules/admin_users.py`:
     - `GET /api/v1/admin/users` - List all users (admin only)
     - `GET /api/v1/admin/users/{user_id}` - Get user details
     - `PUT /api/v1/admin/users/{user_id}` - Update user (toggle admin/status)
     - `POST /api/v1/admin/users/{user_id}/reset-password` - Force password reset
   - Add `Depends(get_current_admin_user)` for admin-only protection

2. **Add admin stats endpoint**:
   - `GET /api/v1/admin/stats` - System statistics
   - User count, file count, etc.

3. **Register in `main_fastapi.py`**:
   - Mount admin router at `/api/v1/admin`
   - Verify in `/docs`

4. **Verify**: Test admin endpoints require admin role, return correct data

---

## Wave 5: Integration Testing

**Depends on:** Waves 1-4
**Autonomous:** false

### Tasks

1. **Test auth flow end-to-end**:
   ```bash
   # Register
   curl -X POST http://localhost:8001/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'

   # Login
   curl -X POST http://localhost:8001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'

   # Get current user (with token)
   curl http://localhost:8001/api/v1/auth/me \
     -H "Authorization: Bearer <token>"
   ```

2. **Test CRUD endpoints**:
   - List users, libraries, knowledges with pagination
   - Verify auth required on protected endpoints

3. **Test admin endpoints**:
   - Verify admin-only endpoints reject non-admin users
   - Test toggle admin/status functionality

4. **Verify React /app compatibility**:
   - Compare FastAPI responses with Flask equivalents
   - Ensure API contract matches

---

## Must Haves (for Verification)

1. **Auth endpoints working**: `/api/v1/auth/login`, `/register`, `/logout`, `/me`
2. **JWT protects routes**: Protected endpoints reject unauthenticated requests
3. **All 11 models exposed**: CRUD endpoints at `/api/v1/{model}`
4. **Pagination works**: List endpoints accept `skip` and `limit` params
5. **CORS configured**: React frontend can call API without CORS errors
6. **OpenAPI docs complete**: `/docs` shows all endpoints with schemas
7. **Admin endpoints ready**: User management API for React admin frontend

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `modules/auth.py` | Create | JWT auth utilities |
| `modules/schemas.py` | Create | Pydantic auth schemas |
| `api/v1/__init__.py` | Create | API router aggregation |
| `api/v1/config.py` | Create | Config endpoint |
| `api/v1/branding.py` | Create | Branding endpoint |
| `api/v1/admin/users.py` | Create | Admin user management |
| `main_fastapi.py` | Modify | Add auth, CORS, mount routers |
| `modules/crud_router.py` | Modify | Add auth dependency if needed |

---

## Plan Verification (Self-Check)

**Coverage Check:**

| Requirement | Covered By | Status |
|-------------|------------|--------|
| API-01: CRUD endpoints | Wave 2 (CRUDRouter Enhancement) | ✓ |
| API-02: OpenAPI docs | Wave 2 + Wave 5 | ✓ |
| API-03: Auth middleware | Wave 1 (auth.py) | ✓ |
| API-04: CORS | Wave 1 (main_fastapi.py extension) | ✓ |
| API-05: Pagination | Wave 2 (CRUDRouter) | ✓ |
| AUTH-01: Register | Wave 1 (UserCreate schema + endpoint) | ✓ |
| AUTH-02: Login | Wave 1 (JWT token endpoint) | ✓ |
| AUTH-03: Logout | Wave 1 (logout endpoint) | ✓ |
| AUTH-04: Session persist | Wave 1 (JWT with expiry) | ✓ |
| AUTH-05: Admin user mgmt | Wave 4 (admin/users.py) | ✓ |
| ADM-01: View users | Wave 4 (GET /admin/users) | ✓ |
| ADM-02: Set roles | Wave 4 (PUT /admin/users/{id}) | ✓ |

**Success Criteria Check:**

1. Flask endpoints analyzed ✓ (in FLASK_ROUTES_MAP.md)
2. 11 models CRUD at /api/v1/* ✓ (Wave 2)
3. OpenAPI docs at /docs ✓ (Wave 2 + 5)
4. JWT protects endpoints ✓ (Wave 1 + 4)
5. Admin API ready ✓ (Wave 4)
6. CORS configured ✓ (Wave 1)
7. Pagination works ✓ (Wave 2)

**Dependencies Check:**
- Wave 1: No deps ✓
- Wave 2: Depends on Wave 1 (auth for CRUDRouter) ✓
- Wave 3: Depends on Wave 1 (auth for endpoints) ✓
- Wave 4: Depends on Waves 1-2 (auth + CRUD) ✓
- Wave 5: Integration test last ✓

**Verdict:** PASS - Plan covers all requirements and success criteria

---

**Estimated Plans:** 5 (one per wave)
**Parallelization:** Waves 1-3 can run in parallel; Wave 4 depends on 1-2; Wave 5 is sequential testing

---
*Plan created: 2026-02-24*
