# API Contracts - Flask to FastAPI Migration

**Phase:** 2 - Frontend User App (/app)
**Created:** 2026-02-25
**Purpose:** Document all Flask API endpoints used by React frontend for FastAPI compatibility layer

---

## Executive Summary

This document catalogs **34 API endpoints** currently used by the React `/app` frontend, organized by functional area. Each endpoint includes request/response schemas to enable exact compatibility in the FastAPI migration.

**Authentication Model:** Flask uses session-based auth (`credentials: 'include'`)
**Target Authentication:** FastAPI uses JWT Bearer tokens (with optional session bridge)

---

## 1. Authentication Endpoints

### 1.1 POST /api/login

**Module:** `modules/api_auth.py`
**Purpose:** User login with username/email and password

**Request:**
```json
{
  "username": "string (username or email)",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid-string",
    "username": "john",
    "is_admin": false,
    "profile_picture_url": null
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "Account is disabled"
}
```

**Notes:**
- Accepts username OR email in `username` field
- Email fallback: if username contains "@" and user not found, queries by user_id (email)
- Uses Flask-Login `login_user()` for session management
- Stores user info in session: `session["user"]`

---

### 1.2 GET /api/me

**Module:** `modules/api_auth.py`
**Purpose:** Get current authenticated user information

**Request:** No body (session cookie via `credentials: 'include'`)

**Response (200 OK):**
```json
{
  "authenticated": true,
  "user": {
    "id": "user-uuid-string",
    "username": "john",
    "is_admin": false,
    "profile_picture_url": null
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "authenticated": false,
  "user": null
}
```

**Notes:**
- Requires valid Flask session
- Returns 401 if not authenticated

---

### 1.3 POST /api/logout

**Module:** `modules/api_auth.py`
**Purpose:** User logout

**Request:** No body (session cookie)

**Response (200 OK):**
```json
{
  "success": true
}
```

**Notes:**
- Also accepts GET method (non-standard)
- Clears session completely: `session.pop('user')`, `session.clear()`
- Calls `logout_user()` from Flask-Login

---

### 1.4 GET /api/register

**Module:** `modules/register.py`
**Purpose:** Display registration form (web route, not API)

**Request:** GET /register

**Response:** HTML form

**Notes:** Not used by React frontend (SPA handles registration)

---

### 1.5 POST /register

**Module:** `modules/register.py`
**Purpose:** User registration

**Request (form-data):**
```
username: string (3-20 chars)
email: string (valid email)
password: string (min 8 chars, uppercase, number)
confirm_password: string (must match password)
```

**Response (Success):** Redirect to /login with flash message
**Response (Validation errors):** Redirect with flash error

**Validation Rules:**
- Username: 3-20 characters
- Email: Must contain @ and .
- Password: Min 8 chars, at least one uppercase, at least one number
- Passwords must match

**Notes:** Currently web form, React frontend may need API version

---

## 2. Configuration & Branding Endpoints

### 2.1 GET /api/config

**Module:** `modules/api_auth.py`
**Purpose:** App configuration for frontend

**Request:** GET (session required)

**Response (200 OK):**
```json
{
  "vector_store_mode": "user",
  "visual_grounding_enabled": false,
  "is_admin": false,
  "username": "john"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthenticated"
}
```

**Notes:**
- `vector_store_mode`: "user" or "knowledge"
- `visual_grounding_enabled`: boolean from config

---

### 2.2 GET /api/branding

**Module:** `modules/api_auth.py`
**Purpose:** App branding information

**Request:** GET (no auth required)

**Response (200 OK):**
```json
{
  "app_name": "SmartLib",
  "logo_url": null
}
```

**Notes:**
- Public endpoint (no authentication required)
- Values read from AppSettings table

---

## 3. Library & Knowledge Endpoints

### 3.1 GET /api/libraries

**Module:** `modules/api_auth.py`
**Purpose:** List user's libraries with knowledges

**Request:** GET (session required)

