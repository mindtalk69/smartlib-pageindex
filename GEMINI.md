# SmartLib Agent Guide
- Latest Current progress in docs/dev_progress_log.md
- built using `rebuild-micro.sh`
- Python 3.11 preferred (3.10+ works); bootstrap with `python -m venv .venv` and `pip install -r requirements.txt`.
- Web or worker-only installs: use `requirements-web.txt` or `requirements-worker.txt` respectively.
- Local dev server: export `FLASK_APP=app.py`, load .env, then run `flask run --debug`.
- Docker workflow: `docker compose up --build` rebuilds containers; stop with `docker compose down`.
- Primary tests: `pytest`; target one test via `pytest tests/<path>.py::TestClass::test_method` or `pytest -k keyword`.
- Database migrations: run `flask db migrate`, `flask db upgrade`; use `./verify_migrations.sh` after syncing data.
- Lint/format before commits: `black .`, `isort .`, and `flake8`.
- Align imports as isort's black profile: stdlib, third-party, local, with explicit relative imports avoided.
- Keep line length ≤88 characters; break chains with parentheses rather than backslashes.
- Prefer type hints across modules; use `typing` helpers and `pydantic` models where appropriate.
- Name modules, functions, variables in snake_case; classes and exceptions in PascalCase; constants UPPER_SNAKE_CASE.
- Write docstrings for public functions/classes summarizing purpose, params, and error scenarios.
- Handle errors via structured exceptions; log context and return meaningful Flask responses instead of bare prints.
- Guard external calls (LLMs, Azure) with retries/timeout configs defined in config modules.
- Avoid storing secrets in repo; rely on `.env` or Azure KeyVault references outlined in docs.
- Ensure templates/static assets stay organized under their dedicated directories with descriptive names.
- No Cursor or Copilot rule files exist; follow this guide and project docs.
- Before finishing, rerun tests and docker compose builds if you altered dependencies or migrations.

# SmartLib Project Reorganization Agent Plan

## Overview

This document outlines the plan for an agent in `smartlib` folder structure. The goal is to create a production-ready, well-organized codebase for the SmartLib product that will be distributed on Azure Marketplace.

## Project Background

