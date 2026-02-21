#!/bin/bash
# SmartLib Basic - Local Development Runner
# This script runs the application locally using Uvicorn with auto-reload

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

# Ensure pip is installed
if ! $VENV_PYTHON -m pip --version &> /dev/null; then
    echo -e "${YELLOW}Installing pip into virtual environment...${NC}"
    $VENV_PYTHON -m ensurepip --upgrade
fi

# Check if uvicorn and a2wsgi are installed, if not, install them
if ! $VENV_PYTHON -c "import uvicorn" &> /dev/null || ! $VENV_PYTHON -c "import a2wsgi" &> /dev/null; then
    echo -e "${YELLOW}Installing uvicorn and a2wsgi...${NC}"
    $VENV_PYTHON -m pip install uvicorn a2wsgi
fi

echo -e "${GREEN}Starting Uvicorn with auto-reload on port 8000...${NC}"
$VENV_PYTHON -m uvicorn asgi:asgi_app --reload --port 8000
