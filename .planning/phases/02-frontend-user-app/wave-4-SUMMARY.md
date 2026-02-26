# Wave 4 Summary: File Management & User Data

**Phase:** 2 - Frontend User App (/app)
**Wave:** 4/6
**Date:** 2026-02-26
**Status:** COMPLETE

---

## Executive Summary

Wave 4 successfully implemented file management and user data endpoints for FastAPI:
- File CRUD endpoints with ownership filtering (already provided by CRUDRouter)
- File delete with vector cleanup from sqlite-vec
- File download endpoint
- User profile endpoints (GET/PUT)
- User stats endpoint

All endpoints are available at `/api/v1/*` paths and integrate with the existing authentication system.

---

## Deliverables

### 1. File Management Endpoints

#### GET `/api/v1/files/` (CRUDRouter)
- Lists user's uploaded files with pagination
- Ownership filtering applied automatically (non-admin users see only their files)
- Returns paginated `UploadedFile` records

#### GET `/api/v1/files/{file_id}` (CRUDRouter)
- Get single file details
- Ownership check enforced (403 for non-owners)

#### DELETE `/api/v1/files/{file_id}` (Custom handler)
- Delete file with comprehensive cleanup:
  - Removes `UploadedFile` record
  - Removes associated `Document` records (vectors cleaned via cascade)
  - Removes `VectorReference` records
  - Removes `LibraryReference` records
  - Removes `VisualGroundingActivity` records
  - Deletes physical file from disk
- Ownership check enforced (admin can delete any file)
- Returns count of vector chunks removed

#### GET `/api/v1/files/{file_id}/download`
- Download original file
- Ownership check enforced
- Returns file via `FileResponse` with original filename

### 2. User Profile Endpoints

#### GET `/api/v1/user/profile`
- Returns current authenticated user's profile
- Response: `{user_id, username, email, is_admin, created_at}`

#### PUT `/api/v1/user/profile`
- Update user profile (username, email)
- Validates uniqueness of username and email
- Returns updated profile

### 3. User Stats Endpoint

#### GET `/api/v1/user/stats`
- Returns user statistics:
  - `file_count`: Number of files uploaded by user
  - `total_file_size_bytes`: Total storage used
  - `message_count`: Number of messages sent
  - `library_count`: Total libraries in system
  - `knowledge_count`: Total knowledges in system

---

## Files Modified

### schemas.py
Added 3 new schemas:
- `UserProfile` - User profile response
- `UserProfileUpdate` - Profile update request
- `UserStats` - User statistics response

### modules/models.py
Added 4 new models:
- `Document` - Document chunks table (for vector store)
- `LibraryReference` - Library-file/download associations
- `VectorReference` - Vector chunk tracking
- `VisualGroundingActivity` - Visual grounding activity tracking

### main_fastapi.py
Added imports:
- `UserProfile`, `UserProfileUpdate`, `UserStats` schemas
- `Document`, `LibraryReference`, `VectorReference`, `VisualGroundingActivity` models
- `FileResponse` from fastapi.responses

Added endpoints:
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile` - Update user profile
- `GET /api/v1/user/stats` - Get user stats
- `GET /api/v1/files/{file_id}/download` - Download file
- `DELETE /api/v1/files/{file_id}` - Delete file with cleanup

---

## Technical Implementation Details

### File CRUDRouter
The existing `CRUDRouter` in `modules/crud_router.py` already provides:
- `GET /api/v1/files/` - List files with pagination
- `GET /api/v1/files/{file_id}` - Get single file
- `POST /api/v1/files/` - Create file record
- `PUT /api/v1/files/{file_id}` - Update file
- `DELETE /api/v1/files/{file_id}` - Delete file (overridden by custom handler)

The router is configured with `user_field="user_id"` for automatic ownership filtering.

### Vector Cleanup on Delete
For sqlite-vec provider:
- Vectors are stored in the `document_vectors` table
- Document records in `documents` table reference vectors
- When `Document` records are deleted, vectors are cleaned up automatically via database cascade deletes
- Custom delete handler removes all related records:
  - `Document` records (triggers vector cleanup)
  - `VectorReference` tracking records
  - `LibraryReference` associations
  - `VisualGroundingActivity` records

### File Download
- Files located via `DATA_VOLUME_PATH` environment variable
- Searches in `uploaded_files/` and `uploads/` subdirectories
- Returns `FileResponse` with original filename for proper download behavior

### Ownership Enforcement
- All file endpoints enforce ownership checking
- Admin users (`is_admin=True`) can access any file
- Regular users can only access their own files
- Returns 403 Forbidden for unauthorized access

---

## Testing Performed

- [x] Syntax validation (`python3 -m py_compile`)
- [ ] Manual endpoint testing (TODO)
- [ ] Integration testing with frontend (TODO)

---

## Known Limitations

1. **File Path Discovery**: File download assumes files are in `DATA_VOLUME_PATH/uploaded_files/` or `DATA_VOLUME_PATH/uploads/`. If files are stored elsewhere, download will fail with 404.

2. **Physical File Cleanup**: If the physical file is missing but database record exists, delete succeeds but file removal is silently skipped.

3. **Document Association Logic**: The delete endpoint finds documents by matching `source`, `library_id`, and `knowledge_id`. This may not be 100% accurate if multiple files have the same name in the same library/knowledge.

---

## Dependencies

### External Libraries
- None (uses existing FastAPI and SQLModel)

### Internal Modules
- `modules.crud_router.CRUDRouter` - File CRUD endpoints
- `modules.auth.get_current_user` - Authentication
- `modules.models` - SQLModel database models

---

## Next Steps (Wave 5)

1. **RAG Chat Migration**
   - Streaming query endpoint (`POST /api/v1/query`)
   - Conversation history endpoints
   - Message feedback endpoints
   - Auxiliary endpoints (config, branding, counters, etc.)

---

## Success Criteria Status

| Criterion | Status |
|-----------|--------|
| File list endpoint with ownership filtering | DONE |
| File details endpoint | DONE |
| File delete with vector cleanup from sqlite-vec | DONE |
| File download endpoint | DONE |
| User profile endpoint (GET/PUT) | DONE |
| User stats endpoint | DONE |

---

## API Reference

### File Management

```json
// GET /api/v1/files/ response (paginated)
{
  "items": [
    {
      "file_id": 1,
      "user_id": "uuid",
      "library_id": 1,
      "knowledge_id": 1,
      "original_filename": "doc.pdf",
      "stored_filename": "uuid.pdf",
      "file_size": 1234567,
      "upload_time": "2026-02-26T12:00:00Z",
      "is_ocr": false
    }
  ],
  "total": 10,
  "page": 1,
  "size": 50
}

// DELETE /api/v1/files/{file_id} response
{
  "status": "success",
  "message": "File deleted successfully. Removed 15 vector chunk(s)."
}
```

### User Profile

```json
// GET /api/v1/user/profile response
{
  "user_id": "uuid",
  "username": "john_doe",
  "email": "john@example.com",
  "is_admin": false,
  "created_at": "2026-01-01T00:00:00Z"
}

// PUT /api/v1/user/profile request
{
  "username": "new_username",
  "email": "new@example.com"
}
```

### User Stats

```json
// GET /api/v1/user/stats response
{
  "file_count": 25,
  "total_file_size_bytes": 12345678,
  "message_count": 150,
  "library_count": 5,
  "knowledge_count": 12
}
```

---

*Wave 4 completed: 2026-02-26*
