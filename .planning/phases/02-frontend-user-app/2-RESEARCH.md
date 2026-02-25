# Research: Phase 2 - Frontend - User App (/app)

**Researched:** 2026-02-25
**Domain:** React Frontend + Flask/FastAPI Backend API Migration
**Confidence:** HIGH

---

## Executive Summary

Phase 2 involves migrating the existing React `/app` frontend from Flask session-based authentication to FastAPI JWT-based authentication while maintaining backward compatibility. The frontend is a modern React 18 application using Vite, shadcn/ui components, React Router, and Tailwind CSS.

**Key findings:**
1. React frontend currently uses **session-based auth** via Flask (`credentials: 'include'`)
2. FastAPI Phase 1 uses **JWT Bearer tokens** - requires frontend adaptation
3. 30+ API endpoints need compatibility analysis
4. Document upload flow uses Celery for async processing (OCR, vector generation)
5. RAG chat uses streaming SSE responses

**Primary recommendation:** Implement dual-authentication bridge during migration period, with nginx routing to enable gradual transition.

---

## Standard Stack

### Frontend (Existing - `/frontend`)
| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 | UI framework |
| React Router DOM | 7.10.1 | Client-side routing |
| Vite | 5.4.0 | Build tool |
| TypeScript | 5.6.0 | Type safety |
| Tailwind CSS | 4.1.18 | Styling |
| shadcn/ui | latest | Component library |
| Radix UI | various | Primitive components |
| Framer Motion | 12.23.26 | Animations |
| Sonner | 2.0.7 | Toast notifications |
| React Hook Form | n/a | Form handling |
| Zod | n/a | Validation |

### Backend (FastAPI Target)
| Library | Version | Purpose |
|---------|---------|---------|
| FastAPI | latest | Web framework |
| SQLModel | latest | ORM + Pydantic |
| python-jose | latest | JWT tokens |
| bcrypt | latest | Password hashing |
| SQLAlchemy | 2.0 | Database |
| aiosqlite | latest | Async SQLite |

---

## Current Flask API Endpoints Used by React Frontend

### Authentication APIs (`modules/api_auth.py`)
| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/api/login` | POST | `{username, password}` | `{success, user: {id, username, is_admin}, error}` | User login |
| `/api/me` | GET | - | `{authenticated, user: {...}}` | Get current user |
| `/api/logout` | POST/GET | - | `{success}` | User logout |
| `/api/libraries` | GET | - | `{libraries: [{library_id, name, knowledges}]}` | List user libraries |
| `/api/config` | GET | - | `{vector_store_mode, visual_grounding_enabled, is_admin, username}` | App config |
| `/api/branding` | GET | - | `{app_name, logo_url}` | Branding info |
| `/api/knowledges` | GET | - | `{knowledges: [...]}` | List knowledges |

### Document Upload APIs (`modules/upload.py`)
| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/upload` | POST | `multipart/form-data` | `{success, message, task_id?}` | File upload |
| `/api/check-duplicates` | POST | `{filenames, library_id, knowledge_id}` | `{duplicates: [...]}` | Check duplicate files |
| `/api/upload-status` | GET | - | `{tasks: [{task_id, status, filename, info}]}` | Upload task status |
| `/api/upload-status/{task_id}/dismiss` | POST | - | `{success}` | Dismiss completed task |
| `/api/process-url` | POST | `{url, library_id, ...}` | `{success, download_id}` | URL download |
| `/validate_url` | POST | `{url}` | `{valid, info}` | Validate URL |

### RAG Chat APIs (`modules/query.py`)
| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/api/query` | POST/GET | `{query, thread_id, library_id, knowledge_id, ...}` | SSE stream | RAG query (streaming) |
| `/api/resume_rag` | POST | `{thread_id, action}` | SSE stream | Resume/modify agent |
| `/api/confirm_web_search` | POST | `{thread_id, confirmed}` | SSE stream | Confirm web search |
| `/api/visual_evidence` | GET | `{document_id, library_id}` | Image/Data | Visual evidence preview |
| `/api/document_meta` | GET | `{document_id}` | `{metadata}` | Document metadata |
| `/api/message_metadata` | GET | `{message_id}` | `{metadata}` | Message metadata |
| `/api/get_document_chunk` | GET | `{doc_id, chunk_id}` | `{content}` | Document chunk |

### History & Feedback APIs
| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/api/threads` | GET | - | `{threads: [{id, preview, lastUpdated, messageCount}]}` | List conversations |
| `/api/threads/{thread_id}` | DELETE | - | `{success}` | Delete conversation |
| `/api/message_feedback` | POST | `{message_id, feedback_type}` | `{success}` | Thumbs up/down |
| `/api/counters` | GET | - | `{message_count, file_count, ...}` | Dashboard stats |
| `/api/self-retriever-questions` | POST | `{query}` | `{questions: [...]}` | Suggested questions |

