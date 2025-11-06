# SmartLib Dependency Licenses

| Component | Version Range | License | Notes |
|-----------|---------------|---------|-------|
| Flask | 2.3.x | BSD-3-Clause | Core web framework. |
| Celery | 5.3.x | BSD-3-Clause | Background task processing. |
| SQLAlchemy | 2.0.x | MIT | ORM and database toolkit. |
| Flask-Migrate | 4.0.x | MIT | Database migration management. |
| Flask-WTF | 1.2.x | BSD-3-Clause | CSRF-protected forms and validation. |
| Flask-Login | 0.6.x | MIT | Authentication session management. |
| LangChain | 0.1.x | MIT | Retrieval-augmented generation pipeline. |
| LangGraph | 0.0.x | MIT | Conversational agent orchestration. |
| ChromaDB | 0.4.x | Apache-2.0 | Vector database for embeddings. |
| Sentence Transformers | 2.5.x | Apache-2.0 | Embedding generation for local models. |
| Torch | 2.1.x | BSD-3-Clause | Machine learning runtime for worker tier. |
| Docling | 0.0.x | Apache-2.0 | Document conversion toolkit. |
| PyMuPDF | 1.23.x | AGPL-3.0 | PDF parsing; triggers source distribution. |
| Azure AI Document Intelligence | 1.0.x | MIT | Cognitive OCR operations. |
| Azure Identity SDK | 1.15.x | MIT | Managed identity authentication. |
| Redis-py | 5.0.x | MIT | Redis client for Celery and caching. |
| Gunicorn | 21.2.x | MIT | Production WSGI server. |

Keep this table synchronized with `LICENSE_INVENTORY.csv`. Expand the table as new
packages enter the project. Use semantic version ranges where possible and link to
upstream license texts stored under `license_texts/`.
