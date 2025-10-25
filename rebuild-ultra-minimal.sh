#!/bin/bash

# Ultra-minimal rebuild for Azure B1 deployment
set -e

REQUIREMENTS_FILE="requirements-cpu-ultra-minimal.txt"
DOCKERFILE="Dockerfile.cpu.ultra-minimal"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Building Ultra-Minimal Docker Image for Azure B1      ║"
echo "║              Target: ~500MB-800MB                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Add ultra-minimal requirements notice
echo "📦 Using: $REQUIREMENTS_FILE"
echo "🏗️  Dockerfile: $DOCKERFILE"
echo "🎯 Target size: <800MB (vs 6GB+ original)"
echo ""

# Verify files exist
if [ ! -f "$REQUIREMENTS_FILE" ]; then
    echo "❌ $REQUIREMENTS_FILE not found!"
    echo "Available requirements:"
    ls requirements-*.txt
    exit 1
fi

if [ ! -f "$DOCKERFILE" ]; then
    echo "❌ $DOCKERFILE not found!"
    echo "Available Dockerfiles:"
    ls Dockerfile*
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old images..."
docker rmi smarthing-app:ultra-minimal smarthing-app:cpu-latest 2>/dev/null || true
docker system prune -f || true

# Build optimized image
echo "🏗️  Building ultra-minimal image..."
DOCKER_BUILDKIT=1 docker build \
    -f "$DOCKERFILE" \
    -t smarthing-app:ultra-minimal \
    --progress=plain \
    .

echo ""

# Analyze size
echo "📊 Image Analysis:"
echo "─────────────────────────────────────────────────────────"
docker images smarthing-app:ultra-minimal --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

SIZE=$(docker images smarthing-app:ultra-minimal --format "{{.Size}}")
echo ""
echo "🎯 Target for Azure B1: <800MB"
echo "📏 Current size: $SIZE"

# Tag as cpu-latest for deployment
docker tag smarthing-app:ultra-minimal smarthing-app:cpu-latest

echo ""
echo "✅ Ultra-minimal build complete!"
echo ""
echo "🔍 Key optimizations:"
echo "   - Alpine Linux base (~100MB smaller than slim)"
echo "   - CPU-only PyTorch (no CUDA libraries)"
echo "   - Minimal dependencies only"
echo "   - Single-stage build for simplicity"
echo ""
echo "To deploy to Azure:"
echo "az acr login --name <your-registry>"
echo "docker tag smarthing-app:cpu-latest <registry>.azurecr.io/smarthing-app:cpu-latest"
echo "docker push <registry>.azurecr.io/smarthing-app:cpu-latest"
