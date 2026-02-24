# Stack Recommendation: FastAPI + React RAG Application

## Recommended Stack (2026)

### Backend API Layer
| Component | Version | Rationale |
|-----------|---------|-----------|
| **FastAPI** | 0.115+ | Auto-generated OpenAPI docs, async support, dependency injection. Critical for production performance vs Flask. |
| **Uvicorn** | 0.30+ | ASGI server, native async support. Use with `--workers` for production. |
| **SQLModel** | 0.0.21+ | Unifies SQLAlchemy models + Pydantic schemas. Already adopted in this project. |
| **SQLAdmin** | 0.18+ | Auto-generated admin UI on top of SQLModel. Reduces admin frontend work significantly. |
| **FastAPI Pagination** | 0.12+ | Standard pagination for list endpoints. Already in use. |
| **Pydantic** | 2.x | Data validation. Comes with FastAPI. |

### Database Layer
| Component | Version | Rationale |
|-----------|---------|-----------|
| **SQLite** | 3.35+ | With sqlite-vec extension for vector storage. Single file, no separate DB server. |
| **sqlite-vec** | Latest | Embedded vector similarity search. No PGVector migration needed. |
| **SQLAlchemy** | 2.0+ | Async support via `asyncio`. SQLModel provides compatibility layer. |
| **aiosqlite** | 0.20+ | Async SQLite driver for FastAPI. Required for non-blocking DB operations. |

### Frontend Layer
| Component | Version | Rationale |
|-----------|---------|-----------|
| **React** | 18.x | Current LTS. Two apps: `/app` (user) and `/admin-app` (admin). |
| **Vite** | 5.x | Fast build tool, HMR for development. Already configured. |
| **TanStack Query** | 5.x | Server state management, caching, auto-refetch. Ideal for REST API consumption. |
| **React Router** | 6.x | Client-side routing for SPA. |
| **Tailwind CSS** | 3.x | Utility-first CSS. Rapid UI development. |

### Infrastructure
| Component | Version | Rationale |
|-----------|---------|-----------|
| **Docker** | 24+ | Containerization for deployment. Existing Docker Compose setup. |
| **Redis** | 7.x | Celery broker. Keep existing setup. |
| **Celery** | 5.3+ | Background task processing for document ingestion/OCR. |
| **Nginx** | 1.25+ | Reverse proxy for serving React builds + proxying to FastAPI/Flask. |

## Flask Coexistence Strategy

**During Migration:**
```
┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│   Flask     │
│   (Port 80) │     │  (Port 5000)│
│             │────▶│   (legacy)  │
│             │     └─────────────┘
│             │────▶│   FastAPI   │
│             │     │  (Port 8001)│
│             │     │   (new)     │
│             │────▶│   Celery    │
│             │     │   (worker)  │
└─────────────┘     └─────────────┘
```

**Nginx routing:**
- `/api/v1/*` → FastAPI (new API endpoints)
- `/admin/*` → FastAPI/SQLAdmin or Flask (depending on migration phase)
- `/app/*` → React build (user frontend)
- `/admin-app/*` → React build (admin frontend)
- `/*` → Flask (legacy catch-all during transition)

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **PostgreSQL/PGVector** | sqlite-vec already works, no need to add complexity |
| **FastAPI-Amis-Admin** | SQLAdmin is more mature, better SQLAlchemy integration |
| **GraphQL** | REST is sufficient, OpenAPI auto-docs are valuable |
| **WebSockets** | SSE or polling sufficient for this use case |
| **Separate admin frontend** | SQLAdmin provides instant CRUD, skip custom admin UI |

## Confidence Levels

| Recommendation | Confidence | Notes |
|----------------|------------|-------|
| FastAPI over Flask | High | Industry standard, proven performance gains |
| SQLModel + SQLAdmin | High | Perfect fit for this project's existing models |
| SQLite + sqlite-vec | Medium | Less common than PGVector but works for this scale |
| React + TanStack Query | High | Standard 2026 stack for consuming REST APIs |
| Nginx reverse proxy | High | Standard pattern for gradual migration |

---
*Last updated: 2026-02-24*
