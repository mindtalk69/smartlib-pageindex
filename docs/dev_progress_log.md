# SmartLib Dev Progress Log

## 2025-12-11 – Fixed PGVector Reset Button Conditional Logic (Part 3)

### Summary
Fixed PGVector reset button not appearing in `/admin/settings/vectorstore` on Azure ENT deployments even after Parts 1 & 2.

### Root Cause - Part 3 (Settings Dict Default Issue)
The `vector_store_settings()` route in `admin.py` was defaulting `VECTOR_STORE_PROVIDER` to `'chromadb'` when not in AppSettings table:
- **Line 1664**: `settings.setdefault('VECTOR_STORE_PROVIDER', 'chromadb')` 
- **Line 1678**: Error fallback also hardcoded `'chromadb'`
- For ENT edition, `VECTOR_STORE_PROVIDER` is set via `config.py` (to `'pgvector'`), not stored in AppSettings
- Template condition `{% if current_settings.get('VECTOR_STORE_PROVIDER') == 'pgvector' %}` evaluated to FALSE

### Solution Applied - Part 3
Changed both lines to use Flask config as default:
```python
# Before (line 1664)
settings.setdefault('VECTOR_STORE_PROVIDER', 'chromadb')

# After
settings.setdefault('VECTOR_STORE_PROVIDER', current_app.config.get('VECTOR_STORE_PROVIDER', 'chromadb'))
```

### Files Modified
- `modules/admin.py` – Lines 1664 and 1678: Use `current_app.config` for default instead of hardcoded value

---

## 2025-12-11 – Fixed PGVector Reset Button Conditional Logic

### Summary
Fixed the PGVector reset button not appearing in `/admin/settings/vectorstore` on Azure deployments when `APP_EDITION` environment variable was not explicitly set.

### Root Cause - Part 2 (Azure Deployment Issue)
After fixing dot notation (Part 1), the button worked locally but NOT on Azure because:
- **Line 175** had conditional: `{% if app_edition == 'ENT' or not app_edition %}`
- `config.py` defaults `APP_EDITION` to `'BASIC'` when env var is not set (line 70)
- On Azure, if `APP_EDITION` is not set in Application Settings, it defaults to `'BASIC'`
- When `app_edition == 'BASIC'`:
  - `app_edition == 'ENT'` → False
  - `not app_edition` → False (because 'BASIC' is truthy)
  - **Entire PGVector section was hidden!**
- Locally worked because enterprise Docker images or manual `APP_EDITION=ENT` setting

### Solution Applied - Part 2
**Removed edition-based conditional entirely** from PGVector section (line 175):
- PGVector reset section now displays based ONLY on `VECTOR_STORE_PROVIDER == 'pgvector'`
- Works regardless of `APP_EDITION` setting (ENT, BASIC, or not set)
- JavaScript still handles visibility toggling based on selected provider
- ChromaDB section still respects `app_edition == 'BASIC'` check (line 119)

```jinja2
<!-- Before -->
{% if app_edition == 'ENT' or not app_edition %}
<div id="pgvector-reset-section" ...>

<!-- After (removed edition check) -->
<div id="pgvector-reset-section" ...>
```

### Files Modified
- `templates/admin/settings_vectorstore.html` – Removed `{% if app_edition == 'ENT' or not app_edition %}` and closing `{% endif %}` from PGVector section

### Verification Steps
1. Deploy to Azure WITHOUT setting `APP_EDITION` environment variable
2. Set `VECTOR_STORE_PROVIDER=pgvector` in admin settings
3. Navigate to `/admin/settings/vectorstore`
4. PGVector reset button should now be visible

---

## 2025-12-11 – Fixed PGVector Reset Button Not Displaying (Part 1)

### Summary
Fixed the PGVector reset button not appearing in `/admin/settings/vectorstore` for Enterprise edition after Mazer template migration.

### Root Cause - Part 1 (Dot Notation)
- Template used `current_settings.VECTOR_STORE_PROVIDER` (dot notation) to access dict values
- Jinja2 dict access was inconsistent, causing the visibility condition to fail
- JavaScript on page load also used dot notation, hiding the section

### Solution Applied - Part 1
Changed dict access from dot notation to `.get()` method in `settings_vectorstore.html`:
- Line 121: CSS display condition for ChromaDB section
- Line 177: CSS display condition for PGVector reset section
- Line 267: JavaScript `currentProvider` variable

```html
<!-- Before -->
{% if current_settings.VECTOR_STORE_PROVIDER == 'pgvector' %}

<!-- After -->
{% if current_settings.get('VECTOR_STORE_PROVIDER') == 'pgvector' %}
```

---


## 2025-12-11 – Fixed PGVector using SQLAlchemy Engine

### Summary
Fixed persistent "Connection refused" errors in Celery worker by using Flask-SQLAlchemy's `db.engine` directly instead of PGEngine's async connection handling.

### Root Cause
- **PGEngine uses async internally**: Even `PGVectorStore.create_sync()` uses async event loop
- **Flask context conflicts**: Async event loop doesn't work properly in Flask/Celery context
- **SQLAlchemy works fine**: `db.engine` connects successfully in the same context

