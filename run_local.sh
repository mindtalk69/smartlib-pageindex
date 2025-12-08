#!/bin/bash

# SmartLib Local Development Runner (Web Only)
# This script runs the Flask web server without Docker for quick HTML/CSS testing

echo "🚀 Starting SmartLib Web Server (No Docker)"
echo "============================================"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source .venv/bin/activate

# Check if requirements are installed
if ! pip show flask > /dev/null 2>&1; then
    echo "📚 Installing dependencies (this may take a few minutes)..."
    pip install -r requirements-web.txt
fi

# Set environment variables
export FLASK_APP=app.py
export FLASK_ENV=development
export FLASK_DEBUG=1

# Load environment variables from .env.dev if it exists
if [ -f ".env.dev" ]; then
    echo "📝 Loading environment from .env.dev..."
    export $(cat .env.dev | grep -v '^#' | xargs)
elif [ -f ".env.dev.txt" ]; then
    echo "📝 Loading environment from .env.dev.txt..."
    export $(cat .env.dev.txt | grep -v '^#' | xargs)
fi

# Run database migrations (skip if fails - might not have DB yet)
echo "🗄️  Running database migrations..."
flask db upgrade 2>/dev/null || echo "⚠️  Skipping migrations (run manually if needed)"

echo ""
echo "✅ Server starting at http://127.0.0.1:5000"
echo "📝 Press Ctrl+C to stop"
echo ""

# Run Flask development server
flask run --debug --host=127.0.0.1 --port=5000
