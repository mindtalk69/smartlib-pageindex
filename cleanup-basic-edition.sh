#!/bin/bash
# cleanup-basic-edition.sh
# Removes Enterprise/PGVector/ChromaDB files and dependencies for BASIC-only edition with sqlite-vec

set -euo pipefail

echo "=============================================="
echo "SmartLib BASIC Edition Cleanup Script"
echo "Removing Enterprise/PGVector/ChromaDB files"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for removed files
REMOVED=0

# Function to remove file if exists
remove_file() {
    if [ -f "$1" ]; then
        echo -e "${YELLOW}Removing:${NC} $1"
        rm -f "$1"
        REMOVED=$((REMOVED + 1))
    fi
}

# Function to remove directory if exists
remove_dir() {
    if [ -d "$1" ]; then
        echo -e "${YELLOW}Removing directory:${NC} $1"
        rm -rf "$1"
        REMOVED=$((REMOVED + 1))
    fi
}

echo "=== Removing Enterprise-specific requirement files ==="
remove_file "requirements-web-enterprise.txt"
remove_file "requirements-worker-enterprise.txt"

echo ""
echo "=== Removing Enterprise Docker files ==="
remove_file "docker-compose.enterprise.yaml"
remove_file "Dockerfile.web.enterprise"
remove_file "Dockerfile.worker.enterprise"

echo ""
echo "=== Removing Azure/Enterprise build scripts ==="
remove_file "build-for-azure-enterprise.sh"
remove_file "enable-pgvector.sh"
remove_file "scripts/init-pgvector.sql"

echo ""
echo "=== Removing Enterprise ARM templates ==="
remove_file "ARMtemplate/catalog/mainTemplate_enterprise.json"
remove_file "ARMtemplate/catalog/createUiDefinition_enterprise.json"
remove_file "ARMtemplate/catalog/package-for-azure-enterprise.sh"
remove_file "ARMtemplate/docs/SHARED_PLAN_GUIDE.md"
remove_file "ARMtemplate/docs/redis_and_celery_deployment.md"

echo ""
echo "=== Removing Enterprise documentation ==="
remove_file "ENTERPRISE_TIER_PLAN.md"
remove_file "TESTING_EDITIONS.md"

echo ""
echo "=== Removing PGVector module ==="
remove_file "modules/pgvector_utils.py"

echo ""
echo "=== Removing old/legacy files ==="
remove_file "config.py''"
remove_file "docker-entrypoint-old.sh"
remove_file "env.dev.old"
remove_file "AGENTS.md.old"
remove_file "AGENTS-1.md.old"

echo ""
echo "=== Cleaning up ARM template docs (keeping BASIC only) ==="
remove_dir "ARMtemplate/docs"

echo ""
echo "=== Updating requirements files ==="
# Verify requirements files have been updated
if grep -q "chromadb" requirements-web.txt 2>/dev/null; then
    echo -e "${RED}WARNING:${NC} requirements-web.txt still contains chromadb references"
fi
if grep -q "pgvector" requirements-web.txt 2>/dev/null; then
    echo -e "${RED}WARNING:${NC} requirements-web.txt still contains pgvector references"
fi

echo ""
echo "=== Removing .gitignore entries for Enterprise files ==="
# Remove .gitignore entries for enterprise files if present
if [ -f ".gitignore" ]; then
    sed -i '/enterprise/d' .gitignore 2>/dev/null || true
    sed -i '/pgvector/d' .gitignore 2>/dev/null || true
    sed -i '/chromadb/d' .gitignore 2>/dev/null || true
fi

echo ""
echo "=============================================="
echo -e "${GREEN}Cleanup Complete!${NC}"
echo "Removed $REMOVED files/directories"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit cleanup: git add -A && git commit -m 'cleanup: remove enterprise files for BASIC edition'"
echo "3. Rebuild Docker: docker compose up --build"
echo ""
echo "Files kept for BASIC edition:"
echo "  - requirements-web.txt (sqlite-vec, no chromadb/pgvector)"
echo "  - requirements-worker.txt (CPU torch, Qwen3-Embedding-0.6B)"
echo "  - docker-compose.yaml (web, worker, redis)"
echo "  - modules/vector_store_utils.py (sqlite-vec)"
echo ""