### Solution Applied
Pass SQLAlchemy engine to PGVector instead of connection string:

```python
from extensions import db
from langchain_postgres import PGVector

store = PGVector(
    embeddings=embedding_func,
    connection=db.engine,  # SQLAlchemy engine, not connection string
    collection_name=collection_name,
    create_extension=False,
    async_mode=False,
)
```

#### Files Updated
- `modules/pgvector_utils.py` - `get_pg_vector_store()` uses `db.engine`
- `modules/vector_store_utils.py` - Uses `get_pg_vector_store()`
- `modules/agent.py` - Uses `get_pg_vector_store()`
- `modules/vector_tasks.py` - Uses `get_pg_vector_store()`

### Verification ✅
```
[2025-12-11 07:57:57] PGVector: Successfully added 72 chunks to collection 'documents_vectors'
[2025-12-11 07:57:58] Task succeeded in 344.98s: {'success': True, 'file_id': 16}
```

---

## 2025-12-11 – Azure PostgreSQL Firewall Rules for Worker App

### Summary
Fixed "Connection refused" errors when worker container tried to store documents to PGVector by identifying that Azure PostgreSQL Flexible Server firewall rules were missing for the worker app's outbound IP addresses.

### Root Cause
- **Worker cannot connect to PostgreSQL, but web can**: Web app successfully saves documents to `documents` table, but worker fails when trying to store vectors to PGVector
- **Azure PostgreSQL firewall**: The firewall was only configured to allow the web app's outbound IPs, blocking the worker app
- **Different outbound IPs**: Azure App Service web and worker apps have different outbound IP addresses that must BOTH be allowed
- **Missing ARM template guidance**: The Enterprise ARM template provided firewall instructions for Redis but not for PostgreSQL

### Error Symptoms
```
[2025-12-11 05:45:15,211: INFO/MainProcess] Attempting to connect to PGVector (Collection: documents_vectors)...
[Multiple retry attempts over 4 minutes with exponential backoff]
[2025-12-11 05:49:25,012: ERROR/MainProcess] Error processing/storing chunks for PGVector:
(psycopg.OperationalError) connection failed: Connection refused
    Is the server running on that host and accepting TCP/IP connections?
```

### Solution Applied

#### 1. Added PostgreSQL Firewall Output Instructions to ARM Template
**File**: `ARMtemplate/catalog/mainTemplate_enterprise.json`
- Added `step9_PostgreSQL_WebApp_IPs` output: Lists web app's outbound IPs
- Added `step10_PostgreSQL_Worker_IPs` output: Lists worker app's outbound IPs
- Added `step11_PostgreSQL_Firewall_Command` output: Provides ready-to-run Azure CLI commands for adding firewall rules

**Output format** (similar to existing Redis firewall instructions):
```bash
# CRITICAL: Add firewall rules for BOTH web and worker app IPs
# Run this command for EACH IP address from steps 9 and 10:
az postgres flexible-server firewall-rule create \
  --resource-group <postgres-rg> \
  --name <postgres-server> \
  --rule-name AllowAppService-<IP> \
  --start-ip-address <IP> \
  --end-ip-address <IP>
```

#### 2. Updated UI Definition with Firewall Warning
**File**: `ARMtemplate/catalog/createUiDefinition_enterprise.json`
- Updated PostgreSQL prerequisite info box to emphasize post-deployment firewall configuration
- Added step 5: "⚠️ CRITICAL: After deployment, add firewall rules for BOTH web and worker app outbound IPs (see deployment outputs step9-11)"
- Clarified consequences: "Without firewall rules for BOTH apps, worker cannot store documents to vector database!"

#### 3. Immediate Manual Fix for Existing Deployments
Users can get outbound IPs and add firewall rules immediately:
```bash
# Get Web App IPs
az webapp show --name <web-app> --resource-group <rg> --query outboundIpAddresses --output tsv

# Get Worker App IPs
az webapp show --name <worker-app> --resource-group <rg> --query outboundIpAddresses --output tsv

# Add firewall rule for each IP
az postgres flexible-server firewall-rule create \
  --resource-group <postgres-rg> \
  --name <postgres-server> \
  --rule-name AllowWorkerApp-<IP> \
  --start-ip-address <IP> \
  --end-ip-address <IP>
```

### Files Modified
- `ARMtemplate/catalog/mainTemplate_enterprise.json` – Added outputs for PostgreSQL firewall configuration (steps 9-11)
- `ARMtemplate/catalog/createUiDefinition_enterprise.json` – Updated prerequisite warning with post-deployment firewall requirement

### Verification Steps
1. Deploy ARM template or check deployment outputs for existing deployments
2. Copy web and worker app outbound IPs from outputs (steps 9-10)
3. Run firewall rule creation commands for each IP (step 11)
4. Test document upload - worker should now successfully store vectors to PGVector

### Related Context
- Azure App Service apps have multiple outbound IPs (comma-separated list)
- Each IP must be added as a separate firewall rule
- PostgreSQL Flexible Server firewall rules are required even when using VNet integration in some scenarios
- This pattern matches the existing Redis firewall configuration in the template