**Response (200 OK):**
```json
{
  "libraries": [
    {
      "library_id": 1,
      "name": "Product Documentation",
      "description": "All product docs",
      "knowledges": [
        {
          "id": 1,
          "name": "User Manuals",
          "categories": [{"id": 1, "name": "Guides"}],
          "catalogs": [{"id": 1, "name": "Technical"}],
          "groups": [{"group_id": 1, "name": "Engineering"}]
        }
      ]
    }
  ]
}
```

**Response (401 Unauthorized):**
```json
{
  "libraries": []
}
```

**Notes:**
- Filters knowledges by user's group memberships
- In "knowledge" mode, skips libraries with no accessible knowledges

---

### 3.2 GET /api/knowledges

**Module:** `modules/api_auth.py`
**Purpose:** List all knowledges with library mappings

**Request:** GET (session required)

**Response (200 OK):**
```json
{
  "knowledges": [
    {"id": 1, "name": "User Manuals"}
  ],
  "knowledge_libraries_map": {
    "1": {
      "name": "User Manuals",
      "libraries": [
        {"id": 1, "name": "Product Documentation"}
      ]
    }
  },
  "mode": "user"
}
```

**Notes:**
- In "knowledge" mode, returns all knowledges user has access to
- Admin users get all knowledges
- `knowledge_libraries_map` shows which libraries each knowledge belongs to

---

## 4. Document Upload Endpoints

### 4.1 POST /upload

**Module:** `modules/upload.py`
**Purpose:** Upload files for processing

**Request (multipart/form-data):**
```
files: File[] (multiple files)
library_id: string (integer)
library_name: string
knowledge_id: string (optional, integer)
enable_visual_grounding: "true" or "false"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully uploaded 2 file(s). Processing started.",
  "files": [
    {
      "filename": "manual.pdf",
      "task_id": "uuid-task-id"
    }
  ]
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Error description"
}
```

**Allowed Extensions:** pdf, docx, txt, md, html, pptx, xlsx, csv, jpg, jpeg, png, gif

**Notes:**
- Files saved to temp directory
- Celery task submitted for async processing
- Task ID stored in Redis: `user:{user_id}:upload_tasks`

---

### 4.2 POST /api/check-duplicates

**Module:** `modules/upload.py`
**Purpose:** Check if filenames already exist in target library/knowledge

**Request:**
```json
{
  "filenames": ["manual.pdf", "guide.docx"],
  "library_id": 1,
  "knowledge_id": 2
}
```

**Response (200 OK):**
```json
{
  "duplicates": [
    {
      "filename": "manual.pdf",
      "file_id": "uuid-file-id",
      "upload_time": "2024-01-01T00:00:00"
    }
  ]
}
```

**Notes:**
- Empty `duplicates` array if no matches
- Checks `UploadedFile` table

---

### 4.3 GET /api/upload-status

**Module:** `modules/upload.py`
**Purpose:** Get status of user's upload tasks

**Request:** GET (session required)

**Response (200 OK):**
```json
{
  "tasks": [
    {
      "task_id": "uuid-task-id",
      "status": "SUCCESS",
      "filename": "manual.pdf",
      "info": {
        "stage": "Complete",
        "progress": 100,
        "error": null
      }
    }
  ]
}
```

**Task Statuses:** PENDING, STARTED, SUCCESS, FAILURE, RETRY

**Notes:**
- Reads from Redis: `user:{user_id}:upload_tasks`
- Completed tasks auto-removed after 60 seconds
- Orphaned PENDING tasks removed after 5 minutes

---

### 4.4 POST /api/upload-status/{task_id}/dismiss

**Module:** `modules/upload.py`
**Purpose:** Dismiss completed task from status list

**Request:** POST (no body)

**Response (200 OK):**
```json
{
  "success": true
}
```

**Notes:**
- Removes task from Redis list
- Does not affect Celery task result

---

### 4.5 POST /api/process-url

**Module:** `modules/upload.py`
**Purpose:** Download and process URL

**Request:**
```json
{
  "url": "https://example.com/doc.pdf",
  "library_id": 1,
  "library_name": "Product Docs",
  "knowledge_id": 2
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "URL queued for processing.",
  "task_id": "uuid-task-id",
  "download_id": "uuid-download-id"
}
```

**Notes:**
- Downloads URL content to temp file
- Creates UrlDownload record
- Submits Celery task for processing

