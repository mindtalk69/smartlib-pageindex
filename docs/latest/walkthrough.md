# Single Docker Container Implementation (FastAPI + React)

## What was Changed

To fulfill the request of running everything inside a single container, bypassing the legacy Flask app, and providing both GPU and CPU definitions, the following actions were taken:

1. **Created [nginx.single.conf](file:///home/mlk/smartlib-basic/nginx.single.conf)**: This configuration utilizes Nginx to serve the compiled statics for both `/app` (modern frontend) and `/admin` (admin frontend) locally. It also securely proxies any routes targeting `/api` or `/fastapi` to `localhost:8001`.
2. **Created [supervisord.single.conf](file:///home/mlk/smartlib-basic/supervisord.single.conf)**: Added a process manager to the container setup that spins up internal persistence (Redis), the background task processor (`celery` worker), the FastAPI application (`uvicorn`), and the web proxy (`nginx`).
3. **Created `Dockerfile.single.cpu`**: A highly optimized CPU variant. It explicitly instructs PIP to download PyTorch from the CPU-only repository, averting the download of multi-gigabyte CUDA libraries.
4. **Created `Dockerfile.single.gpu`**: A GPU-enabled variant using the standard PyPI PyTorch wheels which inherently ship with CUDA bindings for use with NVIDIA GPUs.
5. **Created Docker Compose Wrappers**: Defined [docker-compose.single-cpu.yaml](file:///home/mlk/smartlib-basic/docker-compose.single-cpu.yaml) and `docker-compose.single-gpu.yaml` to easily inject `.env.dev` variables and volume mounts when running locally.
6. **Comprehensive Frontend JWT Migration**: Refactored every single raw [fetch()](file:///home/mlk/smartlib-basic/admin-frontend/src/lib/api-client.ts#62-98) call in both the main application and the admin portal. 
    - Migrated UI components ([App.tsx](file:///home/mlk/smartlib-basic/frontend/src/App.tsx), [HistoryPanel.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/HistoryPanel.tsx), [VisualEvidence.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/VisualEvidence.tsx), [UserProfile.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/UserProfile.tsx), [ModelSelector.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/ModelSelector.tsx), [KnowledgeSelector.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/KnowledgeSelector.tsx), [DocumentViewer.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/DocumentViewer.tsx)) to use the authenticated [api](file:///home/mlk/smartlib-basic/frontend/src/utils/apiClient.ts#92-117) utility.
    - Updated document upload tabs ([FileUploadTab.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/upload/FileUploadTab.tsx), [UrlDownloadTab.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/upload/UrlDownloadTab.tsx)) to support JWT-authenticated multipart and URL processing.
    - Enhanced the [apiClient.ts](file:///home/mlk/smartlib-basic/frontend/src/utils/apiClient.ts) utility to support diverse response types (streaming SSE, Blobs, JSON) while automatically attaching Bearer tokens.
    - Unified the logout and session management in [NavigationMenu.tsx](file:///home/mlk/smartlib-basic/frontend/src/components/NavigationMenu.tsx) and [AuthContext.tsx](file:///home/mlk/smartlib-basic/frontend/src/contexts/AuthContext.tsx).
7. **FastAPI Admin Logic Infrastructure**: 
    - Ported legacy Flask download logic to a new `AdminDownloadsRouter` in FastAPI.
    - Registered [UrlDownload](file:///home/mlk/smartlib-basic/modules/models.py#285-301) and other models in the generic CRUD router.
    - Fixed 401/403 status code responses for compatibility with modern frontend handlers.
    - Ported [embedding_validation.py](file:///home/mlk/smartlib/modules/embedding_validation.py) and implemented associated compatibility check endpoints.
    - Implemented missing `/api/history` and `/api/counters` endpoints in FastAPI.
8. **API Path Standardization**:
    - Centralized all API calls through `/api/v1` via [apiClient.ts](file:///home/mlk/smartlib-basic/frontend/src/utils/apiClient.ts).
    - Refactored all main and admin frontend components to use standardized relative paths, ensuring complete backend parity.

## How to Test

### CPU Mode
If you are testing on a machine without an NVIDIA GPU or do not want to use GPU resources:

```bash
cd smartlib-basic
docker compose -f docker-compose.single-cpu.yaml up --build
```

### GPU Mode
If you have an NVIDIA GPU, the Nvidia container toolkit installed, and want hardware acceleration:

```bash
cd smartlib-basic
docker compose -f docker-compose.single-gpu.yaml up --build
```

### Verification
Once the container starts:
1. Navigate to [http://localhost:8000/app](http://localhost:8000/app) for the main application.
2. Navigate to [http://localhost:8000/admin](http://localhost:8000/admin) for the admin portal.
3. Observe the output logs; Nginx handles static file delivery instantly, while Uvicorn handles backend API logic, logging database migrations, and Celery worker health efficiently.