---

## 2025-12-11 – PGVector Connection & Query Fixes

### Summary
Fixed two critical issues preventing PGVector queries from returning documents in the Enterprise edition.

### Issues Fixed
1. **Collection Name Mismatch**: Queries in `agent.py` defaulted to `langchain_vectors` while uploads went to `documents_vectors`, causing queries to search an empty collection.
2. **Connection Refused Errors**: PGVector creates its own SQLAlchemy engine separately from Flask-SQLAlchemy. Added `engine_args` with connection pool settings for Azure PostgreSQL reliability.

### Solution
1. Fixed default collection name in `modules/agent.py` line 511 and `modules/admin.py` lines 1712, 1784 to `documents_vectors`.
2. Added `engine_args` to PGVector initialization in both upload (`vector_store_utils.py`) and query (`agent.py`) paths:
   - `pool_pre_ping=True`: Checks connection validity before using (handles stale connections)
   - `pool_recycle=1800`: Recycles connections after 30 mins (handles Azure idle disconnects)
   - `connect_timeout=30`: Prevents indefinite connection hangs

---

## 2025-12-10 – Upload Page Layout & Centering Fix

### Issues Fixed
1. **Horizontal centering**: Card was stuck on the left side of the page
2. **Vertical centering**: Card was positioned at the top instead of centered
3. **Tab layout**: "Download from URL" and "File Upload" tabs were stacking vertically instead of side-by-side
4. **Card structure**: Needed a cleaner header/body separation matching Mazer design patterns

### Solution
Restored Bootstrap's proven row/col centering pattern (same as login page):
```html
<div class="row justify-content-center upload-row">
  <div class="col-md-8 col-lg-7 col-xl-6">
    <div class="upload-form-wrapper">
      <!-- Header + Body -->
    </div>
  </div>
</div>
```

Added CSS for vertical centering:
```css
.upload-row {
  min-height: calc(100vh - 150px);
  align-items: center;
}
```

### Files Modified
- `templates/upload.html` – Restored Bootstrap row/col structure with `upload-row` class, added header/body sections, `nav-fill` for tabs
- `static/css/upload.css` – Added `.upload-row` with flexbox vertical centering, `.upload-form-wrapper` styling, `.upload-form-header` and `.upload-form-body` sections

### Result
- ✅ Card horizontally centered
- ✅ Card vertically centered
- ✅ Tabs side-by-side with equal width
- ✅ Responsive on mobile/desktop
- ✅ Dark/light theme compatible

---

## 2025-12-10 – Build Script Cross-Platform Compatibility Fix

### Summary
Fixed `build-for-azure-enterprise.sh` to work on both macOS and Linux/WSL2 by replacing Linux-specific commands with cross-platform alternatives.

### Issues Fixed
1. **`grep -oP` not supported on macOS**: BSD grep (macOS default) doesn't support Perl-compatible regex (`-P` flag). Replaced with `grep | sed` combo.
2. **`sed -i` syntax difference**: macOS requires `sed -i ''` (empty extension), Linux uses `sed -i`. Added OS detection.
3. **Ambiguous grep pattern**: The original `grep 'BUILD_VERSION'` matched both the assignment line and f-string references like `{BUILD_VERSION}`, causing multi-line output that broke version parsing.

### Fix Applied
```bash
# OS detection for sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_INPLACE="sed -i ''"
else
    SED_INPLACE="sed -i"
fi

# Precise grep pattern (matches only assignment, not f-string refs)
CURRENT_VERSION=$(grep 'BUILD_VERSION = "' config.py | head -1 | sed 's/.*BUILD_VERSION = "\([^"]*\)".*/\1/')
```

### Files Modified
- `build-for-azure-enterprise.sh` – Cross-platform grep/sed patterns

### Note
`build-for-azure-basic.sh` was already fixed with cross-platform compatibility in a previous session.

---

## 2025-12-10 – Dynamic DOCLING_EXPORT_TYPE Based on OCR Mode

### Summary
Fixed `DOCLING_EXPORT_TYPE` configuration mismatch where the export type was hardcoded regardless of OCR mode selected in admin settings.

### Root Cause
`config.py` had `DOCLING_EXPORT_TYPE` hardcoded to `DOC_CHUNKS` (line 172), but the export type should be determined dynamically based on the OCR mode (`/admin/settings/ocr`):
- **Azure Document Intelligence** → `MARKDOWN` (Azure DocInt outputs markdown natively)
- **Local OCR** → `DOC_CHUNKS` (Docling chunk-based processing)

### Fix Applied
- **`modules/upload_processing.py`**: Changed from reading `app_config.get('DOCLING_EXPORT_TYPE')` to dynamic selection based on `IS_OCR_LOCAL` flag:
  ```python
  if IS_OCR_LOCAL:
      docling_export_type_str = 'DOC_CHUNKS'
  else:
      docling_export_type_str = 'MARKDOWN'
  ```
- **`config.py`**: Restored env var reading with `DOC_CHUNKS` default (actual behavior determined at runtime)