---

### 4.6 POST /validate_url

**Module:** `modules/upload.py`
**Purpose:** Validate URL is reachable

**Request:**
```json
{
  "url": "https://example.com/doc.pdf"
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "message": "URL is reachable (status: 200)."
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "message": "URL could not be reached."
}
```

**Notes:**
- Uses HEAD request with 3s timeout
- Only accepts http/https URLs

---

## 5. RAG Query Endpoints

### 5.1 POST/GET /api/query

**Module:** `modules/query.py`
**Purpose:** RAG query with streaming SSE response

**Request:**
```json
{
  "query": "What is the main topic?",
  "conversation_id": "uuid-conv-id",
  "thread_id": "uuid-thread-id",
  "library_id": 1,
  "knowledge_id": 2,
  "stream": true,
  "messages": [
    {"role": "user", "content": "Previous message"},
    {"role": "assistant", "content": "Previous response"}
  ]
}
```

**Response (SSE Stream):**
```
data: {"type": "token", "content": "The..."}
data: {"type": "token", "content": "main..."}
data: {"type": "citations", "citations": [...]}
data: {"type": "visual_evidence", "data": [...]}
data: {"type": "hil_options", "options": [...]}
data: {"type": "suggested_questions", "questions": [...]}
data: [DONE]
```

**Event Types:**
- `token`: Streaming text content
- `citations`: Source document citations
- `visual_evidence`: Images/maps/charts
- `hil_options`: Human-in-the-loop options
- `suggested_questions`: Follow-up questions
- `error`: Error message

**Notes:**
- Authentication via session OR API key header
- Uses Celery worker for agent invocation
- Conversation history saved to MessageHistory table

---

### 5.2 POST /api/resume_rag

**Module:** `modules/query.py`
**Purpose:** Resume/modify RAG agent session

**Request:**
```json
{
  "thread_id": "uuid-thread-id",
  "action": "web_search",
  "confirmed": true
}
```

**Response:** SSE stream (same format as /api/query)

**Notes:**
- Handles human-in-the-loop confirmations
- Can trigger web search or other actions

---

### 5.3 POST /api/confirm_web_search

**Module:** `modules/query.py`
**Purpose:** Confirm web search action

**Request:**
```json
{
  "thread_id": "uuid-thread-id",
  "confirmed": true
}
```

**Response:** SSE stream

**Notes:**
- User confirms/cancels web search suggested by agent

---

## 6. Conversation History Endpoints

### 6.1 GET /api/threads

**Module:** `modules/query.py`
**Purpose:** List user's conversations

**Request:** GET (session required)

**Response (200 OK):**
```json
{
  "threads": [
    {
      "id": "uuid-thread-id",
      "preview": "First message preview...",
      "lastUpdated": "2024-01-01T00:00:00",
      "messageCount": 5
    }
  ]
}
```

**Notes:**
- Returns conversations for current user
- Sorted by last message timestamp

---

### 6.2 DELETE /api/threads/{thread_id}

**Module:** `modules/query.py`
**Purpose:** Delete conversation

**Request:** DELETE /api/threads/uuid-thread-id

**Response (200 OK):**
```json
{
  "success": true
}
```

**Notes:**
- Deletes thread and all associated messages

---

## 7. Feedback Endpoints

### 7.1 POST /api/message_feedback

**Module:** `modules/feedback.py`
**Purpose:** Submit thumbs up/down feedback

**Request:**
```json
{
  "message_id": 123,
  "feedback_type": "like"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "like_count": 5,
  "dislike_count": 1
}
```

**Feedback Types:** "like", "dislike"

**Notes:**
- Updates existing feedback if user already gave feedback
- Returns aggregate counts

---

## 8. Document & Message Metadata

### 8.1 GET /api/visual_evidence

**Module:** `modules/query.py`
**Purpose:** Get visual evidence preview image

**Request:** GET /api/visual_evidence?document_id=uuid&library_id=1

**Response:** Image file (PNG/JPEG)

**Notes:**
- Reads DoclingDocument JSON
- Renders bounding boxes on source image

---

### 8.2 GET /api/document_meta

