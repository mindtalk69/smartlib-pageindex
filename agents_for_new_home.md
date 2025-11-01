# SmartLib Migration Execution Guide

## 0. Purpose & Scope
- Reorganize the existing `flaskrag3` workspace into a clean `smartlib` repository ready for Azure Marketplace distribution.
- Preserve the split web/worker container strategy captured in `LOCAL_DOCKER_SETUP_SUMMARY.md` while renaming all artifacts to SmartLib.
- Ship two product tiers:
  - **Basic**: SQLite + ChromaDB + Azure OpenAI (API embeddings by default).
  - **Enterprise**: PostgreSQL/pgvector + ChromaDB optional fallback + Azure OpenAI (supports local embeddings on the worker).

## 1. Pre-Flight Checklist
- Confirm you are in WSL with Docker Desktop running and have Python 3.11 or 3.12 available (`python3 --version`).
- Install the tooling used by this plan:
  - `curl -LsSf https://astral.sh/uv/install.sh | sh` (installs `uv`).
  - `uv tool install pre-commit` (optional but recommended).
  - `az extension add --name azure-devops` if ARM validation is needed.
- Ensure `flaskrag3` working tree is clean (`git status`). The source repo remains the authoritative reference during migration.

## 2. Repository Bootstrap
1. Create the directory skeleton inside `/home/mlk/smartlib`:
   ```bash
   mkdir -p ARMtemplate/docs docs/migrations docs/operations migrations modules/static modules/templates scripts toolkits tests data
   ```
   Consolidate later once files are copied (e.g., move `modules/templates` into root `templates`).
2. Initialize git and primary metadata:
   - `git init` inside `smartlib`.
   - Copy `.gitignore` and `.dockerignore` templates from this plan (see §3.3) or generate via `uv init --app smartlib`.
   - Add `README.md` explaining SmartLib tiers, local vs Azure deployment, and referencing `docs/`.
   - If you need a license, add `LICENSE` (MIT unless otherwise directed).
3. Create placeholder `data/.keep` (empty) to document local SQLite storage without shipping the actual database file.

## 3. Dependency Management with uv
1. Run `uv init --app smartlib` to scaffold `pyproject.toml`.
2. Split dependencies into three lock sets:
   - `requirements-web.in` derived from `requirements-web-ultralight.txt` (web-only dependencies, API embeddings, MSAL).
   - `requirements-worker.in` derived from `requirements-worker.txt` (full ML/document pipeline).
   - `requirements-dev.in` for shared dev tooling (pytest, black, ruff/isort, mypy as required).
3. Use `uv pip compile` to produce pinned `requirements-web.txt`, `requirements-worker.txt`, and `requirements-dev.txt`.
4. Generate a top-level `uv.lock` by running `uv sync --all-extras` once initial `pyproject.toml` is finalized.
5. Drop old `requirements-*.txt` variants that are not referenced in this plan to avoid confusion.

## 4. Environment Files & Secrets Hygiene
1. Create `.env.example` with **no secrets**. Document both Basic and Enterprise configuration blocks:
   - Basic: `SQLALCHEMY_DATABASE_URI=sqlite:///data/app.db`, `VECTOR_STORE_PROVIDER=chromadb`.
   - Enterprise: `SQLALCHEMY_DATABASE_URI=postgresql+psycopg://...`, `PGVECTOR_CONNECTION_STRING=postgresql+psycopg://...`.
   - Shared: Redis URLs, Azure OpenAI keys (placeholder values), Celery settings, feature flags.
2. Copy `.env.dev` from `flaskrag3` only after redacting secrets (OpenAI keys, client IDs, LangSmith, etc.). Replace with placeholder tokens and move real values to your local untracked `.env.local`.
3. In `config.py`, rename `smartlib_CONFIG_FILE` to `SMARTLIB_CONFIG_FILE` and default to `.env.dev`.
4. Document how enterprise customers should store secrets with Azure Key Vault and managed identity (`docs/azure_managed_identity_keyvault_guide.md`).

## 5. Core Application Migration
### 5.1 Core Flask entry points
Copy and clean the following files into the new repository root:
- `app.py`, `main.py` (if still routing requests), `celery_app.py`, `extensions.py`, `config.py`, `geo_utils.py`, `m365_tools.py`, `common_categories_data.md` (converted to JSON if used at runtime).
- Remove noisy debug prints inside `config.py` and `app.py` before committing.
- Update any `smartlib` or `flaskrag3` references (module names, logging prefixes, CLI banners) to `smartlib`.

