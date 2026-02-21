# ============================================================================
# SmartLib BASIC - Single Container (Minimal Size)
# Web + Worker + Redis alternative in one container
# Uses SQLite for everything (no Redis, no external DB)
# Target: ~500-600MB
# ============================================================================

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_EXTRA_INDEX_URL="https://download.pytorch.org/whl/cpu"

WORKDIR /app

# Minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libffi-dev \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libxml2-dev \
    libxslt1-dev \
    libssl-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Node.js for building frontend assets
FROM node:20-alpine AS node

WORKDIR /app
COPY package.json ./
RUN npm install --silent
COPY vite.config.js ./
COPY static ./static
RUN npm run build

# Main Python image
FROM base AS python

# Install only essential Python dependencies
# Single container minimal deps (~250-300MB)
COPY requirements-single.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy app code
COPY . /app

# Copy built frontend assets from node stage
COPY --from=node /app/static/dist /app/static/dist

# Setup data directory
RUN mkdir -p /home/data && chmod 777 /home/data

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Run web server (worker tasks run inline via Celery beat or direct)
CMD ["web"]

# ============================================================================
# Build: docker build -t smartlib-basic:latest .
# Run:   docker run -p 8000:8000 -v ./data:/home/data smartlib-basic:latest
# ============================================================================
