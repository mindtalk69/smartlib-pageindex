# Flask to FastAPI Route Mapping

**Generated:** 2026-02-24
**Purpose:** Map existing Flask routes to FastAPI equivalents for migration

---

## API Routes (Priority 1 - Migrate First)

These are the API endpoints that the React frontend calls. Migrating these enables /app to switch from Flask to FastAPI.

### Authentication APIs
| Flask Route | Method | Module | FastAPI Path | Priority |
|-------------|--------|--------|--------------|----------|
| `/api/login` | POST | api_auth.py | `/api/v1/auth/login` | P0 |
| `/api/me` | GET | api_auth.py | `/api/v1/auth/me` | P0 |
| `/api/logout` | POST/GET | api_auth.py | `/api/v1/auth/logout` | P0 |
| `/api/csrf-token` | GET | app.py | `/api/v1/auth/csrf-token` | P0 |

### Config & Branding APIs
| Flask Route | Method | Module | FastAPI Path | Priority |
|-------------|--------|--------|--------------|----------|
| `/api/config` | GET | api_auth.py | `/api/v1/config` | P0 |
| `/api/branding` | GET | api_auth.py | `/api/v1/branding` | P0 |
| `/api/libraries` | GET | api_auth.py | `/api/v1/libraries` | P0 |
| `/api/knowledges` | GET | api_auth.py | `/api/v1/knowledges` | P0 |
| `/api/document_content/<lib_id>/<doc_id>` | GET | api_auth.py | `/api/v1/documents/{lib_id}/{doc_id}/content` | P1 |

### Query & RAG APIs
| Flask Route | Method | Module | FastAPI Path | Priority |
|-------------|--------|--------|--------------|----------|
| `/api/query` | GET/POST | query.py | `/api/v1/query` | P0 |
| `/api/resume_rag` | POST | query.py | `/api/v1/rag/resume` | P1 |
| `/api/get_document_chunk` | GET | query.py | `/api/v1/documents/chunk` | P1 |
| `/api/message_metadata` | GET | query.py | `/api/v1/messages/{id}/metadata` | P1 |
| `/api/document_meta` | GET | query.py | `/api/v1/documents/{id}/meta` | P1 |
| `/api/visual_evidence` | GET | query.py | `/api/v1/documents/{id}/visual-evidence` | P1 |
| `/api/confirm_web_search` | POST | query.py | `/api/v1/search/confirm` | P2 |
| `/api/self-retriever-questions` | POST | selfquery.py | `/api/v1/self-query/questions` | P2 |
| `/api/self-retriever` | POST | selfquery.py | `/api/v1/self-query` | P2 |

### Upload APIs
| Flask Route | Method | Module | FastAPI Path | Priority |
|-------------|--------|--------|--------------|----------|
| `/upload` | GET | upload.py | `/api/v1/upload` | P1 |
| `/upload` | POST | upload.py | `/api/v1/upload` | P0 |
| `/api/check-duplicates` | POST | upload.py | `/api/v1/upload/check-duplicates` | P1 |
| `/validate_url` | POST | upload.py | `/api/v1/upload/validate-url` | P1 |
| `/process_url` | POST | upload.py | `/api/v1/upload/process-url` | P1 |
| `/api/upload-status` | GET | upload.py | `/api/v1/upload/status` | P1 |
| `/api/upload-status/<task_id>/dismiss` | POST | upload.py | `/api/v1/upload/{task_id}/dismiss` | P1 |
| `/api/folder-upload/upload` | POST | admin_folder_upload.py | `/api/v1/upload/folder` | P2 |

### Message & Feedback APIs
| Flask Route | Method | Module | FastAPI Path | Priority |
|-------------|--------|--------|--------------|----------|
| `/api/history` | GET | index.py | `/api/v1/history` | P1 |
| `/api/counters` | GET | index.py | `/api/v1/counters` | P1 |
| `/message_feedback` | POST | feedback.py | `/api/v1/feedback` | P2 |

---

## Admin API Routes (Priority 2 - For React Admin)

### Users API
| Flask Route | Method | Module | FastAPI Path |
|-------------|--------|--------|--------------|
| `/api/users` | GET | admin_users.py | `/api/v1/admin/users` |
| `/api/users/<user_id>` | GET | admin_users.py | `/api/v1/admin/users/{user_id}` |
| `/api/users/<user_id>` | PUT/PATCH | admin_users.py | `/api/v1/admin/users/{user_id}` |
| `/api/users/<user_id>` | DELETE | admin_users.py | `/api/v1/admin/users/{user_id}` |
| `/api/users/<user_id>/reset-password` | POST | admin_users.py | `/api/v1/admin/users/{user_id}/reset-password` |

### Files API
| Flask Route | Method | Module | FastAPI Path |
|-------------|--------|--------|--------------|
| `/api/files` | GET | admin_files.py | `/api/v1/admin/files` |
| `/api/files/<file_id>` | DELETE | admin_files.py | `/api/v1/admin/files/{file_id}` |

### Downloads API
| Flask Route | Method | Module | FastAPI Path |
|-------------|--------|--------|--------------|
| `/api/downloads/` | GET | admin_downloads.py | `/api/v1/admin/downloads` |
| `/api/downloads/delete/<id>` | POST | admin_downloads.py | `/api/v1/admin/downloads/{id}/delete` |

---

## Frontend Routes (Serve React Builds)

