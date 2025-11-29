#!/bin/bash
# Build and push Docker images for SmartLib Basic Edition to Azure Container Registry

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================"
echo "SmartLib Basic Edition - Azure Build"
echo "========================================"
echo ""

# Check for ACR name argument
if [ -z "$1" ]; then
    echo -e "${RED}Error: ACR name required${NC}"
    echo "Usage: $0 <acr-name> [tag]"
    echo "Example: $0 myregistry latest"
    exit 1
fi

ACR_NAME=$1
TAG=${2:-latest}
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

echo -e "${BLUE}Configuration:${NC}"
echo "  ACR: $ACR_NAME"
echo "  Tag: $TAG"
echo "  Edition: BASIC (SQLite + ChromaDB)"
echo ""

# Check if logged in to ACR
echo "1️⃣  Checking ACR authentication..."
if ! az acr login --name "$ACR_NAME" 2>/dev/null; then
    echo -e "${RED}Failed to login to ACR${NC}"
    echo "Please run: az login"
    exit 1
fi
echo -e "${GREEN}✓ ACR authentication successful${NC}"
echo ""

# Build web container
echo "2️⃣  Building web container (Basic edition)..."
echo "   Note: This includes ChromaDB HNSW compilation (slower build)"
echo ""
DOCKER_BUILDKIT=1 docker build \
    -f Dockerfile.web \
    -t "${ACR_LOGIN_SERVER}/smartlib-web-basic:${TAG}" \
    --progress=plain \
    .

echo ""
echo -e "${GREEN}✓ Web container built${NC}"
echo ""

# Build worker container
echo "3️⃣  Building worker container (Basic edition)..."
echo "   Note: This includes ChromaDB HNSW compilation (slower build)"
echo ""
DOCKER_BUILDKIT=1 docker build \
    -f Dockerfile.worker \
    -t "${ACR_LOGIN_SERVER}/smartlib-worker-basic:${TAG}" \
    --progress=plain \
    .

echo ""
echo -e "${GREEN}✓ Worker container built${NC}"
echo ""

# Push images
echo "4️⃣  Pushing images to ACR..."
echo ""
docker push "${ACR_LOGIN_SERVER}/smartlib-web-basic:${TAG}"
echo ""
docker push "${ACR_LOGIN_SERVER}/smartlib-worker-basic:${TAG}"

echo ""
echo -e "${GREEN}✓ Images pushed to ACR${NC}"
echo ""

# Display image information
echo "5️⃣  Image information:"
echo "─────────────────────────────────────────────────────────"
docker images "${ACR_LOGIN_SERVER}/smartlib-web" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
docker images "${ACR_LOGIN_SERVER}/smartlib-worker" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# Verify in ACR
echo "6️⃣  Verifying images in ACR..."
echo ""
az acr repository show-tags --name "$ACR_NAME" --repository smartlib-web --output table
echo ""
az acr repository show-tags --name "$ACR_NAME" --repository smartlib-worker --output table

echo ""
echo "========================================"
echo -e "${GREEN}✓ BUILD COMPLETE${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}Images pushed:${NC}"
echo "  Web:    ${ACR_LOGIN_SERVER}/smartlib-web-basic:${TAG}"
echo "  Worker: ${ACR_LOGIN_SERVER}/smartlib-worker-basic:${TAG}"
echo ""
echo "Next steps:"
echo "  1. Update ARM template (mainTemplate.json) parameters:"
echo "     - webDockerImageName: smartlib-web-basic:${TAG}"
echo "     - workerDockerImageName: smartlib-worker-basic:${TAG}"
echo "  2. Package ARM template: cd ARMtemplate/catalog && ./package-for-azure-basic.sh"
echo "  3. Deploy to Azure"
echo ""
