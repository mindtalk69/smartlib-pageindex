# Single Docker Container Implementation (FastAPI + React)

## Overview
You requested two types of single Docker containers: one for **CPU** and one for **GPU** support.
You also want to test the new **FastAPI** backend + **React** clients, and skip the legacy **Flask** application completely.

To achieve this, we will create two specialized Dockerfiles in the `smartlib-basic` directory. Both will compile the React frontends and run a unified stack managed by `supervisord`.

## Architecture (Inside the Container)
Since we are skipping Flask, we will use **Nginx** inside the container to serve the React frontends and proxy API requests to FastAPI, alongside the background services. 
The container will run 4 processes:
1. **Redis**: Message broker for Celery.
2. **Celery Worker**: Background task processing (handles documents, embeddings).
3. **Uvicorn (FastAPI)**: The backend API running on local port `8001`.
4. **Nginx**: Running on port `8000`, serving the compiled React and Admin React static files, and proxying `/api` and `/fastapi` to the Uvicorn backend.

## Proposed Changes

### 1. New Supervisord Config (`supervisord.single.conf`)
#### [NEW] smartlib-basic/supervisord.single.conf
Create a new configuration file for supervisord that starts:
- `redis-server`
- `alembic upgrade head` (database migrations)
- `celery` worker
- `uvicorn main_fastapi:app` (FastAPI backend)
- `nginx` (Web server for React + Proxy)

### 2. Nginx Configuration (`nginx.single.conf`)
#### [NEW] smartlib-basic/nginx.single.conf
A condensed Nginx configuration that routes:
- `/` and `/app` to `frontend/dist`
- `/admin` to `admin-frontend/dist`
- `/api` to the FastAPI backend (port `8001`)

### 3. CPU Dockerfile (`Dockerfile.single.cpu`)
#### [NEW] smartlib-basic/Dockerfile.single.cpu
- Base: `python:3.11-slim`
- Installs `redis`, `nginx`, `supervisor`, build tools.
- Multi-stage build to compile both React apps (`frontend` and `admin-frontend`).
- Installs Python requirements from `requirements-web.txt` and `requirements-worker.txt`.
- **Crucial step**: Uses the PyTorch CPU index to avoid downloading massive GPU libraries.
- Starts `supervisord`.

### 4. GPU Dockerfile (`Dockerfile.single.gpu`)
#### [NEW] smartlib-basic/Dockerfile.single.gpu
- Base: `nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04` (or similar, or python:3.11 with standard pip install which pulls CUDA wheels).
- Identical stages to the CPU version for frontend and system dependencies.
- **Crucial step**: Installs PyTorch with CUDA support.

### 5. Docker Compose Definitions
#### [NEW] smartlib-basic/docker-compose.single-cpu.yaml
#### [NEW] smartlib-basic/docker-compose.single-gpu.yaml
Compose files to easily spin up these exact images locally with port `8000` mapped.

## Verification Plan
1. Build CPU image: `docker compose -f docker-compose.single-cpu.yaml build`
2. Run CPU image: `docker compose -f docker-compose.single-cpu.yaml up`
3. Access `http://localhost:8000` and verify the React frontend loads.
4. Verify API calls route to FastAPI via network inspection, and background tasks execute via the container logs.
5. Repeat for the GPU setup file if a suitable GPU is available locally.
