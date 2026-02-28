#!/bin/bash
# Sync FastAPI backend to running container (hot-patch without rebuild)

echo "🔄 Syncing main_fastapi.py to running container..."

# Check if Docker container is running and sync to it
if docker ps | grep -q smartlib-basic-web; then
    echo "🐳 3-container setup detected, syncing to worker/web container..."
    docker cp main_fastapi.py smartlib-basic-fastapi-1:/app/main_fastapi.py
    echo "✅ Synced to Docker container!"
    echo "🔄 Restarting FastAPI service..."
    docker exec smartlib-basic-fastapi-1 supervisorctl -s http://localhost:9001 restart fastapi > /dev/null 2>&1
    echo "✅ FastAPI restarted!"
elif docker ps | grep -q 'smartlib-gpu\|smartlib-basic'; then
    echo "🐳 Single container detected, syncing..."
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep 'smartlib-gpu\|smartlib-basic' | head -n 1)
    docker cp main_fastapi.py $CONTAINER_NAME:/app/main_fastapi.py
    docker cp modules/models.py $CONTAINER_NAME:/app/modules/models.py
    echo "✅ Synced to single container ($CONTAINER_NAME)!"
    echo "🔄 Restarting FastAPI via supervisord..."
    docker exec $CONTAINER_NAME bash -c "curl -s -L 'http://127.0.0.1:9001/index.html?processname=fastapi&action=restart' > /dev/null" 2>/dev/null || true
    echo "⏳ Waiting for FastAPI to restart..."
    sleep 5
    echo "✅ FastAPI restarted!"
else
    echo "ℹ️  No Docker container running, skipping container sync"
fi

echo "✅ Done! Backend API is now updated at http://localhost:8000/api/v1"
