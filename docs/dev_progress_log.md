# SmartLib Dev Progress Log

## 2025-10-26 – Timeout + Docker Slimming Updates
- Added `GUNICORN_TIMEOUT` support in `docker-entrypoint.sh` so web workers can run longer-lived requests; defaulted to 120s and set to 240s in Compose.
- Surfaced `AGENT_TASK_TIMEOUT` via `Config` and passed it to `invoke_agent_via_worker`, aligning Celery task wait time with Gunicorn’s timeout (both now 240s in Compose).
- Updated `docker-compose.yaml` to export the new timeout environment variables for both web and worker services.
- Introduced `.dockerignore` (copied from prior project) and rebuilt images; web image size dropped from ~5.4GB to ~1.27GB after excluding `.venv/` and other dev artifacts.
- Rebuilt containers to pick up the new settings; first RAG query may still warm up embeddings, but the increased timeouts prevent premature 500s.
- Routed upload temp storage through `Config.UPLOAD_TEMP_DIR`, ensuring Celery workers can access web-written files, cleaning up temp folders after processing, aligned Chroma base path (`LOCAL_VECTOR_STORE_BASE_PATH`) with the actual `data/chroma` directory so admin storage metrics populate correctly, normalized SQLite URIs so web/worker read the mounted `/app/data/app.db` file after rebuild, and added map handling improvements: generated HTML/PNG assets now live under `MAP_PUBLIC_DIR` (`data/maps`) with a `/generated-maps/<file>` route, optional PNG capture (`MAP_GENERATE_PNG` in `.env`), scheduled Celery retention cleanup, and an admin button to purge stale maps on demand.
- Added automated conversation retention: configurable env vars (`MESSAGE_RETENTION_ENABLED`, `MESSAGE_RETENTION_DAYS`, `MESSAGE_CLEANUP_INTERVAL_HOURS`) drive a Celery task that prunes old `message_history` rows plus feedback and runs on the same worker beat schedule.
- **Planned**: Enable server-side chart rendering for the DataFrame agent (execute matplotlib/seaborn, store chart assets alongside maps, and surface URLs back to the client).

## 2025-10-27 – Streaming UX Enhancements & Dependencies
- Enabled streaming on the web container by installing the full LangGraph + Hugging Face stack (`langchain-huggingface`, `sentence-transformers`, etc.) so SSE queries reuse the same BGE-M3 embeddings path as Celery worker jobs.
- Updated `modules/agent.py` to grab a proper SQLAlchemy session (`db.session`) during streaming and avoid write failures when persisting partial responses.
- Added chunk-by-chunk UI polish: streaming agent bubbles now pulse as text arrives, display a live progress bar with chunk counters, and fall back cleanly when a stream aborts.
- Hardened the front-end typewriter pipeline to accumulate partial text, merge metadata, and finalize messages only after the stream completes, preventing stale caret states.
- Added console diagnostics and cache-busting tweaks (`Config.APP_VERSION`) to ensure rebuilt assets invalidate the browser cache during rapid UI iteration.
- **Next**: Tune the progress bar styling for dark mode and explore a lightweight “look-ahead” chunk summary before final render.
