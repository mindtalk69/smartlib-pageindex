#!/bin/bash
# Sync Admin React build from admin-frontend/dist to static/admin-react for local development

echo "🏗️ Building Admin React frontend..."
cd admin-frontend
npm run build
cd ..
echo "✅ Admin Frontend build complete!"

echo "🔄 Syncing Admin React build from admin-frontend/dist to container..."

# Check if Docker container is running and sync to it
if docker ps | grep -q smartlib-basic-web; then
    echo "🐳 3-container setup detected, syncing to web container..."
    docker exec smartlib-basic-web-1 rm -rf /app/admin-frontend/dist/*
    docker exec smartlib-basic-web-1 mkdir -p /app/admin-frontend/dist
    docker cp admin-frontend/dist/. smartlib-basic-web-1:/app/admin-frontend/dist/
    echo "✅ Synced to Docker container!"
    echo "🔄 Reloading nginx in web container..."
    docker exec smartlib-basic-web-1 nginx -s reload
    echo "✅ Nginx reloaded!"
elif docker ps | grep -q 'smartlib-gpu\|smartlib-basic'; then
    echo "🐳 Single container detected, syncing..."
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep 'smartlib-gpu\|smartlib-basic' | head -n 1)
    docker exec $CONTAINER_NAME rm -rf /app/admin-frontend/dist/*
    docker exec $CONTAINER_NAME mkdir -p /app/admin-frontend/dist
    docker cp admin-frontend/dist/. $CONTAINER_NAME:/app/admin-frontend/dist/
    echo "✅ Synced to single container ($CONTAINER_NAME)!"
    docker exec $CONTAINER_NAME supervisorctl -s http://localhost:9001 restart nginx > /dev/null 2>&1
    echo "✅ Nginx reloaded via supervisorctl!"
else
    echo "ℹ️  No Docker container running, skipping container sync"
fi

echo "✅ Done! You can now access the admin app at http://localhost:8000/admin"
