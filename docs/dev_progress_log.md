# SmartLib Dev Progress Log

## 2025-12-04 – Upload Status Tracker with Navbar Badge
- Implemented real-time upload status tracking system with navbar badge indicator to provide visibility into background file ingestion processing by Celery workers.
- Added Redis-based task tracking: file uploads and URL downloads now register their Celery task IDs in user-specific Redis lists (`user:{user_id}:upload_tasks`) with 24-hour expiry for automatic cleanup.
- Created `/api/upload-status` endpoint that polls Celery AsyncResult for each task, returns status (PENDING/PROGRESS/SUCCESS/FAILURE), filename, and progress metadata, and automatically removes orphaned PENDING tasks (no worker processing) and old completed tasks (>1 hour).
- Built client-side polling system in `static/js/upload-status.js` with 5-second refresh intervals, dropdown menu showing active/completed tasks, progress bars for in-progress uploads, toast notifications on completion, and automatic badge updates.
- Added Celery task progress updates in `modules/upload_processing.py`: tasks now report their state with `self.update_state()` including filename, processing stage, and percentage progress at key milestones (Starting 0%, Processing 10%, Completed 100%).
- Integrated upload status badge into navbar (`templates/base.html`) with dropdown menu (max 320px width, 300px height, scrollable), positioned 8px from top to avoid browser chrome cutoff, shows active task count, and includes manual refresh button and per-task dismiss action.
- Fixed CSRF token reading in JavaScript: changed from form field selector `document.querySelector('[name="csrf_token"]')?.value` to meta tag `document.querySelector('meta[name="csrf-token"]')?.content` to match base template implementation.
- Fixed task registration using `os.environ.get('CELERY_BROKER_URL')` instead of `current_app.config.get()` to ensure Redis client connects properly, and corrected User model attribute from `current_user.id` to `current_user.user_id` throughout `modules/upload.py`.
- Implemented automatic cleanup logic: orphaned PENDING tasks (state='PENDING', info=None) are immediately removed from Redis, completed tasks (SUCCESS/FAILURE) older than 1 hour are auto-cleaned, and users can manually dismiss completed tasks via dismiss button.
- Added comprehensive debug logging with `[UploadStatus]` prefix showing task counts, state transitions, cleanup operations, and API response sizes for troubleshooting and monitoring.
- Current behavior: badge appears automatically within 5 seconds after upload (next polling cycle), updates every 5 seconds with real-time progress, shows animated progress bars during processing, displays toast notifications on completion/failure, and stops polling when no active tasks remain (after 10-second grace period).
- Files modified: `templates/base.html` (navbar badge, toast container, script loading), `static/js/upload-status.js` (NEW - polling and UI logic), `modules/upload.py` (API endpoints, task registration), `modules/upload_processing.py` (Celery progress updates).

## 2025-12-02 – Visual Grounding ENT Edition Fixes
- Fixed visual grounding icon not displaying in ENT edition (PGVector/PostgreSQL) despite backend successfully fetching `docling_json_path` and `page_height` from the database.
- Identified that `dl_meta` bounding box metadata is stored in the `documents` table as TEXT (JSON string) for both BASIC and ENT editions, not in PGVector's `langchain_pg_embedding.cmetadata` JSONB column.
- Reverted `get_document_for_citations()` in `modules/database.py` to query the `documents` table instead of PGVector, ensuring both editions use the same data source for visual grounding metadata.
- Added JSON parsing in `modules/evidence_utils.py` to handle `dl_meta` TEXT column: added `json.loads()` conversion when `dl_meta` is a string before extracting bounding box coordinates.
- Fixed path resolution in `/api/visual_evidence` endpoint (`modules/query.py`) to resolve relative paths like `data/doc_store/...` using `DATA_VOLUME_PATH`, matching the logic in `evidence_utils.py` for both Azure (`/home/data`) and local (`./data`) deployments.
- Confirmed visual grounding (icon display + bounding box image overlay) now works correctly in ENT edition without breaking BASIC edition compatibility.
- Verified `ExportType.DOC_CHUNKS` in DoclingLoader automatically includes `dl_meta` in chunk metadata by default, no explicit MetaExtractor configuration needed.

## 2025-11-19 – Streaming Pipeline Review
- Investigated why `/api/query` streaming calls never triggered Celery and confirmed the web container was invoking `invoke_agent_graph` directly while non-streaming paths queued `modules.agent.invoke_agent_graph` via Celery.
- Documented the wiring plan to push streaming chunks through Celery: introduce a Redis-backed stream bus, pass `stream_token` metadata from the web route, emit SSE payloads from the worker, and relay them in the web tier so both services share load.
- Captured the rebuild instructions so the upcoming patch (Celery streaming bridge) can be deployed cleanly before retesting on Azure.

## 2025-11-18 – Logo Cache Bust & SSH Review
- Traced the missing navbar/admin logos to the `main.py` WSGI entrypoint lacking the cache-busted `logo_url` context processor that already existed in `app.py`, which meant custom uploads never served on Azure.
- Mirrored the context processor so both entrypoints now compute `/static/img/custom_logo.png` with an mtime fallback to `/static/img/logo.png`, rebuilt the web container, and confirmed the manifest and logo assets render everywhere after clearing caches.
- Reviewed the App Service SSH helper: left the `openssh-server` install + `start_sshd` path in place for diagnostics while documenting that access still requires the Azure remote-connection tunnel, so end users cannot read `/app` source code.

## 2025-11-16 – Password Reset & Chat Polish
- Fixed the shared navbar stacking so brand links home, menus overlay cleanly, and light/dark themes keep mobile taps reliable.
- Implemented the password reset request workflow with user forms, admin approvals/denials, badges, logging, and the supporting Alembic migration.
- Expanded message history tooling with log export/purge helpers, VACUUM, retention cards, and a modal for reading full transcripts inside the admin shell.
- Pointed vector reference logging/views to the shared `LOG_DIR`, tightened redirects, and surfaced pending counts in the admin navigation.
- Unified rotating file logging and ensured `docker-entrypoint.sh` runs Alembic so services boot with consistent log paths before migrations.
- Polished the chat UI spacing: sticky query form, responsive follow-up cards/citations, mobile-friendly buttons, and self-retriever panels that stay inside the bubble.

## 2025-11-15 – Self-Retriever Trigger Guard
- Blocked initial self-retriever fetches on page load so suggested questions only appear after the user explicitly starts a new conversation, avoiding idle token usage.
- Introduced a page-level flag to gate follow-up refreshes (knowledge/library changes) and reset it after the first user message, keeping manual triggers functional without background calls.
- Added a Vite build pipeline with hashed bundles and Docker integration so production images ship minified assets while retaining a dev-server option for local debugging.
- Expanded the bundler to cover the admin shell, delivering shared dashboards scripts via hashed `/static/dist/admin.*` assets with runtime fallbacks for first-run deployments.
- Hardened `asset_bundle` so manifest lookups succeed even when invoked outside a request context, keeping Docker health checks and admin renders on hashed assets.

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