### 5.2 Module curation
Copy only the actively used modules (skip backups or historical copies):
- Admin blueprint suite: `admin.py`, `admin_catalogs.py`, `admin_downloads.py`, `admin_embeddings.py`, `admin_feedback.py`, `admin_files.py`, `admin_folder_upload.py`, `admin_groups.py`, `admin_knowledges.py`, `admin_languages.py`, `admin_libraries.py`, `admin_messages.py`, `admin_models.py`, `admin_user_groups.py`, `admin_users.py`, `admin_vector_references.py`, `admin_visual_grounding.py`.
- Core features: `agent.py`, `agent_tasks.py`, `callbacks.py`, `celery_tasks.py`, `change_password.py`, `database.py`, `dataframe_agent.py`, `evidence_utils.py`, `feedback.py`, `forms.py`, `index.py`, `llm_utils.py`, `login.py`, `login_azure.py`, `logout.py`, `map_utils.py`, `ocr_utils.py`, `query.py`, `register.py`, `selfquery.py`, `upload.py`, `upload_processing.py`, `vector_store_utils.py`, `vector_tasks.py`, `view_document.py`.
- Exclude files such as `agent copy.py`, `upload.py.backup*`, and other backups to keep the new repo tidy.
- Consider splitting `modules/` into subpackages (`modules/admin`, `modules/auth`, etc.) if you refactor during migration; update imports accordingly.

### 5.3 Toolkits and helper packages
- Copy `toolkits/` entirely (charting, dataframe tools, pandas helpers).
- Verify their imports reference `modules` correctly after renaming to SmartLib.

### 5.4 Command-line utilities & maintenance scripts
Only bring scripts required for deployment/operations. Recommended shortlist:
- Database/bootstrap: `init_db_script.py`, `create_default_models.py`, `add_admin_user.py`, `promote_admin.py`, `remove_default_admin.py`, `import_backup_data.py`, `import_vector_refs.py`, `set_vector_store_mode_knowledge.py`.
- Diagnostics: `diagnose-flask.sh`, `diagnose-image.sh`, `why-crash.sh`, `verify_migrations.sh`, `check_vector_store_mode.py`.
- Upgrade helpers: migrations in `/migrations/versions`, `add_*` migration helpers, `create_groups_tables.sql`.
- Clean up or archive the remaining scripts in a `legacy/` folder if you need them for reference but not for distribution.

### 5.5 Tests & QA harness
- Copy `tests/` (including `tests/e2e`) and ensure the Playwright/Vitest setup under `tests/e2e/` still runs after package rename.
- Update import paths inside `tests/test_query_resume.py` and any fixtures to point to `smartlib` modules.

## 6. Templates, Static Assets & Frontend JS
1. Copy the entire `templates/` tree, including `templates/admin/` and shared layout files like `templates/base.html`, `templates/index.html`, etc.
2. Copy `static/css`, `static/js`, and `static/img`. Remove obsolete bundles created during experimentation.
3. Update static references that use `smartlib` or `flaskrag3` naming in JS files (search for `smartlib`, `flaskrag`).
4. Make sure admin JS for folder upload (`static/js/admin/admin-folder-upload.js`) is included; it pairs with the Celery tasks documented above.

## 7. Database & Migrations
1. Copy the full `migrations/` directory along with `alembic.ini`.
2. Edit `migrations/env.py` so the metadata import points at `smartlib.modules.database`. Typical diff:
   ```python
   from smartlib.modules.database import db
   ```
3. Run `uv run flask db upgrade` locally (Basic tier) to validate SQLite migrations.
4. For Enterprise verification, set `SQLALCHEMY_DATABASE_URI` to your PostgreSQL dev instance and rerun `uv run flask db upgrade` to ensure pgvector migrations succeed.
5. Keep `verify_migrations.sh` in the root scripts. Update its logging to mention SmartLib.

## 8. Docker, Compose & Local Tooling
1. Rename Dockerfiles when copying:
   - `Dockerfile.cpu.micro` → `Dockerfile.web` (update `LABEL`, image tags, and copy directives to reference `smartlib`).
   - `Dockerfile.worker-optimized` → `Dockerfile.worker`.
2. Update `docker-compose.yaml`:
   - Change service names to `smartlib-web` and `smartlib-worker`.
   - Use new image tags (`smartlib-web`, `smartlib-worker`) when pushing to ACR.
   - Ensure the volume mount points stay at `/app/data`.
