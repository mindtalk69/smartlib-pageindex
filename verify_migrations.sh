#!/bin/bash
# Verify or initialize alembic migrations after migration to smartlib

SMARTLIB_DIR="/home/mlk/smartlib"
cd $SMARTLIB_DIR

echo "Checking database migration setup..."

# Initialize if needed
if [ ! -d "migrations" ] || [ ! -f "alembic.ini" ]; then
    echo "Migrations not found. Initializing new migrations..."
    export FLASK_APP=app.py
    flask db init
    
    # If database exists, create initial migration
    if [ -f "data/app.db" ]; then
        echo "Creating initial migration from existing database..."
        flask db migrate -m "Initial migration"
        flask db stamp head
    fi
    
    echo "Migrations initialized successfully!"
else
    # Check if versions directory exists and has migration scripts
    if [ ! -d "migrations/versions" ] || [ -z "$(ls -A migrations/versions)" ]; then
        echo "No migration versions found. Creating initial migration..."
        export FLASK_APP=app.py
        flask db migrate -m "Initial migration"
    else
        # Try to run alembic current to verify configuration
        echo "Checking alembic configuration..."
        export FLASK_APP=app.py
        flask db current

        if [ $? -eq 0 ]; then
            echo "SUCCESS: Alembic migrations verified and properly configured!"
        else
            echo "WARNING: Alembic configuration issue detected. Trying to fix..."
            # Try to recreate alembic.ini if needed
            if [ ! -f "alembic.ini" ]; then
                flask db init --multidb
            fi
            flask db current
        fi

        # Count migration scripts
        MIGRATION_COUNT=$(ls migrations/versions/*.py 2>/dev/null | wc -l)
        echo "Found $MIGRATION_COUNT migration versions."
    fi
fi

echo "Database migration setup complete!"