SmartLib is a RAG (Retrieval-Augmented Generation) agentic application built with:
- Python Flask for web interface
- Docker for containerization (web & worker containers)
- LangChain + LangGraph for agent functionality
- Docling for document processing
- Azure Document Intelligence for OCR
- Azure OpenAI for LLM integration
- ChromaDB/SQLite for vector storage (PostgreSQL in Enterprise version, later we'll setup)

The project will have two product tiers:
1. **Basic** - Uses SQLite and ChromaDB
2. **Enterprise** - Adds PostgreSQL support


## File Structure for New Project

```
/home/mlk/smartlib/
├── .gitignore                     # Git ignore file
├── .dockerignore                  # Docker ignore file
├── README.md                      # Project documentation
├── LICENSE                        # Project license
├── pyproject.toml                 # Python project configuration
├── requirements-web.txt           # Web container dependencies
├── requirements-worker.txt        # Worker container dependencies
├── requirements.txt               # Combined dependencies (for dev)
├── docker-compose.yaml            # Docker Compose for local testing
├── docker-entrypoint.sh           # Entry point script for Docker
├── Dockerfile.web                 # Dockerfile for web container
├── Dockerfile.worker              # Dockerfile for worker container
├── app.py                         # Main application file
├── config.py                      # Configuration settings
├── extensions.py                  # Flask extensions
├── celery_app.py                  # Celery configuration
├── alembic.ini                    # Database migration config
├── ARMtemplate/                   # Azure ARM templates
│   ├── flask_appservice_template_shared_plan.json
│   ├── docs/
│   │   ├── QUICK_START_GUIDE.md
│   │   └── [other template docs]
├── docs/                          # Documentation
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md
│   └── [other product docs]
├── migrations/                    # Database migrations
├── modules/                       # Application modules
│   ├── admin.py
│   ├── agent.py
│   ├── database.py
│   ├── upload.py
│   ├── query.py
│   └── [other modules]
├── static/                        # Static assets
├── templates/                     # HTML templates
│   ├── admin/
│   ├── base.html
│   ├── index.html
│   └── [other templates]
├── scripts/                       # Utility scripts
│   ├── create_admin.py
│   └── [other scripts]
├── toolkits/                      # Custom agent toolkits
└── tests/                         # Unit and integration tests
```



   
   ## Azure Deployment
   
   SmartLib can be deployed to Azure using the provided ARM templates.
   
   ### Using ARM Templates
   
   See the detailed guide in `/ARMtemplate/docs/QUICK_START_GUIDE.md` for Azure deployment instructions.
   
   ## Enterprise Deployment
   
   For enterprise deployments with PostgreSQL (NEXT RELEASE):
   
   1. Provision a PostgreSQL server in Azure
   2. Update the `.env` file with PostgreSQL connection settings
   3. Deploy using the ARM templates as described above
   EOF
   
   # Development guide
   cat > /home/mlk/smartlib/docs/DEVELOPMENT.md << 'EOF'
   # SmartLib Development Guide
   
   This document provides guidelines for developing and extending SmartLib.
   
   ## Development Environment Setup
   
   ### Local Setup with Virtual Environment
   
   1. Create a virtual environment:
      ```bash
      python -m venv .venv
      source .venv/bin/activate  # On Windows: .venv\Scripts\activate
      ```
   
   2. Install dependencies:
      ```bash
      pip install -r requirements.txt
      ```
   
   3. Set up environment variables:
      ```bash
      cp .env.example .env.dev
      # Edit .env.dev with your settings
      ```
   
   4. Run the application:
      ```bash
      flask run --debug
      ```
   
   ### Docker Development Environment
   
   Use Docker Compose for a containerized development environment:
   
   ```bash
   docker compose up -d
   ```
   
   ## Project Structure
   
   - **app.py**: Main application entry point or main.py ??
   - **config.py**: Configuration settings
   - **modules/**: Application modules
     - **admin.py**: Admin interface
     - **agent.py**: Agent functionality
     - **database.py**: Database models
     - **upload.py**: Document upload
     - **query.py**: RAG query handling
   - **templates/**: HTML templates
   - **static/**: Static assets
   - **migrations/**: Database migrations
   - **ARMtemplate/**: Azure deployment templates
   
   ## Making Changes
   
   ### Database Changes
   
   Use Flask-Migrate for database changes:
   
   ```bash
   flask db migrate -m "Description of changes"
   flask db upgrade
   ```
   
   ### Adding New Features
   
   1. Create or modify modules in the `modules/` directory
   2. Update templates as needed
   3. Add routes to the appropriate module
   4. Register blueprints in `app.py` if creating new modules or `main.py` 
   
   ### Testing
   
   Run tests using pytest:
   
   ```bash
   pytest
   ```
   
   ## Deployment
   
   See `DEPLOYMENT.md` for deployment instructions.
   EOF
   ```


## Testing Plan

After setting up the new project structure, follow this testing plan to verify everything works as expected:

1. **Docker Compose Local Testing**
   ```bash
   cd /home/mlk/smartlib
   docker compose up -d
   ```
   - Verify all services start successfully
   - Access web interface at http://localhost:8000
   - Login with admin credentials
   - Test document upload
   - Test RAG query functionality

2. **Database Migration Testing**
   ```bash
   cd /home/mlk/smartlib
   flask db upgrade
   ```
   - Verify database schema is up to date
   - Test user authentication

3. **ARM Template Testing**
   - Deploy to a test Azure environment using the ARM templates
   - Verify web and worker services deploy correctly
   - Verify Redis connectivity
   - Test end-to-end functionality


## USER INTERFACE (index.html)

The `index.html` file serves as the main user chat interface for the SmartThing application. It's a Flask template that extends from `base.html` and provides two primary views:
1. A welcome page for unauthenticated users
2. A chat interface with document search functionality for authenticated users.

## Overview of Upload & Ingest

docs/upload_ingest.md

## Overview of Vector Store Modes

The SmartThing application has three different vector store modes that significantly affect how the user interface in `index.html` functions:

Please read on docs/ui/index-html.md and docs/ui/index-html-vectore_store.md for more details.

## FINAL ARM Template
ARMtemplate/catalog/createUiDefinition.json
ARMtemplate/catalog/mainTemplate.json

## Progress Dayli
Always check this document
[text](docs/dev_progress_log.md)