### User Profile APIs
| Endpoint | Method | Request | Response | Purpose |
|----------|--------|---------|----------|---------|
| `/api/user/profile` | GET/PUT | `{username, ...}` | `{user}` | User profile |
| `/api/change-password` | POST | `{current_password, new_password}` | `{success}` | Change password |
| `/api/csrf-token` | GET | - | `{csrf_token}` | CSRF token |

---

## React Frontend Structure

### Core Components (`/frontend/src`)
```
src/
├── App.tsx                    # Main chat interface (2500+ lines)
├── contexts/
│   └── AuthContext.tsx        # Auth state management
├── components/
│   ├── LoginPage.tsx          # Login form
│   ├── RegisterPage.tsx       # Registration form
│   ├── UploadPage.tsx         # Document upload UI
│   ├── ChangePasswordPage.tsx # Password change
│   ├── UserProfile.tsx        # User profile editor
│   ├── NavigationMenu.tsx     # Top navigation
│   ├── HistoryPanel.tsx       # Conversation history sidebar
│   ├── KnowledgeSelector.tsx  # Library/knowledge picker
│   ├── VisualEvidence.tsx     # Visual evidence modal
│   ├── DocumentViewer.tsx     # Document viewer
│   └── upload/
│       ├── FileUploadTab.tsx  # File upload form
│       ├── UrlDownloadTab.tsx # URL download form
│       ├── UploadProgress.tsx # Progress indicator
│       └── LibraryKnowledgeSelector.tsx
├── utils/
│   ├── csrf.ts                # CSRF token handling
│   ├── fileValidation.ts      # File validation rules
│   └── cn.ts                  # Class name utility
└── components/ui/             # shadcn/ui primitives
```

### Routing (`react-router-dom`)
| Route | Component | Protected |
|-------|-----------|-----------|
| `/` | App (Chat) | Yes |
| `/login` | LoginPage | No |
| `/register` | RegisterPage | No |
| `/upload` | UploadPage | Yes |
| `/profile` | UserProfile | Yes |
| `/change-password` | ChangePasswordPage | Yes |
| `/request_password_reset` | PasswordResetRequest | No |

---

## API Contract Analysis

### Auth Context - Current Behavior
```typescript
// Current Flask session-based auth
const checkAuth = async () => {
    const response = await fetch('/api/me', {
        credentials: 'include',  // Session cookies
    })
}

const login = async (username, password) => {
    const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',  // Session cookies
        body: JSON.stringify({ username, password }),
    })
}
```

### Required FastAPI Changes
The frontend needs adaptation for JWT tokens:

**Option A: Modify Frontend (Recommended for long-term)**
- Store JWT token in localStorage or httpOnly cookie
- Add `Authorization: Bearer <token>` header to all requests
- Handle token refresh/expiration

**Option B: Backend Bridge (Recommended for migration)**
- FastAPI accepts session cookies via middleware
- FastAPI validates JWT OR session
- Gradual frontend migration

---

## Document Upload Flow

### Current Flask Flow
1. User selects files in `FileUploadTab.tsx`
2. Frontend calls `/api/check-duplicates` (POST)
3. On confirm, frontend calls `/upload` (POST multipart)
4. Flask stores file, creates DB record for `UploadedFile`
5. Flask submits Celery task via `submit_file_processing_task()`
6. Task ID stored in Redis under `user:{user_id}:upload_tasks`
7. Frontend polls `/api/upload-status` every 2 seconds
8. Worker processes: OCR (Docling) → Chunking → Embedding → sqlite-vec

### Celery Task (`modules.upload_processing.async_process_single_file`)
```python
def async_process_single_file(
    temp_file_path_from_route,
    original_filename,
    user_id,
    library_id,
    library_name,
    knowledge_id_str,
    enable_visual_grounding_flag,
    url_download_id=None,
):
    # 1. OCR processing (Docling or Azure Document Intelligence)
    # 2. Generate DoclingDocument JSON
    # 3. Chunk documents
    # 4. Generate embeddings via Qwen API
    # 5. Store vectors in sqlite-vec
    # 6. Update UploadedFile status to 'completed'
    pass
```

---

## RAG Chat Flow

### Current Flask Flow
1. User types query in `App.tsx`
2. Frontend calls `/api/query` (POST) with:
   ```json
   {
     "query": "...",
     "thread_id": "...",
     "library_id": 1,
     "knowledge_id": 2,
     "stream": true
   }
   ```
3. Flask streams SSE response with:
   - `type: 'token'` - Streaming tokens
   - `type: 'citations'` - Source citations
   - `type: 'visual_evidence'` - Images/maps/charts
   - `type: 'hil_options'` - Human-in-the-loop options
4. Frontend updates message state in real-time
5. Response saved to `MessageHistory` table

### Streaming Response Format
```python
# Flask uses Flask stream_with_context
def generate():
    yield f"data: {json.dumps({'type': 'token', 'content': '...'})}\n\n"
    yield f"data: {json.dumps({'type': 'citations', 'citations': [...]})}\n\n"
```

---

