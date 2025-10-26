# SmartLib Dev Progress Log

## 2025-10-26 – Timeout + Docker Slimming Updates
- Added `GUNICORN_TIMEOUT` support in `docker-entrypoint.sh` so web workers can run longer-lived requests; defaulted to 120s and set to 240s in Compose.
- Surfaced `AGENT_TASK_TIMEOUT` via `Config` and passed it to `invoke_agent_via_worker`, aligning Celery task wait time with Gunicorn’s timeout (both now 240s in Compose).
- Updated `docker-compose.yaml` to export the new timeout environment variables for both web and worker services.
- Introduced `.dockerignore` (copied from prior project) and rebuilt images; web image size dropped from ~5.4GB to ~1.27GB after excluding `.venv/` and other dev artifacts.
- Rebuilt containers to pick up the new settings; first RAG query may still warm up embeddings, but the increased timeouts prevent premature 500s.