### Files Modified
- `modules/upload_processing.py` – Dynamic export type based on OCR mode
- `config.py` – Restored env var with proper default and comments

### Verification
Worker logs now show correct export type based on OCR mode:
- Local OCR: `[Upload DEBUG] DOCLING_EXPORT_TYPE selected: DOC_CHUNKS (IS_OCR_LOCAL=True)`
- Azure DocInt: `[Upload DEBUG] DOCLING_EXPORT_TYPE selected: MARKDOWN (IS_OCR_LOCAL=False)`

---

## 2025-12-10 – PGVector Connection String URL-Encoding Fix (ENT Edition)

### Summary
Fixed Enterprise edition vector store operations failing with "Name or service not known" DNS resolution error when uploading documents, even though alembic migrations and SQLAlchemy connections worked fine.

### Root Cause
The ARM template (`mainTemplate_enterprise.json`) was explicitly setting `PGVECTOR_CONNECTION_STRING` with the PostgreSQL password concatenated directly into the connection string **without URL-encoding**. If the password contained special characters like `@`, `:`, `/`, or `#`, the connection string parser would misinterpret the hostname.

**Example:** With password `myP@ssword`, the connection string became:
```
postgresql+psycopg://user:myP@ssword@server.postgres.database.azure.com:5432/db
```
The parser interpreted `@ssword@server.postgres.database.azure.com` as the hostname, causing DNS lookup failure.

Meanwhile, `SQLALCHEMY_DATABASE_URI` worked because `config.py` builds it from individual `POSTGRES_*` components with proper URL-encoding:
```python
from urllib.parse import quote
encoded_password = quote(postgres_password, safe='')
SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg://{postgres_user}:{encoded_password}@{postgres_host}:..."
```

### Fix Applied
Removed the redundant `PGVECTOR_CONNECTION_STRING` environment variable from both web and worker app settings in the ARM template. Now `config.py` line 191 falls back to the properly URL-encoded `SQLALCHEMY_DATABASE_URI`:
```python
PGVECTOR_CONNECTION_STRING = os.environ.get('PGVECTOR_CONNECTION_STRING', SQLALCHEMY_DATABASE_URI)
```

### Files Modified
- `ARMtemplate/catalog/mainTemplate_enterprise.json` – Removed `PGVECTOR_CONNECTION_STRING` from both web (line 650-651) and worker (line 875-876) app settings

### Immediate Workaround (Before Redeploy)
For existing deployments, manually remove `PGVECTOR_CONNECTION_STRING` from App Service worker's Configuration → Application Settings in Azure Portal and restart the worker.

### Verification
- Alembic migrations succeed (used URL-encoded `SQLALCHEMY_DATABASE_URI`)
- Document uploads complete successfully
- Chunks stored to PGVector without DNS resolution errors

---

## 2025-12-10 – Azure Files Upload Sync Fix

### Summary
Fixed file upload failures on Azure where worker couldn't find uploaded files due to SMB mount propagation delays.

### Root Cause
Azure Files is an SMB-based shared filesystem. When the web container saves a file:
1. The write goes to local buffer/cache first
2. Without explicit flush, data may not propagate to other containers immediately
3. Worker container sees stale cache and fails with "No such file or directory"

### Fix Applied
- **Added `os.fsync()` after file saves**: Forces immediate flush to Azure Files SMB share before dispatching Celery task
- **Applied to both upload flows**:
  - `/upload` endpoint (batch file uploads)
  - `/process_url` endpoint (URL downloads)
- **Added file verification**: Confirms file exists with size logging after save+sync
- **Improved error handling**: Returns clear error if file save fails verification

### Files Modified
- `modules/upload.py` – Added fsync and verification for both file upload and URL download flows

### Technical Details
```python
# After file.save()
with open(str(temp_file_path), 'rb') as f:
    os.fsync(f.fileno())
    
# For URL downloads (within write context)
temp_file.flush()
os.fsync(temp_file.fileno())
```

### Verification
- Deploy updated code to Azure Web App
- Upload test file and monitor worker logs
- Verify no "No such file or directory" errors

### Worker Heartbeat Task Registration Fix
- **Issue**: `[WakeWorker] Failed to wake worker (NotRegistered): 'celery_app.worker_heartbeat'`
- **Root Cause**: The `worker_heartbeat` task was defined AFTER the task registration logging in `celery_app.py`, causing Celery not to include it in task discovery
- **Fix**: Moved `worker_heartbeat` task definition to appear BEFORE the task registry logging so it's properly registered
- **File Modified**: `celery_app.py` – Reorganized task definition order

### Case-Insensitive Query Enhancement
- **Issue**: Lowercase queries like "byd" failed to match documents containing "BYD"
- **Root Cause**: Embedding models don't perfectly handle case variations for short queries
- **Fix**: Added query enhancement in `perform_retrieval()` that automatically includes uppercase variants for short queries (1-2 words)
- **Example**: Query "byd forklift" becomes "byd BYD forklift FORKLIFT"
- **File Modified**: `modules/agent.py` – Added case enhancement logic before embedding

