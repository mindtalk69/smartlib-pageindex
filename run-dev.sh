#!/bin/bash
# SmartLib Basic - Local Development Runner
# This script runs the application locally using Gunicorn
# Matches production Docker configuration for consistency

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting SmartLib Local Development Server${NC}"

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating one...${NC}"
    python3 -m venv .venv
    echo -e "${GREEN}Virtual environment created.${NC}"
else
    echo -e "${GREEN}Virtual environment found.${NC}"
fi

# Activate virtual environment
source .venv/bin/activate

# Use the virtual environment's python directly
VENV_PYTHON="./.venv/bin/python"

# Load environment variables from .env.dev
if [ -f ".env.dev" ]; then
    echo -e "${GREEN}Loading environment from .env.dev...${NC}"
    export $(cat .env.dev | grep -v '^#' | grep -v '^$' | xargs)
fi

# Ensure pip is installed
if ! $VENV_PYTHON -m pip --version &> /dev/null; then
    echo -e "${YELLOW}Installing pip into virtual environment...${NC}"
    $VENV_PYTHON -m ensurepip --upgrade
fi

# Check if gunicorn is installed, if not, install it
if ! $VENV_PYTHON -c "import gunicorn" &> /dev/null; then
    echo -e "${YELLOW}Installing gunicorn...${NC}"
    $VENV_PYTHON -m pip install gunicorn
fi

# Use GUNICORN_TIMEOUT from env (set in .env.dev, default 300 for long-running agent tasks)
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-300}"

echo -e "${GREEN}Starting Gunicorn on port 8000 (timeout: ${GUNICORN_TIMEOUT}s)...${NC}"
echo -e "${YELLOW}Note: --reload is disabled to avoid interrupting SSE streaming connections.${NC}"
echo -e "${YELLOW}      Restart this script manually when you change Python files.${NC}"

$VENV_PYTHON -m gunicorn app:app \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --timeout "$GUNICORN_TIMEOUT"
