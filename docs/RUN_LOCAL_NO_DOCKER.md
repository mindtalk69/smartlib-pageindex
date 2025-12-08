# Running SmartLib Locally Without Docker

This guide helps you run SmartLib's Flask web server directly on your machine without Docker - perfect for quick HTML/CSS testing on an 8GB RAM machine.

## Quick Start

### Option 1: One-Line Start (Recommended)

```bash
./run_local.sh
```

This script will:
- ✅ Create a virtual environment if needed
- ✅ Install dependencies
- ✅ Set up environment variables
- ✅ Run database migrations
- ✅ Start Flask development server at http://127.0.0.1:5000

### Option 2: Manual Steps

If you prefer to run commands manually:

```bash
# 1. Activate virtual environment
source .venv/bin/activate

# 2. Install web dependencies only
pip install -r requirements-web.txt

# 3. Copy environment configuration
cp env.local.example .env.dev

# 4. Export Flask app
export FLASK_APP=app.py

# 5. Run migrations (one-time setup)
flask db upgrade

# 6. Start server
flask run --debug --host=127.0.0.1 --port=5000
```

## Access Your Application

Open your browser and navigate to:
- **Web Interface:** http://127.0.0.1:5000
- **Alternative:** http://localhost:5000

## For HTML/CSS Testing

When working on templates and styles:

1. **Templates:** Edit files in `templates/`
2. **CSS:** Edit files in `static/css/`
3. **JavaScript:** Edit files in `static/js/`

Changes will auto-reload with `--debug` flag enabled!

## Minimal Resource Usage

This setup uses:
- ✅ SQLite instead of PostgreSQL (lighter)
- ✅ No Redis/Celery worker (background tasks disabled)
- ✅ No Docker overhead
- ✅ Single Flask process

**Estimated RAM:** ~500MB - 1GB (much less than Docker!)

## Troubleshooting

### Issue: Port already in use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use a different port
flask run --debug --port=8080
```

### Issue: Database errors
```bash
# Reset database
rm -rf data/smartlib.db
flask db upgrade
```

### Issue: Missing dependencies
```bash
# Reinstall dependencies
pip install -r requirements-web.txt --force-reinstall
```

### Issue: Redis connection errors
If you see Redis errors but don't need background tasks:
- Ignore them - the web interface will still work
- Just don't try to upload documents (requires Celery worker)

## What Works Without Docker

✅ **Works:**
- View all pages and layouts
- Test HTML/CSS changes
- Login/authentication
- Admin interface
- Static file serving

❌ **Doesn't work without worker:**
- Document upload processing
- Background tasks
- RAG queries (requires vector database)

## Stopping the Server

Press `Ctrl+C` in the terminal where Flask is running.

## Deactivate Virtual Environment

When you're done:
```bash
deactivate
```

## Notes

- This setup is for **development only**
- For full functionality, use Docker Compose
- For production deployment, use the Azure ARM templates