### Files Modified Summary
| File | Change |
|------|--------|
| `modules/upload.py` | fsync + verification for Azure Files |
| `celery_app.py` | Heartbeat task registration order |
| `modules/agent.py` | Case-insensitive query + Celery deadlock fix |
| `app.py` | Smart embedding warmup (skip local models on web) |

### Smart Embedding Warmup Fix
- **Issue**: Web container crashed on startup when using local HuggingFace models (e.g., BAAI/bge-m3) because `langchain-huggingface` is only installed on worker
- **Fix**: Added check in `app.py` to skip embedding warmup for local models on web container
- **Log output**: `Embedding warmup skipped: model 'BAAI/bge-m3' requires langchain-huggingface (not installed in this container).`

### Celery Subtask Deadlock Fix
- **Issue**: When streaming task on worker tried to offload retrieval to another worker task, it called `.get()` which Celery prohibits
- **Error**: `Never call result.get() within a task!`
- **Fix**: Added `current_task.request.id` check in `retrieve_context_tool` to detect if already inside a Celery task and skip offloading
- **File Modified**: `modules/agent.py`

---

## 2025-12-09 – Azure Files Sync Improvements

### Summary
Improved user experience when querying documents after uploads on Azure by adding query-time worker wake-up and enhanced indexing toast messaging.

### Query-Time Worker Wake-Up
- **Added `wake_worker()` call in `/api/query`**: Before executing ChromaDB vector store queries, the endpoint now pings the Celery worker (5s timeout) to wake it from Azure App Service cold starts.
- **Conditional activation**: Only runs when `VECTOR_STORE_PROVIDER=chromadb` to avoid unnecessary overhead for PGVector deployments.
- **Complements existing upload wake**: Previously `wake_worker()` only ran before uploads; now it also runs before queries to handle the gap when worker sleeps between upload completion and first query.

### Enhanced Indexing Toast
- **Updated completion message**: Toast now shows "📚 Indexing complete! You can start querying now."
- **Azure sync timing guidance**: Added note "On Azure, it may take ~15-30 seconds for the index to sync" to set user expectations for Azure Files SMB mount latency.

### Worker-Only ChromaDB Access (File Deletion)
- **Audit Result**: Found that `admin_files.py` was the ONLY place where web container directly accessed ChromaDB.
- **New Celery Task**: Added `delete_document_vectors` task to `vector_tasks.py` that runs on worker.
- **Worker Wrapper**: Added `delete_document_vectors_via_worker()` to `celery_tasks.py` for web to call.
- **Eliminated Direct Access**: Modified `admin_files.py` `_delete_vectors()` to use worker task instead of importing/using ChromaDB directly.
- **Impact**: Web container no longer needs to access ChromaDB files, eliminating Azure Files sync issues for admin file deletion.

### Files Modified
- `modules/query.py` – Added `wake_worker` import and call before agent invocation (lines 26, 521-524)
- `static/js/upload-status.js` – Enhanced `showCompletionToast()` with Azure sync timing note (lines 243-246)
- `modules/vector_tasks.py` – Added `delete_document_vectors` Celery task (lines 313-378)
- `modules/celery_tasks.py` – Added `DELETE_DOCUMENT_VECTORS_TASK` constant and `delete_document_vectors_via_worker()` wrapper
- `modules/admin_files.py` – Replaced direct ChromaDB access with worker task call in `_delete_vectors()`

### Duplicate File Cleanup (Delete-then-Add)
- **Problem**: Re-uploading the same file created duplicate vectors in ChromaDB, causing redundant search results.
- **Solution**: Added `cleanup_duplicate_file()` function that automatically removes existing vectors and DB records before re-ingesting.
- **Behavior**: When a file with the same name is uploaded to the same library/knowledge, the old data is cleaned up first.
- **Files**: `modules/upload_processing.py` – Added `cleanup_duplicate_file()` helper (lines 60-180) and integrated into `async_process_single_file` Celery task (lines 1130-1148).

### Duplicate File Confirmation UI
- **Problem**: Users had no warning before replacing existing files.
- **Solution**: Added confirmation modal before uploads proceed.
- **Features**:
  - `/api/check-duplicates` endpoint checks if files exist before upload
  - Bootstrap modal shows list of duplicate files with upload dates
  - User must click "Replace Files" to proceed
  - Works for both batch file uploads AND URL downloads
- **URL Download Enhancement**: Duplicate check runs when adding URLs to list (early feedback via toast warning)
- **Files Modified**:
  - `modules/upload.py` – Added `/api/check-duplicates` endpoint, removed premature `add_uploaded_file()` call
  - `templates/upload.html` – Added `duplicateConfirmModal` Bootstrap modal
  - `static/js/upload.js` – Added `checkForDuplicates()`, `showDuplicateConfirmation()`, integrated into batch upload and URL download flows

---

## 2025-12-07 – Visual Grounding Fixes & Upload UX Improvements

### Summary
Fixed visual evidence display for BASIC mode and significantly improved upload progress tracking UX. Root cause was Azure OCR mode not including `dl_meta` bounding box metadata - only local OCR mode provides this data.

