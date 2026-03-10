#!/bin/bash
# Hot-patch FastAPI backend files to running container (no full rebuild needed)

CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep -E 'smartlib-gpu|smartlib-basic|smartlib-pageindex' | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "ℹ️  No Docker container running, skipping container sync"
    exit 0
fi

echo "🐳 Container: $CONTAINER_NAME"

# ── Sync core FastAPI files ──────────────────────────────────────────────────
echo "🔄 Syncing FastAPI backend files..."
docker cp main_fastapi.py   $CONTAINER_NAME:/app/main_fastapi.py
docker cp database_fastapi.py $CONTAINER_NAME:/app/database_fastapi.py
docker cp config.py         $CONTAINER_NAME:/app/config.py
docker cp schemas.py        $CONTAINER_NAME:/app/schemas.py
docker cp celery_app.py     $CONTAINER_NAME:/app/celery_app.py

# ── Sync modules/ (backend logic only) ──────────────────────────────────────
echo "🔄 Syncing modules/..."
docker cp modules/ $CONTAINER_NAME:/app/modules/

echo "✅ Backend files synced!"

# ── Restart FastAPI via supervisord ─────────────────────────────────────────
echo "🔄 Restarting FastAPI..."
docker exec $CONTAINER_NAME bash -c \
    "supervisorctl restart fastapi 2>/dev/null || \
     curl -s 'http://127.0.0.1:9001/index.html?processname=fastapi&action=restart' > /dev/null" || true

echo "⏳ Waiting 3s for FastAPI to restart..."
sleep 3

echo "✅ Done! API available at http://localhost/api/v1"
