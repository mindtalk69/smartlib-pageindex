# Pitfalls: Flask to FastAPI Migration

## Pitfall 1: Breaking Existing Flask During Migration

**Description:** Modifying shared resources (database models, config) in ways that break the running Flask app.

**Warning Signs:**
- SQLAlchemy model changes that Flask depends on
- Database schema changes without migration scripts
- Config key changes that Flask reads

**Prevention Strategy:**
- Keep SQLModel models backward-compatible with SQLAlchemy
- Never modify `modules/database.py` (Flask's models) during migration
- Use Alembic for any schema changes
- Test Flask app after every FastAPI change

**Phase:** All phases - ongoing concern

---

## Pitfall 2: SQLite Concurrency Issues

**Description:** SQLite + aiosqlite can have locking issues under concurrent load if not configured properly.

**Warning Signs:**
- `sqlite3.OperationalError: database is locked`
- Slow response times under load
- Failed writes during reads

**Prevention Strategy:**
- Use `check_same_thread=False` (already done)
- Configure connection pool properly
- Consider WAL mode for better concurrent reads
- Use async sessions consistently

**Phase:** Phase 1 (API Foundation)

---

## Pitfall 3: Celery Integration Gaps

**Description:** FastAPI app and Celery workers may not share the same application context.

**Warning Signs:**
- Celery tasks can't import FastAPI modules
- Circular import errors
- Task results don't reflect in FastAPI

**Prevention Strategy:**
- Keep Celery imports isolated in `celery_app.py`
- Use shared modules (`modules/models.py`) that both can import
- Test task execution end-to-end early

**Phase:** Phase 1 (API Foundation)

---

## Pitfall 4: SQLAdmin Security Gaps

**Description:** SQLAdmin provides instant CRUD but may expose sensitive operations without proper auth.

**Warning Signs:**
- Admin UI accessible without login
- Users can delete critical records
- API keys visible in admin UI

**Prevention Strategy:**
- Add authentication middleware to SQLAdmin
- Customize ModelView classes to hide sensitive fields
- Add delete confirmation dialogs
- Audit SQLAdmin config before production

**Phase:** Phase 3 (Admin Dashboard)

---

## Pitfall 5: Frontend API Mismatch

**Description:** React frontend expects certain API shapes that FastAPI doesn't provide.

**Warning Signs:**
- 404 errors from frontend
- Response format mismatches
- CORS errors

**Prevention Strategy:**
- Document all API endpoints in OpenAPI
- Maintain backward-compatible API shapes where possible
- Update frontend API client incrementally
- Use Nginx to route old endpoints to Flask during transition

**Phase:** Phase 2 (Frontend)

---

## Pitfall 6: Vector Storage Compatibility

**Description:** sqlite-vec operations may behave differently between sync (Flask) and async (FastAPI) contexts.

**Warning Signs:**
- Vector search returns different results
- Embedding generation fails
- Similarity scores inconsistent

**Prevention Strategy:**
- Test vector operations in both contexts
- Use the same embedding model config
- Verify sqlite-vec extension loaded in both engines

**Phase:** Phase 4 (RAG Integration)

---

## Pitfall 8: Agent Complexity - Async/Sync Mismatch

**Description:** The LangGraph/LangChain agent code is complex and may be synchronous while FastAPI expects async for streaming to React.

**Warning Signs:**
- Agent blocks the event loop during RAG queries
- Streaming responses don't work with async React frontend
- Celery tasks called synchronously from FastAPI

**Prevention Strategy:**
- Run agent in separate thread/process (`run_in_executor`)
- Use Celery for async agent execution with task status polling
- Implement Server-Sent Events (SSE) for streaming responses
- Keep agent logic isolated in `modules/agent.py` - don't mix with routes

**Phase:** Phase 4 (RAG Integration) - but design in Phase 1

## Pitfall 9: Skipping Verification Steps

**Description:** Assuming FastAPI endpoints work because they "look right" without testing.

**Warning Signs:**
- Endpoints return 200 but wrong data
- Pagination doesn't work
- Filters silently ignored

**Prevention Strategy:**
- Write integration tests for each endpoint
- Use httpx for async testing
- Manual verification via /docs before claiming done
- Phase verifier agent to check requirements

**Phase:** All phases - verification gates

---

## Pitfall 10: Not Analyzing Flask Code First

**Description:** Creating FastAPI endpoints without first understanding the existing Flask routes and their behavior.

**Warning Signs:**
- FastAPI endpoints have different request/response shapes than Flask
- React /app breaks because API contracts changed
- Missing business logic that was in Flask routes

**Prevention Strategy:**
- First: Read and document all `@app.route` decorators in `app.py` and `main.py`
- Create a route mapping table: Flask route → FastAPI endpoint
- Keep API contracts identical during migration
- Test /app with FastAPI using feature flag before full switchover

**Phase:** Phase 1 (API Foundation) - this is the critical first step

## Migration-Specific Checklist

| Phase | What to Verify |
|-------|----------------|
| 1 | Flask still runs, SQLAdmin accessible, CRUD endpoints work |
| 2 | React can call FastAPI, uploads succeed |
| 3 | Admin can manage users/models |
| 4 | RAG queries return correct answers with citations |
| 5 | Nginx routes correctly, Flask can be deprecated |

---
*Last updated: 2026-02-24*
