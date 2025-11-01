#!/bin/bash

# Image Size Diagnostic Tool
set -e

IMAGE_NAME="smartlib-app:cpu-latest"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Docker Image Size Diagnostic Tool                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if image exists
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "❌ Image $IMAGE_NAME not found!"
    exit 1
fi

# 1. Current image size
echo "1️⃣  Current Image Size"
echo "─────────────────────────────────────────────────────────"
docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# 2. Layer analysis
echo "2️⃣  Layer Analysis (largest to smallest)"
echo "─────────────────────────────────────────────────────────"
docker history "$IMAGE_NAME" --no-trunc --format "table {{.Size}}\t{{.CreatedBy}}" | head -20
echo ""

# 3. Find large files inside the image
echo "3️⃣  Largest Files in Image (>10MB)"
echo "─────────────────────────────────────────────────────────"
docker run --rm "$IMAGE_NAME" find / -type f -size +10M -exec du -h {} + 2>/dev/null | sort -rh | head -20 || echo "Could not analyze files"
echo ""

# 4. Disk usage by directory
echo "4️⃣  Disk Usage by Directory"
echo "─────────────────────────────────────────────────────────"
docker run --rm "$IMAGE_NAME" du -sh /* 2>/dev/null | sort -rh | head -15 || echo "Could not analyze directories"
echo ""

# 5. Python packages size
echo "5️⃣  Python Packages Size"
echo "─────────────────────────────────────────────────────────"
docker run --rm "$IMAGE_NAME" du -sh /root/.local/lib/python*/site-packages/* 2>/dev/null | sort -rh | head -10 || \
docker run --rm "$IMAGE_NAME" du -sh /usr/local/lib/python*/site-packages/* 2>/dev/null | sort -rh | head -10 || \
echo "Could not find Python packages"
echo ""

# 6. Check Dockerfile
echo "6️⃣  Checking Dockerfile"
echo "─────────────────────────────────────────────────────────"
if [ -f "Dockerfile.cpu" ]; then
    echo "✅ Dockerfile.cpu exists"
    
    # Check if it's multi-stage
    if grep -q "FROM.*as builder" Dockerfile.cpu; then
        echo "✅ Multi-stage build detected"
    else
        echo "⚠️  WARNING: Not using multi-stage build!"
    fi
    
    # Check base image
    if grep -q "python:.*-slim" Dockerfile.cpu; then
        echo "✅ Using slim base image"
    else
        echo "⚠️  WARNING: Not using slim base image!"
    fi
else
    echo "❌ Dockerfile.cpu not found!"
fi
echo ""

# 7. Check .dockerignore
echo "7️⃣  Checking .dockerignore"
echo "─────────────────────────────────────────────────────────"
if [ -f ".dockerignore" ]; then
    echo "✅ .dockerignore exists"
    echo "Contents:"
    head -10 .dockerignore
else
    echo "❌ .dockerignore not found!"
    echo "This could be adding extra ~1-2GB!"
fi
echo ""

# 8. Build context size
echo "8️⃣  Build Context Size"
echo "─────────────────────────────────────────────────────────"
echo "Checking current directory size..."
du -sh . 2>/dev/null || echo "Could not check"
echo ""
echo "Large files in build context (>50MB):"
find . -type f -size +50M 2>/dev/null | head -10 || echo "None found"
echo ""

# 9. Recommendations
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    DIAGNOSIS RESULTS                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
echo "Current size: $IMAGE_SIZE (Target: <2GB)"
echo ""

# Check for common issues
echo "Common Issues to Check:"
echo ""

echo "1. Are you using Dockerfile.cpu?"
echo "   Build with: docker build -f Dockerfile.cpu -t smartlib-app:cpu-latest ."
echo ""

echo "2. Do you have large files in your directory?"
echo "   Check 'Large files in build context' section above"
echo "   Add them to .dockerignore"
echo ""

echo "3. Are you including data/models in the image?"
echo "   Data files should be mounted or downloaded at runtime"
echo "   Add to .dockerignore: *.csv, *.xlsx, *.bin, *.pt, *.pth"
echo ""

echo "4. Check if CUDA packages are being installed:"
docker run --rm "$IMAGE_NAME" pip list 2>/dev/null | grep -i "torch\|cuda\|cudnn" || echo "   ✅ No CUDA packages found"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                     QUICK FIXES                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "# 1. Ensure using optimized Dockerfile"
echo "docker build -f Dockerfile.cpu -t smartlib-app:cpu-latest ."
echo ""
echo "# 2. Clean up and rebuild"
echo "docker system prune -a --volumes -f"
echo "docker build -f Dockerfile.cpu -t smartlib-app:cpu-latest ."
echo ""
echo "# 3. Check what's being copied"
echo "cat .dockerignore"
echo ""
