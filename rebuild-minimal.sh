#!/bin/bash

# Rebuild with MINIMAL requirements for Azure B1 deployment
set -e

REQUIREMENTS_FILE="requirements-cpu-minimal.txt"
DOCKERFILE="Dockerfile.cpu"

if [ "$1" = "rag" ]; then
    REQUIREMENTS_FILE="requirements-cpu-rag-minimal.txt"
    echo "Building with RAG minimal requirements (~2GB target)"
else
    echo "Building with ultra-minimal requirements (~1GB target)"
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      Building Minimal Docker Image for Azure B1         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Add minimal requirements notice
echo "📦 Using: $REQUIREMENTS_FILE"
echo "🏗️  Dockerfile: $DOCKERFILE"
echo ""

# Verify files exist
if [ ! -f "$REQUIREMENTS_FILE" ]; then
    echo "❌ $REQUIREMENTS_FILE not found!"
    echo "Available requirements:"
    ls requirements-*.txt
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old images..."
docker rmi smarthing-app:cpu-latest smarthing-app:minimal 2>/dev/null || true
docker system prune -f || true

# Build optimized image
echo "🏗️  Building minimal image..."
DOCKER_BUILDKIT=1 docker build \
    -f "$DOCKERFILE" \
    -t smarthing-app:minimal \
    --build-arg REQUIREMENTS_FILE="$REQUIREMENTS_FILE" \
    --target runtime \
    --progress=plain \
    .

echo ""

# Analyze size
echo "📊 Image Analysis:"
echo "─────────────────────────────────────────────────────────"
docker images smarthing-app:minimal --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

SIZE=$(docker images smarthing-app:minimal --format "{{.Size}}")
echo ""
echo "🎯 Target for Azure B1: <1.5GB"
echo "📏 Current size: $SIZE"

# Tag as cpu-latest for deployment
docker tag smarthing-app:minimal smarthing-app:cpu-latest

echo ""
echo "✅ Build complete!"
echo ""
echo "To deploy to Azure:"
echo "az acr login --name <your-registry>"
echo "docker tag smarthing-app:cpu-latest <registry>.azurecr.io/smarthing-app:cpu-latest"
echo "docker push <registry>.azurecr.io/smarthing-app:cpu-latest"
