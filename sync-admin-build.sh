#!/bin/bash
# Sync Admin React build from admin-frontend/dist to static/admin-react for local development

echo "🏗️ Building Admin React frontend..."
cd admin-frontend
npm run build
cd ..
echo "✅ Admin Frontend build complete!"

echo "🔄 Syncing Admin React build from admin-frontend/dist to static/admin-react..."

# Ensure the destination exists
mkdir -p static/admin-react/

# Remove old build and copy new one
rm -rf static/admin-react/*
cp -r admin-frontend/dist/* static/admin-react/

echo "✅ Admin React build synced to static/admin-react/"

# Check if Docker container is running and sync to it
if docker ps | grep -q smartlib-basic-web; then
    echo "🐳 3-container setup detected, syncing to web container..."
    docker exec smartlib-basic-web-1 mkdir -p /app/static/admin-react
    docker cp static/admin-react/. smartlib-basic-web-1:/app/static/admin-react/
    echo "✅ Synced to Docker container!"
    echo "🔄 Restarting web container..."
    docker compose restart web > /dev/null 2>&1
    echo "✅ Web container restarted!"
elif docker ps | grep -q 'smartlib-gpu\|smartlib-basic$'; then
    echo "🐳 Single container detected, syncing..."
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep 'smartlib-gpu\|smartlib-basic$' | head -n 1)
    docker exec $CONTAINER_NAME mkdir -p /app/static/admin-react
    docker cp static/admin-react/. $CONTAINER_NAME:/app/static/admin-react/
    echo "✅ Synced to single container ($CONTAINER_NAME)!"
    docker exec $CONTAINER_NAME supervisorctl restart web > /dev/null 2>&1
    echo "✅ Web (Gunicorn) process restarted in supervisord!"
else
    echo "ℹ️  No Docker container running, skipping container sync"
fi

echo "✅ Done! You can now access the admin app at http://localhost:8000/app-admin"
