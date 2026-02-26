# Wave 2: Authentication Migration - Task Tracker

**Phase:** 2 - Frontend User App
**Wave:** 2 of 6
**Strategy:** Option B - Hard Cut to JWT (user confirmed)
**Started:** 2026-02-26

---

## Tasks

### Task 1: Create FastAPI v1 auth endpoints with Flask-compatible responses
- [ ] POST /api/v1/auth/login - JWT login with Flask-compatible response
- [ ] POST /api/v1/auth/register - User registration with validation
- [ ] GET /api/v1/auth/me - Get current user
- [ ] POST /api/v1/auth/logout - Logout
- [ ] POST /api/v1/auth/change-password - Password change

**Files to modify:**
- `main_fastapi.py` - Add v1 auth endpoints
- `modules/schemas.py` - Add request/response schemas

**Success criteria:**
- Login accepts `{username, password}` or `{email, password}`
- Response includes `{success, user, access_token}` format
- Register validates same rules as Flask
- Password change validates current password

---

### Task 2: Update React AuthContext for JWT support
- [ ] Add token storage (localStorage)
- [ ] Modify login to use JWT token
- [ ] Add automatic token refresh on 401
- [ ] Update all API calls to include Authorization header

**Files to modify:**
- `frontend/src/contexts/AuthContext.tsx`

**Success criteria:**
- Login stores JWT token in localStorage
- All requests include `Authorization: Bearer <token>`
- Token persists across page refresh
- 401 triggers re-authentication

---

### Task 3: Create API client wrapper
- [ ] Create centralized HTTP client
- [ ] Token management
- [ ] Automatic retry on 401
- [ ] Error handling

**Files to create:**
- `frontend/src/utils/apiClient.ts`

**Success criteria:**
- All API calls use apiClient
- Token automatically attached
- 401 errors handled consistently

---

### Task 4: Add password change endpoint
- [ ] POST /api/v1/auth/change-password
- [ ] Validate current password
- [ ] Update password hash

**Files to modify:**
- `main_fastapi.py` - Add password endpoint
- `modules/auth.py` - Add password change helper

**Success criteria:**
- Password change validates current password
- New password meets validation rules

---

## Verification

- [ ] Register flow works end-to-end
- [ ] Login flow works with JWT
- [ ] Protected endpoints require valid JWT
- [ ] Logout clears token
- [ ] Password change works
- [ ] Token persists across refresh
- [ ] 401 handled gracefully

---

## Notes

**Migration Strategy:** Option B - Hard Cut to JWT
- No dual-auth bridge
- Frontend switches entirely to JWT
- Flask session auth no longer used for /app frontend
