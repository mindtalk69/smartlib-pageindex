#!/bin/bash
# Sync React builds (frontend + admin-frontend) to running container

set -e

# ── User frontend (/app) ─────────────────────────────────────────────────────
echo "🏗️  Building React user frontend (frontend/)..."
cd frontend
npm run build
cd ..
echo "✅ User frontend build complete!"

# ── Admin frontend (/admin) ──────────────────────────────────────────────────
echo "🏗️  Building React admin frontend (admin-frontend/)..."
cd admin-frontend
pnpm build 2>/dev/null || npm run build
cd ..
echo "✅ Admin frontend build complete!"

# ── Sync to running Docker container ────────────────────────────────────────
CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep -E 'smartlib-gpu|smartlib-basic|smartlib-pageindex' | head -n 1)

if [ -n "$CONTAINER_NAME" ]; then
    echo "🐳 Container detected: $CONTAINER_NAME — syncing builds..."
    docker cp frontend/dist/. $CONTAINER_NAME:/app/frontend/dist/
    docker cp admin-frontend/dist/. $CONTAINER_NAME:/app/admin-frontend/dist/
    echo "✅ Synced frontend builds to container!"
else
    echo "ℹ️  No Docker container running, skipping container sync"
fi

echo "✅ Done! Access the app at:"
echo "   http://localhost/app   → User chat"
echo "   http://localhost/admin → Admin panel"
