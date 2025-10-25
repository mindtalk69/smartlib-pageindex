#!/bin/bash

# =============================================================================
# Build and Test Script for CPU-Optimized RAG Application
# =============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
IMAGE_NAME="smarthing-app:cpu-rag-minimal"
CONTAINER_NAME="smarthing-rag-test"

# =============================================================================
# BUILD PROCESS
# =============================================================================

log_info "Building CPU-optimized RAG Docker image..."
log_warn "This may take 10-15 minutes for first build..."

# Build the image
docker build -f Dockerfile.cpu -t "$IMAGE_NAME" .

# Check build success
if [ $? -eq 0 ]; then
    log_info "✅ Build successful!"
else
    log_error "❌ Build failed!"
    exit 1
fi

# =============================================================================
# IMAGE SIZE ANALYSIS
# =============================================================================

log_info "Analyzing image size..."
IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format "table {{.Size}}" | tail -n 1)
log_info "Image size: $IMAGE_SIZE"

# Convert to GB for comparison
SIZE_MB=$(docker images "$IMAGE_NAME" --format "{{.Size}}" | tail -n 1 | sed 's/MB//')
if [[ $SIZE_MB =~ ^[0-9]+$ ]]; then
    SIZE_GB=$(echo "scale=2; $SIZE_MB / 1024" | bc)
    log_info "Image size: ${SIZE_GB}GB"
    
    if (( $(echo "$SIZE_GB < 3.0" | bc -l) )); then
        log_info "✅ Good! Under 3GB target"
    else
        log_warn "⚠️  Image is larger than expected (>3GB)"
    fi
fi

# =============================================================================
# LOCAL TESTING
# =============================================================================

log_info "Starting local testing..."

# Stop and remove existing container if running
if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    log_warn "Removing existing container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Run container with local environment
log_info "Starting container with local environment..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p 8000:8000 \
    --env-file .env \
    -v "$(pwd)/data:/app/data" \
    "$IMAGE_NAME"

# Wait for container to start
log_info "Waiting for application to start..."
sleep 10

# Check if container is running
if docker ps --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    log_info "✅ Container is running!"
else
    log_error "❌ Container failed to start!"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

# =============================================================================
# HEALTH CHECK
# =============================================================================

log_info "Performing health check..."

# Wait a bit more for full startup
sleep 5

# Test health endpoint
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    log_info "✅ Health check passed!"
else
    log_warn "⚠️  Health check failed, checking logs..."
    docker logs "$CONTAINER_NAME" --tail 20
fi

# =============================================================================
# RESULTS
# =============================================================================

log_info "=================================================================="
log_info "🎉 BUILD AND TEST COMPLETE!"
log_info "=================================================================="
log_info "Image: $IMAGE_NAME"
log_info "Size: $IMAGE_SIZE"
log_info "Container: $CONTAINER_NAME"
log_info "URL: http://localhost:8000"
log_info ""
log_info "Commands:"
log_info "  View logs: docker logs -f $CONTAINER_NAME"
log_info "  Stop: docker stop $CONTAINER_NAME"
log_info "  Shell access: docker exec -it $CONTAINER_NAME bash"
log_info ""
log_info "Test your RAG functionality by accessing:"
log_info "  - http://localhost:8000 (main app)"
log_info "  - http://localhost:8000/health (health check)"
log_info "=================================================================="

# Show container logs for verification
log_info "Recent container logs:"
docker logs "$CONTAINER_NAME" --tail 10