3. Copy `docker-entrypoint.sh` and change log messaging to SmartLib.
 4. Refresh shell helpers:
    - Provide `rebuild-micro.sh` to build/tag `smartlib-web` and `smartlib-worker` images; update scripts to call it.
    - Keep `test-local-compose.sh` but change container names, success messages, and expected URLs.
    - Keep `diagnose-*.sh` scripts and rebrand output.
    - Ensure entrypoint supports optional `AUTO_PROMOTE_ADMIN` bootstrap via app settings or Key Vault references.
5. Retain `LOCAL_DOCKER_SETUP_SUMMARY.md` and place it in `docs/operations/` for reference.

## 9. ARM Templates & Azure Artifacts
1. Copy the validated templates listed below into `ARMtemplate/` and rename references to SmartLib where appropriate:
   - `flask_appservice_template.json`
   - `flask_appservice_template_conditional_kv.json`
   - `flask_appservice_template_shared_plan.json`
   - `celery_worker_appservice.json`
   - Any supporting parameter files that are still relevant.
2. Copy the accompanying docs from `ARMtemplate/docs/`:
   - `QUICK_START_GUIDE.md`, `SHARED_PLAN_GUIDE.md`, `DOCKER_SPLIT_OPTIMIZATION.md`, `redis_and_celery_deployment.md`, `EXECUTIVE_SUMMARY.md`.
3. Update all template parameters (`linuxFxVersion`, `appCommandLine`, image names) to reference SmartLib images and secrets.
4. Include instructions for publishing to Azure Marketplace in the main README, referencing these templates.

## 10. Product Documentation
1. Create `docs/DEPLOYMENT.md` and `docs/DEVELOPMENT.md` using the outlines from the existing root AGENTS plan.
2. Copy relevant planning documents that remain accurate:
   - `docs/admin_module_structure.md`
   - `docs/admin_folder_upload_full_implementation_plan.md`
   - `docs/chat_feedback_and_history.md`
   - `docs/automated_admin_promotion_and_keyvault_plan.md`
   - Any go-to-market notes that help operators understand SmartLib’s feature set.
3. Archive or omit documents that are purely historical; keep the new repo focused on actionable guides.
4. Update screenshots or diagrams if they still show `flaskrag3` branding.

## 11. QA & Validation Checklist
1. Run unit tests: `uv run pytest`.
2. Run Playwright/Vitest e2e suite if applicable (ensure Node toolchain is installed).
3. Build and smoke-test Docker images:
   ```bash
   ./build-split-images.sh
   docker compose up -d
   ./test-local-compose.sh
   ```
4. Validate Celery background processing by uploading a sample document and checking worker logs.
5. Execute `verify_migrations.sh` for both SQLite (Basic) and PostgreSQL (Enterprise).
6. Review logs to ensure no lingering `flaskrag` or `smartlib` identifiers remain.

## 12. Release Checklist
- Update `docker-compose.yaml` and ARM template `linuxFxVersion` strings with the final registry/image tags (e.g., `smartlib.azurecr.io/web:1.0.0`).
- Push images to ACR and perform `az acr repository show-tags` to confirm availability.
- Re-run `az deployment group create` dry runs using the updated templates.
- Tag the git repository (`git tag v1.0.0`) and prepare release notes summarizing Basic vs Enterprise differences.
- Ensure `.gitignore` excludes local data, caches, `.env*`, `celery_results.sqlite`, and IDE directories; ensure `.dockerignore` omits docs, tests, and development scripts from container builds.

## Appendix A – Files to Exclude from the New Repo
- Backups: `modules/upload.py.backup*`, `modules/agent copy.py`, `modules/query_backup.py`.
- Legacy notebooks unless explicitly required: `*.ipynb` under root or experiments.
- Old Dockerfiles not tied to the split architecture (e.g., `Dockerfile.cpu`, `Dockerfile.cpu.ultra-minimal`) unless you plan to maintain them.
- Secrets-containing files: `celery_results.sqlite`, existing `.env.*` backups, `cookies.txt`.

## Appendix B – Useful References
- `LOCAL_DOCKER_SETUP_SUMMARY.md`: Local compose workflow, health checks, troubleshooting.
- `ARMtemplate/docs/DOCKER_SPLIT_OPTIMIZATION.md`: Rationale for split images and Azure B1 sizing.
- `docs/azure_managed_identity_keyvault_guide.md`: Secure secret retrieval in Azure App Service.
- `scripts/test-local-compose.sh`: Automated smoke test script; keep it aligned with renamed images.

Follow this execution guide sequentially. Mark each section complete in a tracking issue as you migrate components to ensure nothing is missed.
