#!/bin/bash
# Sync React build from frontend/dist to static/react for local development

echo "🏗️ Building React frontend..."
cd frontend
npm run build
cd ..
echo "✅ Frontend build complete!"

echo "🔄 Syncing React build from frontend/dist to static/react..."

# Remove old build and copy new one
rm -rf static/react/*
cp -r frontend/dist/* static/react/

echo "✅ React build synced to static/react/"

# Check if Docker container is running and sync to it
if docker ps | grep -q smartlib-web; then
    echo "🐳 Docker container detected, syncing to container..."
    docker cp static/react/. smartlib-web-1:/app/static/react/
    echo "✅ Synced to Docker container!"
    echo "🔄 Restarting web container..."
    docker compose restart web > /dev/null 2>&1
    echo "✅ Web container restarted!"
else
    echo "ℹ️  No Docker container running, skipping container sync"
fi

echo "✅ Done! You can now access the app at http://localhost:8000/app"
