from pathlib import Path
from modules.database import init_db, DB_PATH

# Import the Flask app factory
from app import create_app

app = create_app()

if Path(DB_PATH).exists():
    print("Database already exists. Updating schema if necessary without dropping data...")
else:
    print("Database not found. Initializing database schema...")

with app.app_context():
    init_db()
print("Database schema updated successfully")
