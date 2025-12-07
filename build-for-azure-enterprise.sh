#!/bin/bash
# Build and push Docker images for SmartLib Enterprise Edition to Azure Container Registry

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================"
echo "SmartLib Enterprise Edition - Azure Build"
echo "========================================"
echo ""

# Check for ACR name argument
if [ -z "$1" ]; then
    echo -e "${RED}Error: ACR name required${NC}"
    echo "Usage: $0 <acr-name> [tag] [--no-cache]"
    echo "Example: $0 myregistry latest"
    echo "Example: $0 myregistry v3.2 --no-cache"
    exit 1
fi

ACR_NAME=$1
TAG=${2:-latest}
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

# Check for --no-cache flag
NO_CACHE_FLAG=""
if [ "$3" = "--no-cache" ]; then
    NO_CACHE_FLAG="--no-cache"
    echo -e "${YELLOW}⚠️  Building with --no-cache (slower but ensures fresh code)${NC}"
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  ACR: $ACR_NAME"
echo "  Tag: $TAG"
echo "  No-cache: ${NO_CACHE_FLAG:-disabled}"
echo "  Edition: ENTERPRISE (PostgreSQL + pgvector)"
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
echo "2️⃣  Building web container (Enterprise edition)..."
echo "   Note: No ChromaDB (faster build ~40% time savings)"
echo ""
DOCKER_BUILDKIT=1 docker build \
    ${NO_CACHE_FLAG} \
    -f Dockerfile.web.enterprise \
    -t "${ACR_LOGIN_SERVER}/smartlib-web-enterprise:${TAG}" \
    --progress=plain \
    .

echo ""
echo -e "${GREEN}✓ Web container built${NC}"
echo ""

# Build worker container
echo "3️⃣  Building worker container (Enterprise edition)..."
echo "   Note: No ChromaDB (faster build ~40% time savings)"
echo ""
DOCKER_BUILDKIT=1 docker build \
    ${NO_CACHE_FLAG} \
    -f Dockerfile.worker.enterprise \
    -t "${ACR_LOGIN_SERVER}/smartlib-worker-enterprise:${TAG}" \
    --progress=plain \
    .

echo ""
echo -e "${GREEN}✓ Worker container built${NC}"
echo ""

# Push images
echo "4️⃣  Pushing images to ACR..."
echo ""
docker push "${ACR_LOGIN_SERVER}/smartlib-web-enterprise:${TAG}"
echo ""
docker push "${ACR_LOGIN_SERVER}/smartlib-worker-enterprise:${TAG}"

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
echo "  Web:    ${ACR_LOGIN_SERVER}/smartlib-web-enterprise:${TAG}"
echo "  Worker: ${ACR_LOGIN_SERVER}/smartlib-worker-enterprise:${TAG}"
echo ""
echo -e "${YELLOW}Note: Enterprise images are ~100MB smaller due to no ChromaDB${NC}"
echo ""
echo "Next steps:"
echo "  1. Update ARM template (mainTemplate_enterprise.json) parameters:"
echo "     - webDockerImageName: smartlib-web-enterprise:${TAG}"
echo "     - workerDockerImageName: smartlib-worker-enterprise:${TAG}"
echo "  2. Package ARM template: cd ARMtemplate/catalog && ./package-for-azure-enterprise.sh"
echo "  3. Deploy to Azure"
echo ""
