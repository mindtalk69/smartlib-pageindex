#!/bin/bash
# Script to package Basic Edition ARM templates for Azure Marketplace
# This avoids macOS metadata files that cause validation errors

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "Azure Marketplace Package Creator"
echo "BASIC EDITION (SQLite + ChromaDB)"
echo "========================================"

# Define the output filename
OUTPUT_ZIP="smartlib-basic-arm-template.zip"

# Remove old package if it exists
if [ -f "$OUTPUT_ZIP" ]; then
    echo "Removing old package: $OUTPUT_ZIP"
    rm "$OUTPUT_ZIP"
fi

# Create the ZIP archive
# -r: recursive
# -X: exclude extended attributes (._* files)
# -x: exclude patterns
echo "Creating package: $OUTPUT_ZIP"
zip -r -X "$OUTPUT_ZIP" \
    createUiDefinition.json \
    mainTemplate.json \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "*.backup*" \
    -x "*.md" \
    -x "*_enterprise.json" \
    -x "identityStep_updated.json"

# Verify the contents
echo ""
echo "Package contents:"
unzip -l "$OUTPUT_ZIP"

echo ""
echo -e "${GREEN}✓ Package created successfully: $OUTPUT_ZIP${NC}"
echo ""
echo -e "${BLUE}Edition: BASIC${NC}"
echo "  - Vector Store: ChromaDB"
echo "  - Database: SQLite"
echo "  - Build includes: ChromaDB HNSW compilation"
echo ""
echo "Next steps:"
echo "1. Upload $OUTPUT_ZIP to Azure Marketplace Partner Center"
echo "2. The package contains only the required files:"
echo "   - createUiDefinition.json"
echo "   - mainTemplate.json"
echo ""