| Flask Route | Module | FastAPI Equivalent |
|-------------|--------|-------------------|
| `/` | index.py | Serve `/app` React build |
| `/app/` | index.py | Serve `/app` React build |
| `/app/<path>` | index.py | Serve `/app` React build (SPA routing) |
| `/app-admin/` | index.py | Serve `/admin-app` React build |
| `/app-admin/<path>` | index.py | Serve `/admin-app` React build |
| `/generated-maps/<path>` | index.py | Serve static files |

---

## Admin UI Routes (Replace with React Admin)

These are currently Flask-rendered admin pages. They will be replaced by the React admin frontend at `/admin-app`.

### Core Admin
| Flask Route | Module | Notes |
|-------------|--------|-------|
| `/admin/` | admin.py | Replace with React admin dashboard |
| `/admin/dashboard` | admin.py | → React admin |
| `/admin/users/` | admin_users.py | → React admin user management |
| `/admin/files` | admin.py | → React admin file management |
| `/admin/downloads` | admin_downloads.py | → React admin |
| `/admin/feedback` | admin_feedback.py | → React admin |

### Settings Admin
| Flask Route | Module | Notes |
|-------------|--------|-------|
| `/admin/settings/visual_grounding` | admin.py | → React admin |
| `/admin/settings/ocr` | admin.py | → React admin |
| `/admin/settings/vectorstore` | admin.py | → React admin |

### Entity Management (CRUD)
| Flask Route | Module | Notes |
|-------------|--------|-------|
| `/admin/libraries/` | admin_libraries.py | → React admin (or SQLAdmin) |
| `/admin/knowledges/` | admin_knowledges.py | → React admin |
| `/admin/providers/` | admin_providers.py | → React admin |
| `/admin/models/` | admin_models.py | → React admin |
| `/admin/languages/` | admin_languages.py | → React admin |
| `/admin/categories/` | admin.py | → React admin |
| `/admin/catalogs/` | admin_catalogs.py | → React admin |
| `/admin/groups/` | admin_groups.py | → React admin |
| `/admin/user_groups/` | admin_user_groups.py | → React admin |
| `/admin/embeddings/` | admin_embeddings.py | → React admin |
| `/admin/vector-references/` | admin_vector_references.py | → React admin |

---

## User-Facing Routes (Keep in Flask During Migration)

| Flask Route | Module | Notes |
|-------------|--------|-------|
| `/login` | login.py | Keep in Flask, add FastAPI equivalent |
| `/register` | register.py | Keep in Flask, add FastAPI equivalent |
| `/logout` | logout.py | Keep in Flask, add FastAPI equivalent |
| `/forgot-password` | password_reset_requests.py | Keep in Flask |
| `/change_password` | change_password.py | Keep in Flask |
| `/login_azure` | login_azure.py | Keep in Flask |
| `/view_document/<lib_id>/<path>` | view_document.py | Keep in Flask |
| `/about` | about.py | Static page, low priority |

---

## CRUDRouter Endpoints (Already in FastAPI)

The existing `modules/crud_router.py` already provides these for all SQLModel models:

| Model | Endpoints |
|-------|-----------|
| All models | `GET /` (list with pagination) |
| All models | `GET /{id}` (get one) |
| All models | `POST /` (create) |
| All models | `PUT /{id}` (update) |
| All models | `DELETE /{id}` (delete) |

**Models covered:** User, Group, Library, Knowledge, UploadedFile, MessageHistory, LLMProvider, ModelConfig, AppSettings, LLMPrompt, LLMLanguage

---

## Migration Priority Summary

### P0 (Phase 1 - API Foundation)
- `/api/v1/auth/*` - Authentication endpoints
- `/api/v1/config` - App config
- `/api/v1/branding` - Branding
- `/api/v1/libraries` - List libraries
- `/api/v1/knowledges` - List knowledges
- `/api/v1/upload` (POST) - File upload
- `/api/v1/query` - RAG query

### P1 (Phase 2 - User App)
- Document content endpoints
- Upload status & validation
- Message history & metadata
- Resume RAG

### P2 (Phase 3 - Admin API)
- Admin user management APIs
- Admin file management APIs
- Advanced query features

### P3 (Phase 5 - Full Migration)
- User-facing routes (login, register, etc.)
- Static pages

---

## Key Observations

1. **API endpoints are already separated** in `modules/api_auth.py`, `modules/query.py`, etc. - easy to migrate

2. **Admin routes use Flask blueprints** (`@admin_bp.route`) - can be replaced by React admin + FastAPI API

3. **React frontend already exists** at `/app/` - just needs API base URL switch

4. **CRUDRouter already provides** basic CRUD for all models - may cover admin API needs

5. **Complex logic in `query.py`** (~1300+ lines) - needs careful async adaptation for FastAPI

---

## Next Steps

1. **Create FastAPI routers** for each priority category:
   - `api/v1/auth.py` - Authentication
   - `api/v1/query.py` - RAG queries
   - `api/v1/upload.py` - File upload
   - `api/v1/admin.py` - Admin APIs

2. **Port route logic** from Flask to FastAPI:
   - Copy request handling logic
   - Convert `request.json` → `Body()`
   - Convert `flask.session` → JWT tokens
   - Convert `@login_required` → `Depends(get_current_user)`

3. **Test with React /app**:
   - Switch API base URL
   - Verify each endpoint works

---
*Generated: 2026-02-24*