**Module:** `modules/query.py`
**Purpose:** Get document metadata

**Request:** GET /api/document_meta?document_id=uuid

**Response:**
```json
{
  "document_id": "uuid",
  "metadata": {...}
}
```

**Notes:**
- Returns document properties from vector store

---

### 8.3 GET /api/message_metadata

**Module:** `modules/query.py`
**Purpose:** Get message metadata

**Request:** GET /api/message_metadata?message_id=123

**Response:**
```json
{
  "message_id": 123,
  "metadata": {...}
}
```

**Notes:**
- Citations, usage metadata, suggested questions

---

### 8.4 GET /api/get_document_chunk

**Module:** `modules/query.py`
**Purpose:** Get specific document chunk

**Request:** GET /api/get_document_chunk?doc_id=uuid&chunk_id=1

**Response:**
```json
{
  "content": "Chunk text content...",
  "metadata": {...}
}
```

**Notes:**
- Used for citation detail views

---

## 9. User Profile Endpoints

### 9.1 GET /api/user/profile

**Purpose:** Get user profile

**Request:** GET (session required)

**Response:**
```json
{
  "user": {
    "user_id": "uuid",
    "username": "john",
    "email": "john@example.com",
    "is_admin": false
  }
}
```

**Notes:** May need to be implemented (currently web form)

---

### 9.2 PUT /api/user/profile

**Purpose:** Update user profile

**Request:**
```json
{
  "username": "newname"
}
```

**Response:**
```json
{
  "user": {...}
}
```

**Notes:** May need to be implemented

---

### 9.3 POST /api/change-password

**Module:** `modules/change_password.py`
**Purpose:** Change password

**Request:**
```json
{
  "current_password": "oldpass",
  "new_password": "newpass"
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Validation:**
- Current password must match
- New password: min 8 chars, uppercase, number

**Notes:** Currently web form, may need JSON API version

---

## 10. Utility Endpoints

### 10.1 GET /api/csrf-token

**Purpose:** Get CSRF token for form submissions

**Request:** GET

**Response:**
```json
{
  "csrf_token": "token-string"
}
```

**Notes:** May not be needed with JWT auth

---

### 10.2 POST /api/self-retriever-questions

**Module:** `modules/selfquery.py`
**Purpose:** Generate suggested questions for context

**Request:**
```json
{
  "knowledge_id": 1,
  "library_id": 1,
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "questions": [
    "What are the main features?",
    "How do I install the product?",
    ...
  ]
}
```

**Notes:**
- Returns 6 diverse questions based on context
- Uses LLM to generate questions

---

### 10.3 POST /api/self-retriever

**Module:** `modules/selfquery.py`
**Purpose:** Run self-query retriever

**Request:**
```json
{
  "question": "Find documents about installation",
  "knowledge_id": 1,
  "library_id": 1,
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "query": "Find documents about installation",
  "results": [
    {
      "content": "...",
      "metadata": {...}
    }
  ]
}
```

**Notes:** BASIC edition returns null (not implemented)

---

## 11. Document Content

### 11.1 GET /api/document_content/{library_id}/{document_id}

**Module:** `modules/api_auth.py`
**Purpose:** Get document chunks for viewer

**Request:** GET /api/document_content/1/uuid?
page=5

**Response:**
```json
{
  "name": "manual.pdf",
  "document_id": "uuid",
  "library_id": 1,
  "page_filter": 5,
  "chunks": [
    {
      "content": "Page content...",
      "page": 5,
      "metadata": {...}
    }
  ],
  "total_chunks": 10
}
```

**Notes:**
- Reads from sqlite-vec document_vectors table
- Optional page filter

---

## Gap Analysis: Flask vs FastAPI

### Endpoints Already in FastAPI (Phase 1)

| Endpoint | FastAPI Path | Status |
|----------|-------------|--------|
| Login | POST /api/v1/auth/login | Done (JWT) |
| Register | POST /api/v1/auth/register | Done |
| Me | GET /api/v1/auth/me | Done |
| Logout | POST /api/v1/auth/logout | Done |
| Config | GET /api/v1/config | Done |
| Branding | GET /api/v1/branding | Done |
| Admin Users | GET /api/v1/admin/users | Done |
| Admin Stats | GET /api/v1/admin/stats | Done |

### Endpoints Needing Compatibility Layer

| Endpoint | Priority | Notes |
|----------|----------|-------|
| GET /api/libraries | HIGH | Upload page dependency |
| GET /api/knowledges | HIGH | Upload page dependency |
| POST /upload | HIGH | Core upload flow |
| POST /api/check-duplicates | HIGH | Duplicate detection |
| GET /api/upload-status | HIGH | Progress tracking |
| POST /api/process-url | MEDIUM | URL download feature |
| POST /validate_url | MEDIUM | URL validation |
| POST /api/query | HIGH | RAG chat core |
| GET /api/threads | MEDIUM | History sidebar |
| DELETE /api/threads/{id} | LOW | Delete conversation |
| POST /api/message_feedback | MEDIUM | Feedback feature |
| POST /api/change-password | LOW | Profile management |
| GET /api/self-retriever-questions | MEDIUM | Suggested questions |

---

## Response Format Compatibility Notes

### Authentication Response Format

Flask returns `{success, user}` format. FastAPI compatibility endpoints MUST match this exactly (not JWT-only format).

**Flask:**
```json
{
  "success": true,
  "user": {"id": "...", "username": "...", "is_admin": false}
}
```

**FastAPI JWT (current):**
```json
{
  "access_token": "token",
  "token_type": "bearer"
}
```

**FastAPI Compatibility (target):**
```json
{
  "success": true,
  "user": {...},
  "access_token": "token",  // Additional field for frontend adaptation
  "token_type": "bearer"
}
```

### Error Response Format

**Flask:**
```json
{
  "success": false,
  "error": "Error message"
}
```

**FastAPI (default):**
```json
{
  "detail": "Error message"
}
```

**FastAPI Compatibility:** Must wrap in `{success: false, error: "..."}`

---

## Migration Strategy

### Phase 1: Dual-Auth Bridge (Wave 1-2)

FastAPI accepts BOTH session cookies AND JWT tokens during migration.

```python
# FastAPI dependency
async def get_current_user_flexible(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme)
):
    # Try JWT first
    if token:
        return validate_jwt(token)

    # Fallback to session cookie
    session_data = request.session.get("user")
    if session_data:
        return get_user_by_id(session_data["user_id"])

    raise HTTPException(401, "Not authenticated")