## Common Pitfalls

### 1. Authentication Mismatch
**What goes wrong:** Flask uses sessions, FastAPI uses JWT tokens
**Why it happens:** Different auth paradigms
**How to avoid:** Implement auth bridge middleware or update frontend simultaneously

### 2. Streaming Response Differences
**What goes wrong:** Flask `stream_with_context` != FastAPI `StreamingResponse`
**Why it happens:** Different streaming APIs
**How to avoid:** Use `async def` generators in FastAPI with `text/event-stream` media type

### 3. File Upload Handling
**What goes wrong:** Flask `request.files` != FastAPI `UploadFile`
**Why it happens:** Different file upload APIs
**How to avoid:** Use `fastapi.File()` and `python-multipart`

### 4. CSRF Token Handling
**What goes wrong:** Flask-WTF CSRF tokens not compatible with FastAPI
**Why it happens:** Different CSRF implementations
**How to avoid:** Either disable during migration or implement FastAPI CSRF

### 5. Celery Task Results
**What goes wrong:** AsyncResult may behave differently with different brokers
**Why it happens:** Redis backend configuration
**How to avoid:** Ensure same Redis connection in both containers

---

## Code Examples

### FastAPI Auth Endpoint (Target)
```python
# Source: modules/auth.py (Phase 1)
@app.post("/api/v1/auth/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user_async(login_data.email, login_data.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user.user_id})
    return {"access_token": access_token, "token_type": "bearer"}
```

### FastAPI Streaming Response (Target)
```python
# Pattern for RAG chat endpoint
from fastapi.responses import StreamingResponse

async def generate_stream(query: str):
    async for chunk in process_query(query):
        yield f"data: {json.dumps(chunk)}\n\n"

@app.post("/api/v1/query")
async def query_endpoint(request: QueryRequest):
    return StreamingResponse(
        generate_stream(request.query),
        media_type="text/event-stream"
    )
```

### Frontend JWT Auth (Target)
```typescript
// Updated AuthContext.tsx pattern
const login = async (email: string, password: string) => {
    const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    if (data.access_token) {
        localStorage.setItem('token', data.access_token)
        // Set default auth header
        apiClient.setToken(data.access_token)
    }
}

// API client wrapper
const apiClient = {
    setToken: (token: string) => {
        // Store for future requests
    },
    request: async (url: string, options: RequestInit) => {
        const token = localStorage.getItem('token')
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
            },
        })
    }
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT tokens | Custom token format | python-jose | Standards-compliant, security-audited |
| Password hashing | Custom crypto | bcrypt via passlib | Industry standard, timing-safe |
| Streaming SSE | Custom protocol | FastAPI StreamingResponse | Proper async handling |
| File uploads | Manual parsing | FastAPI UploadFile + python-multipart | Handles edge cases |
| CSRF | Custom tokens | fastapi-csrf or skip for JWT | JWT provides CSRF protection |

---

## Open Questions

1. **Session Bridge Duration:** How long to maintain Flask session compatibility during migration?
   - Recommendation: 2-4 weeks parallel operation

2. **Token Storage:** localStorage vs httpOnly cookies for JWT?
   - Recommendation: httpOnly cookies for security, but requires backend cookie handling

3. **Nginx Routing Strategy:** Feature flag vs path-based routing?
   - Recommendation: Path-based (`/fastapi/...`) with gradual migration

4. **Old Conversation History:** Migrate Flask message history to FastAPI format?
   - Recommendation: Same database, no migration needed

5. **Visual Grounding Preview:** Depends on DoclingDocument JSON - any FastAPI changes needed?
   - Recommendation: Reuse existing modules, no changes needed

---

## Sources

### Primary (HIGH confidence)
- `/home/mlk/smartlib-basic/frontend/src/App.tsx` - Main chat component
- `/home/mlk/smartlib-basic/frontend/src/contexts/AuthContext.tsx` - Auth context
- `/home/mlk/smartlib-basic/modules/api_auth.py` - Flask API auth endpoints
- `/home/mlk/smartlib-basic/modules/upload.py` - Upload endpoints
- `/home/mlk/smartlib-basic/modules/query.py` - RAG chat endpoints
- `/home/mlk/smartlib-basic/modules/auth.py` - FastAPI auth utilities (Phase 1)
- `/home/mlk/smartlib-basic/main_fastapi.py` - FastAPI app (Phase 1)

### Secondary (MEDIUM confidence)
- `/home/mlk/smartlib-basic/frontend/package.json` - Frontend dependencies
- `/home/mlk/smartlib-basic/modules/celery_tasks.py` - Celery task submission
- `/home/mlk/smartlib-basic/modules/upload_processing.py` - File processing logic

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from package.json and imports
- Architecture: HIGH - Analyzed actual source code
- API contracts: HIGH - Read endpoint implementations
- Pitfalls: MEDIUM - Based on experience, may have undiscovered issues

**Research date:** 2026-02-25
**Valid until:** 30 days (stable stack)
