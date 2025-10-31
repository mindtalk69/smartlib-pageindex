# SmartLib Dev Progress Log

## 2025-10-31 – Azure Files Shared Storage
- Updated all App Service ARM templates to add Azure Files parameters and mount `/home/data` so worker and web containers share uploads, maps, and vector assets.
- Refreshed `ARMtemplate/docs/QUICK_START_GUIDE.md` deployment commands to include `storageAccountName`, `dataShareName`, and `storageAccountKey`, and called out the new storage prerequisite in the checklist.
- Added SQLite preflight + WAL fallback in `docker-entrypoint.sh`/`extensions.py` so the new SMB mount reliably creates and opens `/home/data/app.db` before running migrations or seed scripts, and switched the default embedding configuration to Azure (`text-embedding-3-small`) with new ARM template parameters for `azureEmbeddingDeployment`.
- Noted the storage requirement inline so future releases don’t regress into isolated temp dirs that break ingestion workflows.

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
- Enabled streaming on the web container by reusing the LangGraph stack while delegating Hugging Face embeddings to the worker via `langchain-community` wrappers, keeping the web image slim yet letting SSE queries reuse the same BGE-M3 path.
- Updated `modules/agent.py` to grab a proper SQLAlchemy session (`db.session`) during streaming and avoid write failures when persisting partial responses.
- Added chunk-by-chunk UI polish: streaming agent bubbles now pulse as text arrives, display a live progress bar with chunk counters, and fall back cleanly when a stream aborts.
- Hardened Chroma querying in streaming mode with a quick retry/reload path to absorb transient "Error finding id" failures while new uploads finish indexing.
- Hardened the front-end typewriter pipeline to accumulate partial text, merge metadata, and finalize messages only after the stream completes, preventing stale caret states.
- Added console diagnostics and cache-busting tweaks (`Config.APP_VERSION`) to ensure rebuilt assets invalidate the browser cache during rapid UI iteration.
- **Next**: Tune the progress bar styling for dark mode and explore a lightweight “look-ahead” chunk summary before final render.
- Offloaded Hugging Face embedding retrieval to the worker via a new `modules.vector_tasks.retrieve_context` task so the web container can stay slim; the tool automatically calls Celery when a local model (e.g., `BAAI/bge-m3`) is active.
- Pulled the updated `langchain-huggingface` shim into the worker image so BGE models load cleanly while the web image remains lean.
 
## 2025-10-28 – Admin UX Parity & Streaming Feedback Fixes
- Brought the knowledges admin page in line with other admin tables: new client script handles inline add/edit/delete, row renumbering, placeholder swaps, and modal resets without full reloads.
- Normalized knowledge responses by reusing shared serialization helpers so the frontend receives consistent name lists and timestamps.
- Synced streaming metadata with the real backend message ID and updated the bubble dataset, ensuring like/dislike feedback persists once the stream completes.
- Hardened the feedback buttons to defer submission while a message is streaming and use the synchronized ID, resolving the previous failure when streaming was enabled.
- Restored implicit knowledge assignment during uploads so `/admin/files` immediately shows the correct knowledge after a data reset.
- Normalized the streaming formatter to strip inline follow-up blocks while keeping the suggested questions in the footer metadata.
- Wired the streaming collector to reuse the formatted answer payload so numbered follow-ups stay out of the UI transcript while suggested pills remain intact.
- Enabled knowledge-mode upload tagging: the upload UI now exposes category, catalog, and group selectors only when the system runs in knowledge vector mode, and the backend applies those choices to the target knowledge before queuing both URL and batch ingests.

## 2025-10-29 – Model Guardrails & Streaming Test Harness
- Expanded `MODEL_CAPABILITY_REGISTRY` with streaming flags, safe temperature ranges, and lookup helpers so downstream services can enforce deployment-specific limits.
- Added deployment validation in `/admin/models` (temperature coercion, streaming compatibility, and live `get_llm` probe) to catch typos or unsupported settings before they reach production.
- Patched the admin routes to surface validation errors back to the UI and ensure multimodal config updates stay in sync with `AppSettings` and cached Flask config.
- Updated `tests/test_query_resume.py` to fix import paths and simulate a successful streaming resume payload, keeping coverage after the new validation hooks.
- Test suite now passes (`pytest`), confirming the admin guardrails and streaming harness integrate cleanly with existing flows.

## 2025-10-29 – Group-Gated Upload Access
- Filtered the upload dropdown to display only knowledges the current user can reach based on group memberships, hiding inaccessible libraries in knowledge mode.
- Enforced the same access rules in file and URL ingests, blocking submissions that target knowledges or libraries outside the user’s groups and defaulting non-knowledge modes to the first accessible knowledge.
- Captured the change in the upload progress log for continued tracking of the access-control rollout.
- Extended the same group filters to RAG queries so `/api/query` rejects inaccessible libraries/knowledges and defaults to an allowed knowledge when none is provided.
- Updated the chat client to show a clear access-denied message instead of a generic 403 error when RAG queries are blocked.

## 2025-10-29 – Global Vector Store Path Fix
- Prevented Chroma retrieval from forcing knowledge directories when the system runs in global mode; `modules/agent.py` now respects the configured scope even when queries include knowledge filters.
- Added defensive logging when user or knowledge identifiers are missing so global mode falls back cleanly instead of emitting missing-path warnings.

## 2025-10-29 – User Mode Private Uploads
- Relaxed query-time group checks when the vector store runs in user mode so personal searches no longer raise shared-library permission errors.
- Let uploads and URL ingests bypass group enforcement in user mode, keeping knowledge tags optional while still queuing the user’s own documents.

