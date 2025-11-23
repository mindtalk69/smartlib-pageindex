#!/bin/bash
# Script to package ARM templates for Azure Marketplace
# This avoids macOS metadata files that cause validation errors

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================"
echo "Azure Marketplace Package Creator"
echo "========================================"

# Define the output filename
OUTPUT_ZIP="smartlib-arm-template.zip"

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
    -x "identityStep_updated.json"

# Verify the contents
echo ""
echo "Package contents:"
unzip -l "$OUTPUT_ZIP"

echo ""
echo -e "${GREEN}✓ Package created successfully: $OUTPUT_ZIP${NC}"
echo ""
echo "Next steps:"
echo "1. Upload $OUTPUT_ZIP to Azure Marketplace Partner Center"
echo "2. The package contains only the required files:"
echo "   - createUiDefinition.json"
echo "   - mainTemplate.json"
echo ""