# Wave 4 TODO: File Management & User Data

**Phase:** 2 - Frontend User App (/app)
**Wave:** 4/6
**Status:** IN PROGRESS

---

## Tasks

### 1. File Management Endpoints
- [ ] POST `/api/v1/upload` - Already exists (Wave 3)
- [ ] GET `/api/v1/files` - List user's uploaded files (CRUDRouter)
- [ ] GET `/api/v1/files/{file_id}` - Get file details (CRUDRouter)
- [ ] DELETE `/api/v1/files/{file_id}` - Delete file with vector cleanup
- [ ] GET `/api/v1/files/{file_id}/download` - Download file

### 2. Vector Cleanup on Delete
- [ ] Import delete_vector_store from modules.vector_store_utils
- [ ] Create custom delete handler that removes vectors from sqlite-vec
- [ ] Clean up DoclingDocument JSON

### 3. User Profile Endpoints
- [ ] GET `/api/v1/user/profile` - Get current user profile
- [ ] PUT `/api/v1/user/profile` - Update user profile

### 4. User Stats Endpoint
- [ ] GET `/api/v1/user/stats` - User statistics (file count, message count, etc.)

---

## Implementation Notes

### File CRUDRouter
- Already exists in modules/crud_router.py
- Need to register with user_field="user_id" for ownership filtering
- Custom delete handler needed for vector cleanup

### Vector Cleanup
- Check modules/vector_store_utils.py for delete_vector_store function
- May need to adapt for FastAPI/SQLAlchemy

### User Profile
- Simple GET/PUT endpoints for User model
- Allow updating username, password change (separate endpoint)

### User Stats
- Count files uploaded by user
- Count messages sent by user
- Maybe storage used, libraries/knowledges access

---

## Files to Modify

1. `main_fastapi.py` - Add file, user profile, stats endpoints
2. `schemas.py` - Add user profile and stats schemas
3. Possibly create `modules/vector_store_utils.py` if not exists

---

## Success Criteria

- [ ] File list endpoint with ownership filtering
- [ ] File details endpoint
- [ ] File delete with vector cleanup from sqlite-vec
- [ ] File download endpoint
- [ ] User profile endpoint (GET/PUT)
- [ ] User stats endpoint
- [ ] SUMMARY.md created
- [ ] STATE.md updated
