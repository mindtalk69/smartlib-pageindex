---
phase: 09-content-management-settings
plan: 04
title: "Application Settings Management Endpoints"
one_liner: "App settings CRUD with FastAPI endpoints for viewing and updating configuration with max_active_users validation"
status: complete
completed_date: "2026-02-27"
tasks_completed: 3
duration_minutes: 5
files_modified: 2
deviations: "None"

subsystem: "Admin API"
tags: ["fastapi", "settings", "admin", "validation"]
requirements_met: ["SET-01", "SET-02", "SET-03"]

dependency_graph:
  requires:
    - provider: "Phase 07"
      description: "LLM Provider endpoints pattern"
    - provider: "Phase 08"
      description: "Language endpoints pattern"
  provides:
    - consumer: "Frontend useSettings hook"
      description: "Settings API endpoints"
  affects:
    - component: "AppSettings table"
      description: "Direct read/write operations"

tech_stack:
  added:
    - "AppSettingsResponse schema"
    - "SettingsUpdateRequest schema"
    - "SettingsUpdateResponse schema"
    - "GET /api/v1/admin/settings endpoint"
    - "POST /api/v1/admin/settings/update endpoint"
  patterns:
    - "Admin auth with get_current_admin_user dependency"
    - "Type conversion for numeric settings (max_active_users)"
    - "Validation with HTTPException"
    - "Upsert pattern (update or insert) for settings"

key_files:
  created: []
  modified:
    - path: "schemas.py"
      changes: "Added 3 settings schemas (AppSettingsResponse, SettingsUpdateRequest, SettingsUpdateResponse)"
    - path: "main_fastapi.py"
      changes: "Added 2 settings endpoints with imports and validation logic"

decisions: []

deviations: "None - plan executed exactly as written"
---

# Phase 09 Plan 04: Application Settings Management Endpoints Summary

## Objective

Implement application settings endpoints for viewing and updating app configuration. Close gaps SET-01, SET-02, SET-03 by adding schemas and two FastAPI endpoints for settings management.

## What Was Built

### 1. Settings Schemas (schemas.py)

Added three new schema classes for settings management:

- **AppSettingsResponse** - Response for GET /api/v1/admin/settings
  - `success: bool = True`
  - `settings: Dict[str, Any] = {}` - All settings as key-value pairs
  - `active_user_count: Optional[int] = None` - Current active user count

- **SettingsUpdateRequest** - Request body for POST /api/v1/admin/settings/update
  - `settings: Dict[str, Any]` - Settings to update (can be partial)

- **SettingsUpdateResponse** - Response for settings update
  - `success: bool = True`
  - `message: str` - Summary message
  - `updated_keys: List[str] = []` - List of keys that were updated

### 2. Get Settings Endpoint (SET-01)

**GET /api/v1/admin/settings**

- Requires admin authentication via `get_current_admin_user` dependency
- Queries all AppSettings records ordered by key
- Converts `max_active_users` to integer type (other values remain strings)
- Counts active users (non-disabled) for validation context
- Returns settings dictionary with active_user_count

**Response format:**
```json
{
  "success": true,
  "settings": {
    "max_active_users": 10,
    "app_name": "SmartLib",
    "logo_url": "/static/logo.png",
    "primary_color": "#3b82f6"
  },
  "active_user_count": 5
}
```

### 3. Update Settings Endpoint (SET-02, SET-03)

**POST /api/v1/admin/settings/update**

- Requires admin authentication
- Accepts partial settings updates (only keys in request are modified)
- Validates `max_active_users`:
  - Must be a valid integer
  - Must be >= 1
  - Must be >= current active user count
- Creates new settings if they don't exist (upsert pattern)
- Returns success message with list of updated keys

**Request format:**
```json
{
  "settings": {
    "max_active_users": 15,
    "app_name": "My App"
  }
}
```

**Response format:**
```json
{
  "success": true,
  "message": "Updated 2 setting(s).",
  "updated_keys": ["max_active_users", "app_name"]
}
```

**Error handling:**
- 400 for validation failures (invalid int, < 1, < active_count)
- 500 for database errors

## Implementation Details

### Settings Supported

- **max_active_users** (int) - Maximum number of active users allowed
- **app_name** (string) - Application name
- **logo_url** (string) - URL to application logo
- **primary_color** (string) - Primary theme color (hex)

### Type Conversion

The `max_active_users` setting is stored as a string in the database but returned as an integer for proper frontend handling. This matches the Flask implementation pattern.

### Active User Count

The active user count is calculated by querying the User table for non-disabled users:
```python
count_statement = select(func.count(User.id)).where(User.is_disabled == False)
active_user_count = db.exec(count_statement).one()
```

This provides validation context to prevent setting max_active_users below the current count.

### Database Operations

- **Read**: `db.exec(select(AppSettings).order_by(AppSettings.key)).all()`
- **Upsert**: Check if setting exists with `db.get(AppSettings, key)`, then update or create new
- **Commit**: All changes committed in single transaction with rollback on error

## Verification

### Success Criteria Met

1. [x] Three settings schemas exist in schemas.py
2. [x] Two new FastAPI endpoints exist in main_fastapi.py for settings
3. [x] Both endpoints require admin authentication via get_current_admin_user
4. [x] Get endpoint returns max_active_users as integer type
5. [x] Get endpoint includes active_user_count from count query
6. [x] Update endpoint validates max_active_users properly (type, minimum, active count)
7. [x] Update endpoint handles both new and existing settings
8. [x] Response format matches frontend expectations

### Manual Testing Commands

```bash
# Get settings (should return 200 with settings dict)
curl "http://localhost:8001/api/v1/admin/settings" \
  -H "Authorization: Bearer TOKEN" | jq '.'

# Update settings (should return 200 with updated keys)
curl -X POST "http://localhost:8001/api/v1/admin/settings/update" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"max_active_users":15,"app_name":"My App"}}' | jq '.'

# Test validation - invalid type (should return 400)
curl -X POST "http://localhost:8001/api/v1/admin/settings/update" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"max_active_users":"invalid"}}' | jq '.'

# Test validation - below minimum (should return 400)
curl -X POST "http://localhost:8001/api/v1/admin/settings/update" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"max_active_users":0}}' | jq '.'
```

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | cec5484 | feat(09-04): add Settings schemas to schemas.py |
| 2 | b2131ee | feat(09-04): add get settings endpoint (SET-01) |
| 3 | f3c51db | feat(09-04): add update settings endpoint with validation (SET-02, SET-03) |

## Dependencies & References

### Pattern References

- Phase 07-08 LLM Provider endpoints (admin auth pattern, error handling)
- Flask `modules/admin_settings.py` (validation logic for max_active_users)
- Database functions from `modules/database.py` (count_active_users pattern)

### Frontend Integration

These endpoints will be consumed by a `useSettings` hook to be created in the frontend Phase 09 work. The response format is designed to match the expected frontend interface.

## Deviations from Plan

**None - plan executed exactly as written.**

## Next Steps

1. Frontend: Create `useSettings` hook for settings management
2. Frontend: Create Settings page component
3. Consider adding additional setting types (boolean, float) with proper type conversion
4. Consider adding setting validation at the schema level (Pydantic validators)

## Files Modified

- `schemas.py` (+33 lines)
- `main_fastapi.py` (+312 lines: imports, 2 endpoints)

## Total Execution Time

~5 minutes (285 seconds)
