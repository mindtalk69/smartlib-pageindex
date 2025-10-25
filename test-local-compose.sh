#!/bin/bash

# Test script for local Docker Compose development
set -e

echo "🧪 Testing FlaskRAG with Docker Compose (Local Development)"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is running
echo "Checking Docker..."
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running or not accessible"
    exit 1
fi
print_status "Docker is running"

# Build the split architecture images if they don't exist
echo ""
echo "Checking Docker images..."
WEB_IMAGE="smarthing-app:web-ultralight"
WORKER_IMAGE="smarthing-app:worker-optimized"

if ! docker image inspect "$WEB_IMAGE" >/dev/null 2>&1 || ! docker image inspect "$WORKER_IMAGE" >/dev/null 2>&1; then
    print_warning "Split architecture images not found. Building images..."
    if [ -f "rebuild-micro.sh" ]; then
        ./rebuild-micro.sh
    else
        print_error "rebuild-micro.sh not found. Please run: chmod +x rebuild-micro.sh && ./rebuild-micro.sh"
        exit 1
    fi
fi
print_status "Split architecture images ready"

# Set environment variables for local development
export LOCAL_MODE=true
export CELERY_BROKER_URL=redis://redis:6379/0
export CELERY_RESULT_BACKEND=redis://redis:6379/0
export DEFAULT_EMBEDDING_MODEL=all-MiniLM-L6-v2
export VECTOR_STORE_PROVIDER=chromadb

echo ""
echo "🛑 Stopping any existing services..."
docker compose down || true

echo ""
echo "🏗️  Starting services with Docker Compose..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "🔍 Checking service status:"
echo "Redis status:"
if docker ps | grep -q redis; then
    print_status "Redis container is running"
    # Test Redis connection
    if docker exec $(docker ps -q --filter ancestor=redis:7-alpine) redis-cli ping | grep -q PONG; then
        print_status "Redis is responding to ping"
    else
        print_warning "Redis ping test failed"
    fi
else
    print_error "Redis container not found"
fi

echo "Web app status:"
if docker ps | grep -q flaskrag3-web; then
    print_status "Web app container is running"
else
    print_error "Web app container not found"
fi

echo "Worker status:"
if docker ps | grep -q flaskrag3-worker; then
    print_status "Worker container is running"
else
    print_error "Worker container not found"
fi

echo ""
echo "📋 Container logs:"

echo "Web app logs:"
docker logs flaskrag3-web-1 2>/dev/null | tail -10 || echo "No web app logs available"

echo ""
echo "Worker logs:"
docker logs flaskrag3-worker-1 2>/dev/null | tail -10 || echo "No worker logs available"

echo ""
echo "🔗 Testing web application..."
sleep 3

if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    print_status "Web app health check passed"
else
    print_warning "Web app health check failed - app may still be starting"
fi

echo ""
echo "🎯 Manual testing instructions:"
echo "• Open browser to: http://localhost:8000"
echo "• Login with admin/admin"
echo "• Upload a document to test RAG functionality"
echo "• Check worker processes the upload in background"
echo "• Verify embedding model 'all-MiniLM-L6-v2' is selected"

echo ""
echo "🔧 Development commands:"
echo "• View web logs:     docker logs -f flaskrag3-web-1"
echo "• View worker logs:  docker logs -f flaskrag3-worker-1"
echo "• Stop services:     docker compose down"
echo "• Restart services:  docker compose restart"
echo "• Shell access:      docker exec -it flaskrag3-web-1 /bin/bash"

echo ""
echo "📊 Service URLs:"
echo "• Web Application:   http://localhost:8000"
echo "• Redis Admin:       redis://localhost:6379"
echo "• Database:          sqlite:///data/app.db (inside containers)"

echo ""
echo "✅ Local Docker development setup complete!"
echo "   Ready for Azure deployment testing."