```

### Phase 2: Path-Based Routing (Wave 1)

Nginx routes:
- `/fastapi/api/v1/*` → FastAPI (new endpoints)
- `/api/*` → Flask (default, can be switched via feature flag)

### Phase 3: Frontend Adaptation (Wave 2-5)

React frontend gradually adopts JWT:
```typescript
// New JWT-aware auth
const login = async (username, password) => {
    const res = await fetch('/fastapi/api/v1/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password}),
    })
    const data = await res.json()
    if (data.access_token) {
        localStorage.setItem('auth_token', data.access_token)
    }
}
```

---

## Appendix: Celery Task Integration

### Task Submission Pattern

```python
# Flask
task_id = submit_file_processing_task(
    temp_file_path="/path/to/file.pdf",
    filename="file.pdf",
    user_id=current_user.user_id,
    library_id=1,
    library_name="Product Docs",
    knowledge_id_str="2",
    enable_visual_grounding_flag=False,
)
```

### Redis Task Tracking

```python
# Store task in Redis
task_key = f"user:{user_id}:upload_tasks"
task_meta_key = f"user:{user_id}:upload_task_meta"
redis_client.rpush(task_key, task_id)
redis_client.hset(task_meta_key, task_id, json.dumps({
    'filename': 'file.pdf',
    'created_at': datetime.utcnow().isoformat()
}))
```

### Task Status Polling

Frontend polls `/api/upload-status` every 2 seconds:
```typescript
const pollStatus = async () => {
    const res = await fetch('/api/upload-status')
    const data = await res.json()
    for (const task of data.tasks) {
        if (task.status === 'SUCCESS') {
            // Handle completion
        }
    }
}
```

---

*Document created: 2026-02-25*
*Last updated: 2026-02-25*
