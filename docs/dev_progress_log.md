# SmartLib Dev Progress Log

## 2025-11-15 – Self-Retriever Trigger Guard
- Blocked initial self-retriever fetches on page load so suggested questions only appear after the user explicitly starts a new conversation, avoiding idle token usage.
- Introduced a page-level flag to gate follow-up refreshes (knowledge/library changes) and reset it after the first user message, keeping manual triggers functional without background calls.

## 2025-11-14 – Document Viewer Blueprint Fix
- Traced `/view_document` 404s to the Gunicorn entrypoint using `main.py`, which never registered the document viewer blueprint even though `app.py` had the new code.
- Imported `init_view_document` into `main.py` and wired it into the factory alongside the other module initializers so both WSGI entrypoints expose the route.
- Rebuilt and relaunched the web/worker containers to confirm the updated blueprint serves citations, and verified the logs now show collection fallback attempts plus successful Chroma fetches.

## 2025-11-13 – Visual Grounding Citations & Activity Fixes
- Added Docling document path and raw bounding boxes into citation metadata so chat responses can render the visual-evidence icon when grounding data exists.
- Updated the chat client to attach one-click visual evidence triggers that call `/api/visual_evidence` with the raw Docling payload, falling back gracefully when only document metadata is available.
- Suppressed the visual-evidence icon whenever a citation lacks Docling artifacts so mixed-library answers don’t surface broken preview buttons, tightened the client request guardrails before hitting `/api/visual_evidence`, and let `/view_document` fall back to the vector store so historical ingests keep working.
- Recorded the originating group for visual-grounded ingests, normalized activity records, and rebuilt the admin activities table to show user, group, file, and status details reliably.

## 2025-11-13 – Streaming Structured Query Cleanup
- Suppressed transient structured-query chunks (```json { QUERY: … } ``` fences) in `modules/agent.py` so streaming answers no longer flash intermediate LangChain metadata before the final response arrives.
- Filtered `structured_query` out of streaming metadata updates to keep the client from briefly rendering raw retrieval diagnostics while the final answer streams in.

## 2025-11-05 – Admin Cleanup & Vector Hygiene
- Synced the chat homepage and upload experience so knowledge/library pickers always reflect the same filtered sets for each user or group, preventing cross-assignment during ingestion.
- Built an authenticated `/admin/files/delete/<id>` endpoint that removes documents, vector references, and Chroma chunks tied to an uploaded file, and wired the admin UI to call it with CSRF-aware fetch logic.
- Hardened `/admin/downloads` empty states to avoid DataTables column warnings and fixed download deletion by purging matching `LibraryReference` rows before removing the URL record.
- Documented the changes here ahead of the next rebuild/test cycle.

## 2025-11-04 – Admin Actions & ARM Secret URIs
- Fixed the `/admin/users` toggle buttons by pointing their links to the `admin_users` blueprint routes, eliminating the 500s when promoting or disabling accounts from the grid.
- Added optional `storageAccountKeySecretUri` parameters to every ARM template and wired the Azure Files mounts to favor Key Vault secrets while still allowing direct keys for local testing.
- Introduced `azureOpenAIKeySecretUri` parameters so both web and worker templates can resolve the OpenAI key from Key Vault, keeping sensitive credentials out of the parameter payloads.
- Authored `ARMtemplate/CreateUiDefinition.json` for Azure Managed Application onboarding, aligning user inputs with the updated App Service templates and optional Key Vault secret fields.
- Added `/about` blueprint plus navigation link, mirrored licensing documentation to `static/docs/licensing/`, and published the compliance bundle under `docs/licensing/` for marketplace auditing.

## 2025-11-02 – Key Vault OCR Alignment & Admin Fixes
- Restored `/admin` redirect and dashboard view, wiring an OCR context processor and `@login_required` guard so the menu reflects feature flags.
- Updated `app.py` to prioritize `AppSettings` for OCR flags with env fallbacks and logging, keeping Celery and portal toggles consistent after restarts.
- Ensured `modules/upload_processing.py` falls back to `app.config` when OCR settings are missing, so ingestion auto-enables azure mode once env vars are set.
- Synced OCR environment flags back into `AppSettings` when provided, so ARM deployments keep `IS_ENABLED_OCR` without manual toggles.
- Defaulted storage paths to `/home/data` (when writable) across config and admin folder uploads so Azure File shares stay mounted; this eliminated SQLite disk I/O errors on worker jobs when DATA_VOLUME_PATH isn’t explicitly set.
- **Next:** Recreate the Document Intelligence secret with hyphenated names, update App Service references, and confirm managed identity access to clear worker 401s.


## 2025-10-31 – Azure Files Shared Storage
- Updated all App Service ARM templates to add Azure Files parameters and mount `/home/data` so worker and web containers share uploads, maps, and vector assets.
- Refreshed `ARMtemplate/docs/QUICK_START_GUIDE.md` deployment commands to include `storageAccountName`, `dataShareName`, and `storageAccountKey`, and called out the new storage prerequisite in the checklist.
- Added a resilient SQLite preflight (retry loop + `SQLITE_JOURNAL_MODE` defaulting to `DELETE`) in `docker-entrypoint.sh`/`extensions.py` so the new SMB mount reliably creates and opens `/home/data/app.db` before running migrations or seed scripts, switched the default embedding configuration to Azure (`text-embedding-3-small`) with new ARM template parameters for `azureEmbeddingDeployment`, ensured the self-retriever panel renders above the animated placeholder in the chat UI, added a crypto.randomUUID polyfill in `static/js/query-form.js` so new conversations work in all browsers, filtered out LangGraph structured query chunks during streaming so users no longer see interim JSON blobs, and moved admin folder uploads to the shared data volume (`DATA_VOLUME_PATH`) so web + worker containers read the same files during ingestion.
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

