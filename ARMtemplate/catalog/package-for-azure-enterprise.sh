#!/bin/bash
# Script to package Enterprise Edition ARM templates for Azure Marketplace
# This avoids macOS metadata files that cause validation errors

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "Azure Marketplace Package Creator"
echo "ENTERPRISE EDITION (PostgreSQL + pgvector)"
echo "========================================"

# Define the output filename
OUTPUT_ZIP="smartlib-enterprise-arm-template.zip"

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
    createUiDefinition_enterprise.json \
    mainTemplate_enterprise.json \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "*.backup*" \
    -x "*.md" \
    -x "createUiDefinition.json" \
    -x "mainTemplate.json" \
    -x "identityStep_updated.json"

# Rename files in the ZIP to match Azure's expected names
echo "Renaming files in archive..."
# Create temp directory
TEMP_DIR=$(mktemp -d)
unzip -q "$OUTPUT_ZIP" -d "$TEMP_DIR"
rm "$OUTPUT_ZIP"

# Rename files
mv "$TEMP_DIR/createUiDefinition_enterprise.json" "$TEMP_DIR/createUiDefinition.json"
mv "$TEMP_DIR/mainTemplate_enterprise.json" "$TEMP_DIR/mainTemplate.json"

# Re-create ZIP with renamed files
cd "$TEMP_DIR"
zip -r -X "../$OUTPUT_ZIP" \
    createUiDefinition.json \
    mainTemplate.json
cd -

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Verify the contents
echo ""
echo "Package contents:"
unzip -l "$OUTPUT_ZIP"

echo ""
echo -e "${GREEN}✓ Package created successfully: $OUTPUT_ZIP${NC}"
echo ""
echo -e "${BLUE}Edition: ENTERPRISE${NC}"
echo "  - Vector Store: pgvector (PostgreSQL extension)"
echo "  - Database: PostgreSQL"
echo "  - Build excludes: ChromaDB (faster build time)"
echo ""
echo "Next steps:"
echo "1. Upload $OUTPUT_ZIP to Azure Marketplace Partner Center"
echo "2. The package contains only the required files:"
echo "   - createUiDefinition.json (from createUiDefinition_enterprise.json)"
echo "   - mainTemplate.json (from mainTemplate_enterprise.json)"
echo ""
