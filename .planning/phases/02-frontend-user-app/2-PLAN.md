# Plan: Phase 2 - Frontend - User App (/app)

**Phase Goal:** Migrate existing React /app frontend from Flask to FastAPI backend with gradual transition, maintaining backward compatibility throughout the migration.

**Phase Number:** 2
**Dependencies:** Phase 1 (API Foundation) - COMPLETE
**Estimated Waves:** 6

---

## Requirements Mapping

| Requirement ID | Description | Covered By Wave |
|----------------|-------------|-----------------|
| AUTH-06 | Session persistence | Wave 2 (JWT storage) |
| DOC-01 | Document upload with progress | Wave 3 |
| DOC-02 | File list with metadata | Wave 4 |
| DOC-03 | Delete user files | Wave 4 |
| DOC-04 | Library/Knowledge management | Wave 3 |
| DOC-05 | Upload triggers Celery tasks | Wave 3 |
| DOC-06 | OCR processing | Wave 3 (worker) |
| DOC-07 | Vector generation | Wave 3 (worker) |
| FEA-01 | User registration | Wave 2 |
| FEA-02 | User login | Wave 2 |
| FEA-03 | RAG chat interface | Wave 5 |
| FEA-04 | Conversation history | Wave 5 |
| FEA-05 | Password reset via email | Wave 6 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (Router)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  /app/*          → React Static Files                   │    │
│  │  /api/*          → Flask (default) or FastAPI (flag)    │    │
│  │  /fastapi/*      → FastAPI (new endpoints)              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │   Flask App     │             │  FastAPI App    │
    │  (sessions)     │             │   (JWT)         │
    │  - Legacy API   │◀───DB──────▶│  - New API      │
    │  - Templates    │   SQLite    │  - /api/v1/*    │
    └─────────────────┘             └─────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Redis + Celery │
                    │  (Task Queue)   │
                    └─────────────────┘
```

---

## Wave 1: API Compatibility Analysis & Nginx Bridge

**Depends on:** Phase 1 Complete
**Autonomous:** true
**Checkpoint:** Decision on migration strategy

### Objective
Set up infrastructure for gradual migration with nginx routing that allows running Flask and FastAPI in parallel.

### Tasks

1. **Document all Flask API endpoints used by React frontend**
   - Create API contract specification
   - Compare with existing FastAPI endpoints
   - Identify gaps requiring new endpoints

   **Files to create:**
   - `.planning/phases/02-frontend-user-app/API_CONTRACTS.md`

   **Success criteria:**
   - [ ] All 30+ endpoints documented
   - [ ] Request/response schemas defined
   - [ ] Gap analysis complete

2. **Create FastAPI endpoint compatibility layer**
   - Add Flask-compatible endpoints to `main_fastapi.py` at `/api/*` paths
   - Mirror Flask response formats exactly
   - Support both JWT and session authentication during migration

   **Files to modify:**
   - `main_fastapi.py` - Add compatibility endpoints
   - `modules/auth.py` - Add session cookie support (optional)

   **Success criteria:**
   - [ ] `/api/me`, `/api/login`, `/api/logout` work with same response format
   - [ ] `/api/libraries`, `/api/knowledges` return identical structure
   - [ ] Both JWT and session auth accepted (if session bridge implemented)

3. **Configure nginx for dual-backend routing**
   - Add location blocks for `/fastapi/` prefix
   - Implement feature flag for `/api/*` routing
   - Test routing to both backends

   **Files to modify:**
   - `nginx.conf` or docker-compose nginx config

   **Success criteria:**
   - [ ] `/fastapi/api/v1/*` routes to FastAPI
   - [ ] `/api/*` routes to Flask (default)
   - [ ] Feature flag can switch `/api/*` to FastAPI

---

## Wave 2: Authentication Migration

**Depends on:** Wave 1
**Autonomous:** true

### Objective
Migrate authentication from Flask sessions to FastAPI JWT with minimal frontend disruption.

### Tasks

1. **Create FastAPI auth endpoints with Flask-compatible responses**
   - `/api/v1/auth/login` - Match Flask `/api/login` response format
   - `/api/v1/auth/register` - Match Flask `/api/register` response format
   - `/api/v1/auth/me` - Match Flask `/api/me` response format
   - `/api/v1/auth/logout` - Match Flask `/api/logout` response format

   **Files to create/modify:**
   - `main_fastapi.py` - Add auth endpoints (or create `api/v1/auth.py`)

   **Response format compatibility:**
   ```json
   // Login response (must match Flask)
   {
     "success": true,
     "user": {
       "id": "user-uuid",
       "username": "john",
       "is_admin": false
     }
   }
   ```

   **Success criteria:**
   - [ ] Login endpoint accepts `{username, password}` or `{email, password}`
   - [ ] Response includes `{success, user}` format
   - [ ] JWT token returned (new field for frontend adaptation)
   - [ ] Register endpoint validates same rules as Flask

2. **Update React AuthContext for JWT support**
   - Add token storage (localStorage or httpOnly cookie)
   - Modify login to use JWT token
   - Add token refresh mechanism
   - Maintain backward compatibility layer

   **Files to modify:**
   - `frontend/src/contexts/AuthContext.tsx`
   - `frontend/src/utils/csrf.ts` (may no longer be needed)

   **Code pattern:**
   ```typescript
   // New JWT-aware AuthContext
   const login = async (username: string, password: string) => {
       const response = await fetch('/fastapi/api/v1/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ username, password }),
       })
       const data = await response.json()
       if (data.access_token) {
           localStorage.setItem('auth_token', data.access_token)
           localStorage.setItem('auth_mode', 'jwt')
       }
   }
   ```

   **Success criteria:**
   - [ ] Login stores JWT token
   - [ ] All subsequent requests include `Authorization: Bearer <token>`
   - [ ] Token persists across page refresh
   - [ ] Logout clears token

3. **Create API client wrapper for consistent auth headers**
   - Centralized token management
   - Automatic retry on 401 (token refresh)
   - Error handling

   **Files to create:**
   - `frontend/src/utils/apiClient.ts`

   **Success criteria:**
   - [ ] All API calls use apiClient
   - [ ] Token automatically attached to requests
   - [ ] 401 errors trigger re-authentication

4. **Add password change endpoint to FastAPI**
   - `/api/v1/auth/change-password` - Change own password
   - `/api/v1/auth/forgot-password` - Request password reset

   **Files to create:**
   - `api/v1/auth.py` - Add password endpoints

   **Success criteria:**
   - [ ] Password change validates current password
   - [ ] Password reset creates request record for admin

---

## Wave 3: Document Upload Migration

**Depends on:** Wave 2 (auth)
**Autonomous:** false

### Objective
Migrate document upload flow to FastAPI while maintaining Celery task integration.

### Tasks

1. **Create FastAPI upload endpoints**
   - `/api/v1/upload` - File upload (multipart/form-data)
   - `/api/v1/check-duplicates` - Check for duplicate files
   - `/api/v1/upload-status` - Get upload task status
   - `/api/v1/upload-status/{task_id}/dismiss` - Dismiss completed task

   **Files to create:**
   - `api/v1/upload.py` - Upload endpoints

   **Dependencies to reuse:**
   - `modules/celery_tasks.py` - Celery task submission
   - `modules/upload_processing.py` - Processing logic (worker)

   **Success criteria:**
   - [ ] Upload accepts multipart form data
   - [ ] File saved to same location as Flask
   - [ ] Celery task submitted with same parameters
   - [ ] Task ID stored in Redis for status tracking
   - [ ] Duplicate check queries same database tables

2. **Create FastAPI URL download endpoints**
   - `/api/v1/process-url` - Download and process URL
   - `/api/v1/validate_url` - Validate URL before download

   **Files to create:**
   - `api/v1/upload.py` - Add URL download endpoints

   **Success criteria:**
   - [ ] URL download creates UrlDownload record
   - [ ] Celery task processes download
   - [ ] Same validation as Flask

3. **Update React UploadPage for FastAPI**
   - Point upload endpoints to `/fastapi/api/v1/*`
   - Handle JWT authentication
   - Maintain same UX (progress, error handling)

   **Files to modify:**
   - `frontend/src/components/UploadPage.tsx`
   - `frontend/src/components/upload/FileUploadTab.tsx`
   - `frontend/src/components/upload/UrlDownloadTab.tsx`
   - `frontend/src/components/upload/UploadProgress.tsx`

   **Success criteria:**
   - [ ] File upload works with FastAPI backend
   - [ ] Progress indicator shows real-time status
   - [ ] Duplicate detection works
   - [ ] URL download works

4. **Create FastAPI libraries/knowledges endpoints**
   - `/api/v1/libraries` - List user libraries with knowledges
   - `/api/v1/knowledges` - List all knowledges

   **Files to create:**
   - `api/v1/libraries.py` - Library/knowledge endpoints

   **Reuse from Flask:**
   - `modules/database.py` - `get_libraries_with_details()`
   - `modules/access_control.py` - Permission filtering

   **Success criteria:**
   - [ ] Response format matches Flask exactly
   - [ ] Permission filtering applied
   - [ ] Vector store mode respected

---

## Wave 4: File Management & User Data

**Depends on:** Wave 3
**Autonomous:** true

### Objective
Enable users to view and manage their uploaded files via FastAPI.

### Tasks

1. **Create FastAPI file management endpoints**
   - `/api/v1/files` - List user's uploaded files (CRUDRouter already exists)
   - `/api/v1/files/{file_id}` - Get file details
   - `/api/v1/files/{file_id}` - DELETE file
   - `/api/v1/files/{file_id}/download` - Download file

   **Files to modify:**
   - `modules/crud_router.py` - May need file-specific customizations
   - `main_fastapi.py` - Register file endpoints

   **Success criteria:**
   - [ ] CRUDRouter exposes files endpoint
   - [ ] User can only see their own files (ownership filtering)
   - [ ] Delete removes file and vectors
   - [ ] Download serves original file

2. **Create FastAPI vector cleanup on file delete**
   - Delete from sqlite-vec when file deleted
   - Clean up DoclingDocument JSON

   **Files to create/modify:**
   - `api/v1/files.py` - Custom delete handler
   - `modules/vector_tasks.py` - Reuse delete_vector_store

   **Success criteria:**
   - [ ] File delete removes vectors
   - [ ] File delete removes local files
   - [ ] Database record deleted

3. **Create FastAPI user profile endpoints**
   - `/api/v1/user/profile` - GET/PUT profile
   - `/api/v1/user/stats` - User statistics

   **Files to create:**
   - `api/v1/user.py` - User profile endpoints

   **Success criteria:**
   - [ ] User can view own profile
   - [ ] User can update username
   - [ ] Stats show user's file/message counts

4. **Update React UserProfile for FastAPI**
   - Point to FastAPI endpoints
   - Handle JWT auth

   **Files to modify:**
   - `frontend/src/components/UserProfile.tsx`

   **Success criteria:**
   - [ ] Profile loads from FastAPI
   - [ ] Updates save via FastAPI

---

## Wave 5: RAG Chat Migration

**Depends on:** Wave 3 (upload), Wave 4 (files)
**Autonomous:** false
**Checkpoint:** Critical - streaming response testing

### Objective
Migrate RAG chat interface to FastAPI with streaming responses.

### Tasks

1. **Create FastAPI streaming query endpoint**
   - `/api/v1/query` - RAG query with SSE streaming
   - Match Flask streaming response format exactly

   **Files to create:**
   - `api/v1/query.py` - Query endpoint with streaming

   **Streaming pattern:**
   ```python
   from fastapi.responses import StreamingResponse
   import json

   async def generate_sse(query: str, thread_id: str, ...):
       async for event in invoke_agent_streaming(query, thread_id, ...):
           yield f"data: {json.dumps(event)}\n\n"
       yield "data: [DONE]\n\n"

   @app.post("/api/v1/query")
   async def query_endpoint(request: QueryRequest):
       return StreamingResponse(
           generate_sse(request.query, request.thread_id, ...),
           media_type="text/event-stream"
       )
   ```

   **Success criteria:**
   - [ ] SSE streaming works
   - [ ] Token events match Flask format
   - [ ] Citations included
   - [ ] Visual evidence included
   - [ ] HIL options supported

2. **Create FastAPI conversation history endpoints**
   - `/api/v1/threads` - List user's conversations
   - `/api/v1/threads/{thread_id}` - GET/DELETE conversation
   - `/api/v1/messages` - List messages in thread

   **Files to create:**
   - `api/v1/threads.py` - Thread management

   **Success criteria:**
   - [ ] Thread list matches Flask format
   - [ ] Delete removes thread and messages
   - [ ] Message history loads correctly

3. **Create FastAPI feedback endpoints**
   - `/api/v1/message/feedback` - Thumbs up/down
   - `/api/v1/message/metadata` - Get message metadata

   **Files to create:**
   - `api/v1/feedback.py` - Feedback endpoints

   **Success criteria:**
   - [ ] Feedback saved to database
   - [ ] Metadata returned correctly

4. **Update React App.tsx for FastAPI**
   - Point query endpoint to `/fastapi/api/v1/query`
   - Handle SSE streaming from FastAPI
   - Point history endpoints

   **Files to modify:**
   - `frontend/src/App.tsx`

   **Success criteria:**
   - [ ] Chat works with FastAPI backend
   - [ ] Streaming response parsed correctly
   - [ ] History panel loads from FastAPI
   - [ ] Feedback works

5. **Create FastAPI auxiliary endpoints**
   - `/api/v1/config` - App configuration
   - `/api/v1/branding` - Branding info
   - `/api/v1/counters` - Dashboard stats
   - `/api/v1/visual-evidence` - Visual evidence preview
   - `/api/v1/document-meta` - Document metadata
   - `/api/v1/self-retriever-questions` - Suggested questions

   **Files to create:**
   - `api/v1/config.py` - Config/branding
   - `api/v1/visual.py` - Visual evidence
   - `api/v1/documents.py` - Document metadata

   **Success criteria:**
   - [ ] All auxiliary endpoints work
   - [ ] Response formats match Flask

---

## Wave 6: Password Reset & Final Integration

**Depends on:** Wave 2 (auth), Wave 5 (chat)
**Autonomous:** true

### Objective
Complete password reset flow and finalize integration with nginx routing switch.

### Tasks

1. **Create FastAPI password reset endpoints**
   - `/api/v1/auth/forgot-password` - Request password reset
   - `/api/v1/admin/users/{user_id}/reset-password` - Admin reset (exists)

   **Files to create:**
   - `api/v1/auth.py` - Add forgot password

   **Success criteria:**
   - [ ] Reset request creates record in PasswordResetRequest table
   - [ ] Email notification sent (or queued for admin)

2. **Update React ChangePasswordPage for FastAPI**
   - Point to FastAPI endpoint
   - Handle JWT auth

   **Files to modify:**
   - `frontend/src/components/ChangePasswordPage.tsx`

   **Success criteria:**
   - [ ] Password change works via FastAPI

3. **Create FastAPI CSRF endpoint (if needed)**
   - `/api/v1/csrf-token` - For any remaining CSRF needs

   **Files to create:**
   - `api/v1/misc.py` - CSRF endpoint (optional)

   **Success criteria:**
   - [ ] CSRF token generated if required

4. **Switch nginx routing for full FastAPI**
   - Update nginx config to route `/api/*` to FastAPI
   - Keep Flask as fallback
   - Test all endpoints

   **Files to modify:**
   - `nginx.conf`

   **Success criteria:**
   - [ ] All API calls route to FastAPI
   - [ ] Flask remains available for rollback

5. **Integration testing**
   - Full user journey testing
   - End-to-end verification

   **Files to create:**
   - `.planning/phases/02-frontend-user-app/TEST_RESULTS.md`

   **Success criteria:**
   - [ ] All 11 success criteria from ROADMAP verified
   - [ ] No regressions from Flask behavior

---

## Checkpoint Plans

### Checkpoint 1: After Wave 1 (Nginx Bridge)
**Decision needed:** Migration strategy confirmation
- Option A: Dual auth (sessions + JWT) for gradual migration
- Option B: Hard cut to JWT (faster but disruptive)

**Recommendation:** Option A - less risk, allows rollback

### Checkpoint 2: After Wave 3 (Upload)
**Decision needed:** Upload migration verification
- Verify Celery tasks work with FastAPI
- Confirm OCR and vector generation working
- Decide: proceed with chat migration or fix issues first

**Recommendation:** Don't proceed until upload 100% working

### Checkpoint 3: After Wave 5 (Chat)
**Decision needed:** Production cutover timing
- Confirm all features working
- Plan nginx switch
- Communicate downtime if needed

**Recommendation:** Switch during low-traffic period, have rollback ready

---

## Must Haves (Verification Criteria)

1. **Auth flow working:** Register → Login → Protected endpoints → Logout
2. **Upload flow working:** Select files → Upload → Progress → Complete
3. **Chat flow working:** Send query → Streaming response → Citations → History
4. **File management working:** List files → View details → Delete
5. **JWT session persistence:** Token persists across refresh
6. **Celery integration:** Tasks submitted and tracked correctly
7. **Response format compatibility:** Frontend receives expected formats
8. **No regressions:** All Flask features work in FastAPI
9. **Nginx routing:** Can switch between backends
10. **Error handling:** Graceful errors, no silent failures
11. **Admin features:** Password reset via admin works

---

## Files to Create/Modify Summary

### Create
| File | Purpose | Wave |
|------|---------|------|
| `api/v1/upload.py` | Upload endpoints | 3 |
| `api/v1/libraries.py` | Library/knowledge endpoints | 3 |
| `api/v1/files.py` | File management | 4 |
| `api/v1/user.py` | User profile | 4 |
| `api/v1/query.py` | RAG streaming query | 5 |
| `api/v1/threads.py` | Conversation history | 5 |
| `api/v1/feedback.py` | Message feedback | 5 |
| `api/v1/config.py` | Config/branding | 5 |
| `api/v1/visual.py` | Visual evidence | 5 |
| `api/v1/documents.py` | Document metadata | 5 |
| `frontend/src/utils/apiClient.ts` | API wrapper | 2 |
| `.planning/phases/02-frontend-user-app/API_CONTRACTS.md` | API specs | 1 |

### Modify
| File | Purpose | Wave |
|------|---------|------|
| `main_fastapi.py` | Add compatibility endpoints | 1, 2, 3 |
| `modules/auth.py` | Add session bridge (optional) | 1 |
| `frontend/src/contexts/AuthContext.tsx` | JWT support | 2 |
| `frontend/src/components/UploadPage.tsx` | FastAPI endpoints | 3 |
| `frontend/src/components/upload/*.tsx` | FastAPI endpoints | 3 |
| `frontend/src/components/UserProfile.tsx` | FastAPI endpoints | 4 |
| `frontend/src/App.tsx` | FastAPI query endpoint | 5 |
| `nginx.conf` | Dual-backend routing | 1, 6 |

---

## Plan Verification (Self-Check)

**Coverage Check:**

| Requirement | Covered By | Status |
|-------------|------------|--------|
| AUTH-06: Session persistence | Wave 2 (JWT storage) | ✓ |
| DOC-01 to DOC-07: Document upload | Wave 3 | ✓ |
| FEA-01 to FEA-03: User features | Wave 2, 5 | ✓ |
| FEA-04: Conversation history | Wave 5 | ✓ |
| FEA-05: Password reset | Wave 6 | ✓ |

**Success Criteria Check:**

| Success Criterion | Covered By | Status |
|-------------------|------------|--------|
| 1. React /app continues working | Wave 1 (bridge) | ✓ |
| 2. FastAPI compatible endpoints | Wave 1-6 | ✓ |
| 3. Register/login via FastAPI | Wave 2 | ✓ |
| 4. Upload with progress | Wave 3 | ✓ |
| 5. Manage Libraries/Knowledges | Wave 3 | ✓ |
| 6. Celery tasks triggered | Wave 3 | ✓ |
| 7. View files list | Wave 4 | ✓ |
| 8. Delete files | Wave 4 | ✓ |
| 9. RAG chat history | Wave 5 | ✓ |
| 10. Password reset flow | Wave 6 | ✓ |
| 11. Nginx routing | Wave 1, 6 | ✓ |

**Dependencies Check:**
- Wave 1: No deps ✓
- Wave 2: Depends on Wave 1 (bridge) ✓
- Wave 3: Depends on Wave 2 (auth) ✓
- Wave 4: Depends on Wave 3 (upload) ✓
- Wave 5: Depends on Waves 3-4 (data) ✓
- Wave 6: Integration last ✓

**Verdict:** PASS - Plan covers all requirements and success criteria

---

**Estimated Waves:** 6
**Parallelization:** Waves 2-4 can have parallel tasks; Wave 5 is sequential due to streaming complexity
**Estimated Plans:** 20-25 individual tasks across all waves

---
*Plan created: 2026-02-25*