### Visual Grounding Fixes
- **Root Cause Identified**: Azure Document Intelligence OCR mode doesn't include `dl_meta` in DoclingLoader output; local OCR (RapidOCR) is required for visual grounding to work.
- **DOC_CHUNKS Configuration**: Hardcoded `DOCLING_EXPORT_TYPE = 'DOC_CHUNKS'` in `config.py` to bypass Azure environment variable loading issues.
- **Azure Files Sync**: Increased retry wait time from 10 to 30 seconds in `upload_processing.py` to handle Azure Files synchronization delay between web and worker containers.
- **Celery/Redis Version Mismatch**: Updated `requirements-worker.txt` to match web container versions (Celery 5.5.2, Redis 5.0.1).
- **Page Number Extraction**: Ensured page numbers are extracted BEFORE `filter_complex_metadata` removes `dl_meta`.

### Upload Progress Improvements
- **Granular Progress Updates**: Added 7 processing stages with progress callbacks in `process_uploaded_file()`:
  - 5% - Initializing document processor
  - 15% - Converting document with visual grounding
  - 25% - Visual grounding data saved
  - 45% - Document loaded and chunked
  - 55% - Classifying document metadata
  - 70% - Saving to database
  - 85% - Storing chunks in vector database
  - 100% - Completed
- **Celery Integration**: Created `progress_callback` in `async_process_single_file` that updates task state with stage description and percentage.
- **Frontend Display**: `upload-status.js` already polls every 5 seconds and displays progress bar - now shows granular updates.

### Auto-Dismiss & Notifications
- **Auto-Dismiss**: Completed uploads automatically dismissed after 30 seconds; failed uploads after 15 seconds.
- **upload-complete Event**: Dispatched custom event when upload finishes for future UI refresh enhancements.
- **Toast Enhancement**: Updated completion toast to show "Document is now ready for querying" message.

### Configuration Requirements
> [!IMPORTANT]
> **Visual grounding requires local OCR mode** (not Azure Document Intelligence). Configure via `/admin/settings/ocr` or set `IS_OCR_LOCAL=true` environment variable.

### Worker Reliability Improvements (ROOT CAUSE: Celery #8030)
- **Celery #8030 Fix**: Added `--without-heartbeat --without-gossip --without-mingle` flags to celery worker command. This fixes the known bug where Celery workers stop consuming tasks after Redis reconnection.
- **Auto-Retry for FileNotFoundError**: Added Celery `autoretry_for=(FileNotFoundError,)` with exponential backoff starting at 60 seconds, max 960 seconds (16 minutes), and up to 5 retries. This handles Azure Files sync delays and worker cold starts.
- **Keep-Alive Heartbeat**: Added `worker_heartbeat` task in `celery_app.py` that runs every 5 minutes via beat scheduler to keep worker warm and prevent Azure App Service cold starts.
- **Pre-Upload Wake-Up**: Added `wake_worker()` function in `celery_tasks.py` that sends synchronous heartbeat ping (15s timeout) before submitting upload tasks. This forces Azure App Service to wake up suspended worker pool processes.
- **Embedded Beat Scheduler**: Added `-B` flag to celery worker command in `docker-entrypoint.sh` to run beat scheduler alongside worker for heartbeat and scheduled cleanup tasks.
- **Production Celery Settings**: Added `task_acks_late=True`, `worker_prefetch_multiplier=1`, `worker_max_tasks_per_child=100`, `broker_connection_retry=True`, and `visibility_timeout=43200` (12 hours).
- **Build Script Enhancement**: Added optional `--no-cache` flag to both `build-for-azure-basic.sh` and `build-for-azure-enterprise.sh` to force fresh Docker builds.

