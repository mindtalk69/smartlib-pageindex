#!/bin/bash

# Check what went wrong with crashed container
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Why Did My Container Crash?                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Find the last exited container
CONTAINER=$(docker ps -a --filter "name=smartlib-test" --format "{{.ID}}" | head -1)

if [ -z "$CONTAINER" ]; then
    # Try to find by image name
    CONTAINER=$(docker ps -a --filter "ancestor=smartlib-app:cpu-latest" --format "{{.ID}}" | head -1)
fi

if [ -z "$CONTAINER" ]; then
    echo "❌ No smartlib-test container found"
    echo ""
    echo "Recent containers:"
    docker ps -a | head -5
    exit 1
fi

echo "Found container: $CONTAINER"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                      EXIT CODE                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
EXIT_CODE=$(docker inspect $CONTAINER --format='{{.State.ExitCode}}')
echo "Exit code: $EXIT_CODE"
echo ""

case $EXIT_CODE in
    0)
        echo "Container exited normally (0)"
        ;;
    1)
        echo "❌ Application error (1)"
        echo "Usually: Python exception, missing file, or startup error"
        ;;
    126)
        echo "❌ Permission denied (126)"
        echo "Usually: Script not executable"
        ;;
    127)
        echo "❌ Command not found (127)"
        echo "Usually: Missing binary or wrong path"
        ;;
    137)
        echo "❌ Killed by SIGKILL (137)"
        echo "Usually: Out of memory"
        ;;
    139)
        echo "❌ Segmentation fault (139)"
        echo "Usually: Memory corruption"
        ;;
    *)
        echo "⚠️  Unusual exit code: $EXIT_CODE"
        ;;
esac
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    FULL LOGS                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
docker logs $CONTAINER 2>&1
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   DIAGNOSIS                               ║"
echo "╚══════════════════════════════════════════════════════════╝"

LOGS=$(docker logs $CONTAINER 2>&1)

# Check for common issues
if echo "$LOGS" | grep -qi "no such file"; then
    echo "❌ ISSUE: Missing file"
    echo ""
    MISSING=$(echo "$LOGS" | grep -i "no such file" | head -1)
    echo "Error: $MISSING"
    echo ""
    echo "Likely causes:"
    echo "1. docker-entrypoint.sh not in image"
    echo "2. App files not copied"
    echo "3. Wrong COPY paths in Dockerfile"
    echo ""
    echo "Check image contents:"
    echo "  docker run --rm smartlib-app:cpu-latest ls -la /app"
fi

if echo "$LOGS" | grep -qi "permission denied"; then
    echo "❌ ISSUE: Permission denied"
    echo ""
    echo "Likely causes:"
    echo "1. docker-entrypoint.sh not executable"
    echo "2. Missing: RUN chmod +x docker-entrypoint.sh"
    echo ""
    echo "Fix in Dockerfile.cpu:"
    echo "  RUN chmod +x docker-entrypoint.sh"
fi

if echo "$LOGS" | grep -qi "ModuleNotFoundError\|ImportError"; then
    echo "❌ ISSUE: Python module not found"
    echo ""
    MODULE=$(echo "$LOGS" | grep -i "ModuleNotFoundError\|ImportError" | head -1)
    echo "Error: $MODULE"
    echo ""
    echo "Likely causes:"
    echo "1. Missing package in requirements-cpu.txt"
    echo "2. Wrong requirements file used in build"
    echo "3. Python packages not installed"
    echo ""
    echo "Check installed packages:"
    echo "  docker run --rm smartlib-app:cpu-latest pip list"
fi

if echo "$LOGS" | grep -qi "cannot find module.*app"; then
    echo "❌ ISSUE: Cannot find app module"
    echo ""
    echo "Likely causes:"
    echo "1. App code not copied to image"
    echo "2. Wrong COPY command in Dockerfile"
    echo "3. App structure doesn't match import"
    echo ""
    echo "Expected structure:"
    echo "  /app/app/main.py"
    echo ""
    echo "Check what's in the image:"
    echo "  docker run --rm smartlib-app:cpu-latest ls -la /app"
    echo "  docker run --rm smartlib-app:cpu-latest ls -la /app/app"
fi

if echo "$LOGS" | grep -qi "uvicorn.*not found"; then
    echo "❌ ISSUE: uvicorn not found"
    echo ""
    echo "Likely causes:"
    echo "1. uvicorn not in requirements-cpu.txt"
    echo "2. Requirements not installed"
    echo ""
    echo "Should be in requirements-cpu.txt:"
    echo "  uvicorn[standard]==0.32.0"
fi

if echo "$LOGS" | grep -qi "address already in use"; then
    echo "❌ ISSUE: Port 8000 already in use"
    echo ""
    echo "Another service is using port 8000"
    echo ""
    echo "Find what's using it:"
    echo "  lsof -i :8000"
    echo "  netstat -tlnp | grep 8000"
fi

if [ -z "$LOGS" ] || [ ${#LOGS} -lt 10 ]; then
    echo "❌ ISSUE: No logs produced"
    echo ""
    echo "Container crashed before logging anything"
    echo ""
    echo "Likely causes:"
    echo "1. Entrypoint script missing"
    echo "2. Entrypoint has syntax error"
    echo "3. Wrong CMD/ENTRYPOINT in Dockerfile"
    echo ""
    echo "Check entrypoint:"
    echo "  docker inspect smartlib-app:cpu-latest | grep -A5 Entrypoint"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   QUICK CHECKS                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "1. Check if entrypoint exists in image:"
docker run --rm smartlib-app:cpu-latest ls -la /app/docker-entrypoint.sh 2>&1
echo ""

echo "2. Check if app directory exists:"
docker run --rm smartlib-app:cpu-latest ls -la /app/app 2>&1 | head -10
echo ""

echo "3. Check Python packages:"
docker run --rm smartlib-app:cpu-latest pip list 2>&1 | grep -E "fastapi|uvicorn|pydantic" || echo "❌ Key packages missing!"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   NEXT STEPS                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "1. Check your Dockerfile.cpu has these lines:"
echo "   COPY docker-entrypoint.sh ."
echo "   COPY app/ ./app/       (or COPY . .)"
echo "   RUN chmod +x docker-entrypoint.sh"
echo ""
echo "2. Verify your app structure:"
echo "   ls -la app/"
echo ""
echo "3. Rebuild with correct Dockerfile:"
echo "   ./rebuild-optimized.sh"
echo ""
echo "4. Test interactively:"
echo "   docker run --rm -it smartlib-app:cpu-latest /bin/bash"
echo ""
