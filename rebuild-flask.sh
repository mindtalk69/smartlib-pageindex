#!/bin/bash

# Rebuild script for Flask application
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Rebuilding Flask Docker Image (CPU-Optimized)    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Verify files exist
echo "1️⃣  Checking required files..."
MISSING=0

if [ ! -f "docker-entrypoint.sh" ]; then
    echo "❌ docker-entrypoint.sh not found!"
    echo "   Copy from: docker-entrypoint-flask.sh"
    MISSING=1
fi

if [ ! -f "Dockerfile.cpu" ]; then
    echo "❌ Dockerfile.cpu not found!"
    echo "   Copy from: Dockerfile-flask.cpu"
    MISSING=1
fi

if [ ! -f "requirements-cpu.txt" ]; then
    echo "❌ requirements-cpu.txt not found!"
    echo "   Copy from: requirements-flask-cpu.txt"
    MISSING=1
fi

if [ ! -d "modules" ]; then
    echo "❌ modules/ directory not found!"
    MISSING=1
fi

if [ ! -f "main.py" ] && [ ! -f "app.py" ]; then
    echo "❌ No main.py or app.py found!"
    MISSING=1
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "Please copy the Flask-specific files first!"
    exit 1
fi

echo "✅ All required files present"
echo ""

# Check .env.dev
echo "2️⃣  Checking .env.dev..."
if [ ! -f ".env.dev" ]; then
    echo "⚠️  No .env.dev found, creating minimal one..."
    cat > .env.dev << 'ENVEOF'
LOCAL_MODE=true
APP_MODULE=main:app
PORT=8000
WORKERS=1
ENVEOF
    echo "✅ Created .env.dev"
else
    if ! grep -q "LOCAL_MODE" .env.dev; then
        echo "⚠️  Adding LOCAL_MODE=true to .env.dev..."
        echo "LOCAL_MODE=true" >> .env.dev
    fi
    if ! grep -q "APP_MODULE" .env.dev; then
        echo "⚠️  Adding APP_MODULE to .env.dev..."
        echo "APP_MODULE=main:app" >> .env.dev
    fi
    echo "✅ .env.dev configured"
fi
echo ""

# Clean up
echo "3️⃣  Cleaning up old images..."
docker rmi smartlib-app:cpu-latest 2>/dev/null || echo "No old image to remove"
echo ""

# Build
echo "4️⃣  Building Flask image..."
echo "─────────────────────────────────────────────────────────"
DOCKER_BUILDKIT=1 docker build \
    -f Dockerfile.cpu \
    -t smartlib-app:cpu-latest \
    --progress=plain \
    .

echo ""
echo "✅ Build complete!"
echo ""

# Check size
echo "5️⃣  Image size:"
echo "─────────────────────────────────────────────────────────"
docker images smartlib-app:cpu-latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# Verify contents
echo "6️⃣  Verifying image contents..."
echo "─────────────────────────────────────────────────────────"

echo "Checking modules/ directory:"
docker run --rm --entrypoint ls smartlib-app:cpu-latest -la /app/modules/ | head -5

echo ""
echo "Checking main files:"
docker run --rm --entrypoint ls smartlib-app:cpu-latest -la /app/*.py | head -5

echo ""
echo "Checking Flask installation:"
docker run --rm --entrypoint pip smartlib-app:cpu-latest list | grep -i flask

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    BUILD COMPLETE                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  ./test-local-fixed.sh"
echo ""