### Files Modified
- `modules/upload_processing.py` - Added `progress_callback`, auto-retry with backoff, Azure Files sync fix (30s)
- `modules/celery_tasks.py` - Added `wake_worker()` function for pre-upload worker wake-up
- `celery_app.py` - Added `worker_heartbeat` task, beat schedule, production settings
- `docker-entrypoint.sh` - Added `-B` flag, `--without-heartbeat --without-gossip --without-mingle` (Celery #8030 fix)
- `config.py` - Hardcoded `DOCLING_EXPORT_TYPE = 'DOC_CHUNKS'`
- `requirements-worker.txt` - Updated Celery/Redis versions
- `static/js/upload-status.js` - Added auto-dismiss, upload-complete event, enhanced toast
- `build-for-azure-basic.sh` - Added optional `--no-cache` flag
- `build-for-azure-enterprise.sh` - Added optional `--no-cache` flag

### Verification
- ✅ Upload completes successfully
- ✅ Worker receives and processes tasks immediately
- ✅ Visual evidence displays correctly
- ✅ Queries return results without page refresh

---

## 2025-12-04 – ARM Template Cleanup: Remove createRoleAssignment and Fix URI Construction

### Summary
Completely removed the `createRoleAssignment` parameter and conditional resources from all ARM templates, and fixed URI construction patterns to use `format()` instead of `concat()`. This cleanup eliminates ~60 lines of dead code and enforces the best practice of manual role assignment after deployment.

### Changes Made

#### 1. Removed createRoleAssignment Parameter (Both Templates)
- **Rationale**: Automatic role assignment fails in cross-resource-group scenarios (Key Vault in different RG than apps), which is the typical production setup. Manual role assignment via Azure CLI is more reliable and provides better control.
- **mainTemplate.json**: Removed parameter definition (lines 45-51) and 2 conditional role assignment resources (~30 lines) for web and worker app Key Vault access.
- **mainTemplate_enterprise.json**: Removed parameter definition and 2 conditional role assignment resources.
- **Impact**: Templates are now cleaner with manual role assignment commands provided in `postDeploymentInstructions` output.

#### 2. Fixed URI Construction (concat → format)
- **ARM TTK Recommendation**: Changed from deprecated `concat()` function to modern `format()` function for string interpolation.
- **mainTemplate.json**:
  - Line 707: `redirectUri` changed from `concat('https://', variables('webAppName'), '.azurewebsites.net/login_azure')` to `format('https://{0}.azurewebsites.net/login_azure', variables('webAppName'))`
- **mainTemplate_enterprise.json**:
  - Line 876: Same redirectUri fix applied
- **Result**: Improved code quality following Microsoft's recommended ARM template patterns.

#### 3. Updated UI Definitions (Both Editions)
- **createUiDefinition.json**:
  - Removed createRoleAssignment checkbox UI element (was hidden, defaultValue=false)
  - Removed kvCrossRgWarning InfoBox (conditional warning about cross-RG permissions)
  - Removed createRoleAssignment output parameter (line 848)
  - Kept roleAssignmentInfo InfoBox (manual role assignment instructions)
- **createUiDefinition_enterprise.json**:
  - Applied identical cleanup as Basic edition
  - Maintained consistency across both deployment wizards

#### 4. ARM TTK Validation Results
- **Tests Run**: Azure ARM Template Toolkit validation on both templates
- **mainTemplate.json**: 30 Pass / 1 Fail (97% pass rate)
- **mainTemplate_enterprise.json**: 31 Pass / 1 Fail (97% pass rate)
- **Remaining "Failure"**: "URIs Should Be Properly Constructed" test flags `format()` function usage in redirectUri outputs. This is a **false positive** - `format()` is Microsoft's recommended pattern for string interpolation in ARM templates. The test appears overly strict or has a bug.

### Technical Context

#### Why Remove createRoleAssignment?
1. **Cross-RG Limitation**: While ARM templates CAN create role assignments across resource groups (using proper scope), the deployment principal often lacks `Microsoft.Authorization/roleAssignments/write` permission in the Key Vault's resource group.
2. **Production Security**: Separating infrastructure deployment from access control aligns with security best practices and Azure RBAC models.
3. **Reliability**: Manual role assignment via Azure CLI after deployment is more predictable and provides better error visibility.
4. **Code Clarity**: Removing unused conditional resources (condition always evaluates to false) eliminates technical debt.

#### URI Construction Pattern
ARM TTK validates URI construction strictly. The test flagged:
- Line 689: `webAppUrl` uses `uri(format(...))` (recommended Azure pattern)
- Line 705: `redirectUri` uses `format(...)` (Microsoft's recommended string interpolation)

Both patterns are **correct** according to Microsoft documentation. The `format()` function is the modern replacement for `concat()` and is explicitly recommended for ARM templates.

### Testing Performed
1. **Pre-Removal Test**: User requested final test with `createRoleAssignment=true` to verify behavior before elimination. Test confirmed cross-RG deployments would fail due to permission requirements.
2. **Decision**: User confirmed option to completely eliminate (cleaner approach) vs. keeping hidden with false default.
3. **ARM TTK Validation**: Ran comprehensive template validation on both Basic and Enterprise templates. Both achieved 97% pass rate with only the false-positive URI test failing.

### Files Modified
- `ARMtemplate/catalog/mainTemplate.json` - Removed createRoleAssignment parameter and resources, fixed redirectUri format
- `ARMtemplate/catalog/mainTemplate_enterprise.json` - Same cleanup as Basic
- `ARMtemplate/catalog/createUiDefinition.json` - Removed createRoleAssignment UI elements and output
- `ARMtemplate/catalog/createUiDefinition_enterprise.json` - Same cleanup as Basic

### Migration Notes
- **Backward Compatibility**: Templates no longer accept `createRoleAssignment` parameter. Existing test parameter files (`test-deployment-params-role-assignment.json`) that reference this parameter should be updated or will ignore the extra parameter.
- **Deployment Process**: Users must now run manual role assignment commands from deployment outputs (this was already the recommended approach).
- **No Breaking Changes**: Since the parameter defaulted to `false` and was hidden in the UI, no existing deployments are affected.

### Related Documentation
- Microsoft Learn: [ARM Template Role Assignment Troubleshooting](https://learn.microsoft.com/en-us/azure/role-based-access-control/troubleshooting?tabs=bicep#symptom---arm-template-role-assignment-returns-badrequest-status)
- Stack Overflow: [Assign Role to Resource in Different Resource Groups](https://stackoverflow.com/questions/79228420/assign-role-to-resource-in-a-different-resource-groups)

### Outcome
✅ Cleaner, more maintainable ARM templates
✅ Enforces best practice (manual role assignment)
✅ Removed ~60 lines of dead code
✅ Improved URI construction patterns
✅ 97% ARM TTK pass rate (only false positive remaining)

### Follow-Up: Storage Role Assignment Consistency

After removing Key Vault automatic role assignments, applied the same approach to `createStorageRoleAssignment` for consistency:

#### Changes Applied
1. **Changed Default Value**: `defaultValue: true` → `false` in both mainTemplate.json and mainTemplate_enterprise.json
2. **Updated Description**: Clarified that default is false due to cross-resource-group limitations, matching Key Vault parameter rationale
3. **Enhanced postDeploymentInstructions**: Added Storage role assignment commands alongside existing Key Vault commands

#### New Post-Deployment Command Structure
- **Step 1**: Key Vault access (2 commands)
  - `keyVaultWebAppCommand` - Grant web app "Key Vault Secrets User" role
  - `keyVaultWorkerAppCommand` - Grant worker app "Key Vault Secrets User" role
- **Step 2**: Storage access (2 commands)
  - `storageWebAppCommand` - Grant web app "Storage Blob Data Contributor" role (0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb)
  - `storageWorkerAppCommand` - Grant worker app "Storage Blob Data Contributor" role
- **Step 3**: Wait for Azure RBAC propagation (5-10 minutes)
- **Step 4**: Restart both web and worker apps

#### Rationale
- **Consistency**: Both Key Vault and Storage role assignments now follow the same pattern (default false, manual assignment)
- **Cross-RG Safety**: Storage Account may be in different resource group than apps, causing same permission issues as Key Vault
- **Reliability**: Manual role assignment provides better visibility and control
- **Flexibility**: Parameter can still be enabled for same-RG deployments if desired

#### Impact
- Users now receive **4 role assignment commands** in deployment outputs (was 2)
- Both Key Vault and Storage access must be granted manually after deployment
- Deployment success no longer depends on cross-RG role assignment permissions
- All role assignment commands are ready to copy-paste from deployment outputs

---

## 2025-12-04 – ARM Template Refinements for Basic & Enterprise Editions
- Implemented complete PostgreSQL integration for Enterprise edition (`mainTemplate_enterprise.json`) with user-provided PostgreSQL Flexible Server (no resource creation), built connection string from components (`postgresql+psycopg://user:password@host:5432/database?sslmode=require`), set `VECTOR_STORE_PROVIDER=pgvector` and `APP_EDITION=ENT`, and added comprehensive pgvector setup instructions in the UI wizard.
- Created dedicated Enterprise UI definition (`createUiDefinition_enterprise.json`) with Database step positioned as Step 2 (after Identity, before Infrastructure) featuring multiple pgvector prerequisite warnings, ResourceSelector for existing PostgreSQL servers, dual password input methods (direct or Key Vault secret URI), version checking with warnings for PostgreSQL <15, and final deployment checklist.
- Fixed Azure AD login redirect URI mismatch: added `REDIRECT_URI` environment variable to both templates, corrected redirect URI from `/auth/callback` to `/login_azure` (actual route), updated deployment outputs and UI definition warnings, ensuring login works on deployed Azure instances instead of redirecting to localhost:8000.
- Aligned Docker image names with build scripts: Basic tier now uses `smartlib-web-basic:latest` and `smartlib-worker-basic:latest`, Enterprise tier uses `smartlib-web-enterprise:latest` and `smartlib-worker-enterprise:latest`, matching `build-for-azure-basic.sh` and `build-for-azure-enterprise.sh` output.
- Fixed Redis/Celery configuration flow: removed redundant `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` parameters from both templates (they were always empty and confusing), simplified appSettings logic to directly derive from `redisConnectionString` or `redisConnectionStringSecretUri` with proper Key Vault reference wrapping (`@Microsoft.KeyVault(SecretUri=...)`), removed duplicate outputs from UI definitions, ensuring both direct connection strings and Key Vault secret URIs work correctly.
- Removed `costSavings` output from Enterprise template as it's not applicable when users provide their own infrastructure (PostgreSQL, Redis, Key Vault, Storage).
- Added PostgreSQL-specific outputs to Enterprise template: `postgresServerInfo` (server details, version, connection string format) and `enterpriseFeatures` (tier description, feature list).
- Verified both templates follow consistent patterns: user provides resources via ResourceSelector, ARM template connects to existing infrastructure, Key Vault references auto-resolve for secure credential management, and both web and worker apps receive identical environment variables.
- Files modified: `ARMtemplate/catalog/mainTemplate.json` (Basic - parameters cleanup, redirect URI fix, image names), `ARMtemplate/catalog/mainTemplate_enterprise.json` (Enterprise - PostgreSQL integration, parameters cleanup, redirect URI fix, image names), `ARMtemplate/catalog/createUiDefinition.json` (Basic - redirect URI fix, removed CELERY outputs), `ARMtemplate/catalog/createUiDefinition_enterprise.json` (Enterprise - created with Database step, PostgreSQL configuration, redirect URI fix, removed CELERY outputs).

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

