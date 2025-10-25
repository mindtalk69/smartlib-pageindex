import sqlite3
import logging
import sys
import os
from pathlib import Path
from sqlalchemy.exc import IntegrityError

# Set up basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
DB_NAME = "app.db"
# --- Configuration ---
BACKUP_DB_PATH = Path(__file__).parent / "data" / f"{DB_NAME}"
TARGET_ADMIN_USER_ID = 'admin@smarthing.com' # The user_id to assign as creator

# --- Flask App Context Setup ---
# Add project root to Python path to allow importing 'app' and 'modules'
project_root = Path(__file__).parent.resolve()
sys.path.insert(0, str(project_root))

try:
    from app import create_app
    # Import models needed for insertion AFTER setting up app context
except ImportError as e:
    logging.error(f"Failed to import Flask app or models. Ensure script is in project root. Error: {e}")
    sys.exit(1)

# --- Database Interaction Functions ---

def fetch_from_backup(table_name, columns):
    """Fetches data from a specific table in the backup database."""
    data = []
    if not BACKUP_DB_PATH.exists():
        logging.warning(f"Backup database file not found at: {BACKUP_DB_PATH}")
        return data

    try:
        conn_backup = sqlite3.connect(BACKUP_DB_PATH)
        cursor_backup = conn_backup.cursor()
        # Construct column string for SELECT and dictionary keys
        col_string = ", ".join(columns)
        cursor_backup.execute(f"SELECT {col_string} FROM {table_name}")
        rows = cursor_backup.fetchall()
        # Convert rows to list of dictionaries
        data = [dict(zip(columns, row)) for row in rows]
        logging.info(f"Fetched {len(data)} rows from backup table '{table_name}'.")
    except sqlite3.OperationalError as e:
        logging.warning(f"Could not fetch from backup table '{table_name}': {e}. Table might not exist in backup.")
    except Exception as e:
        logging.error(f"Error fetching from backup table '{table_name}': {e}", exc_info=True)
    finally:
        if 'conn_backup' in locals() and conn_backup:
            conn_backup.close()
    return data

def insert_languages(app, languages_data):
    """Inserts language data into the main database."""
    count = 0
    skipped = 0
    with app.app_context():
        from modules.database import db, LlmLanguage # Import inside context
        for lang_data in languages_data:
            # Check if language code already exists
            exists = LlmLanguage.query.filter_by(language_code=lang_data['language_code']).first()
            if exists:
                logging.warning(f"Skipping language code '{lang_data['language_code']}' - already exists.")
                skipped += 1
                continue

            new_lang = LlmLanguage(
                language_code=lang_data['language_code'],
                language_name=lang_data['language_name'],
                is_active=bool(lang_data.get('is_active', False)), # Handle potential missing column
                created_by=TARGET_ADMIN_USER_ID # Assign admin user
                # created_at will use server default
            )
            db.session.add(new_lang)
            try:
                # Commit each one individually to skip duplicates gracefully
                db.session.commit()
                count += 1
            except IntegrityError:
                db.session.rollback()
                logging.warning(f"Skipping language '{lang_data['language_name']}' due to potential unique constraint conflict (e.g., name).")
                skipped += 1
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error inserting language '{lang_data['language_name']}': {e}", exc_info=True)
                skipped += 1
    logging.info(f"Inserted {count} languages, skipped {skipped}.")

def insert_categories(app, categories_data):
    """Inserts category data into the main database."""
    count = 0
    skipped = 0
    with app.app_context():
        from modules.database import db, Category # Import inside context
        for cat_data in categories_data:
             # Check if category name already exists
            exists = Category.query.filter_by(name=cat_data['name']).first()
            if exists:
                logging.warning(f"Skipping category name '{cat_data['name']}' - already exists.")
                skipped += 1
                continue

            new_cat = Category(
                name=cat_data['name'],
                description=cat_data.get('description'), # Use .get for safety
                created_by_user_id=TARGET_ADMIN_USER_ID # Assign admin user
                # created_at will use server default
            )
            db.session.add(new_cat)
            try:
                # Commit each one individually
                db.session.commit()
                count += 1
            except IntegrityError: # Should be caught by pre-check, but just in case
                db.session.rollback()
                logging.warning(f"Skipping category '{cat_data['name']}' due to unique constraint conflict.")
                skipped += 1
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error inserting category '{cat_data['name']}': {e}", exc_info=True)
                skipped += 1
    logging.info(f"Inserted {count} categories, skipped {skipped}.")

def insert_catalogs(app, catalogs_data):
    """Inserts catalog data into the main database."""
    count = 0
    skipped = 0
    with app.app_context():
        from modules.database import db, Catalog # Import inside context
        for cat_data in catalogs_data:
            # Check if catalog name already exists
            exists = Catalog.query.filter_by(name=cat_data['name']).first()
            if exists:
                logging.warning(f"Skipping catalog name '{cat_data['name']}' - already exists.")
                skipped += 1
                continue

            new_cat = Catalog(
                name=cat_data['name'],
                description=cat_data.get('description'), # Use .get for safety
                created_by_user_id=TARGET_ADMIN_USER_ID # Assign admin user
                # created_at will use server default
            )
            db.session.add(new_cat)
            try:
                 # Commit each one individually
                db.session.commit()
                count += 1
            except IntegrityError: # Should be caught by pre-check, but just in case
                db.session.rollback()
                logging.warning(f"Skipping catalog '{cat_data['name']}' due to unique constraint conflict.")
                skipped += 1
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error inserting catalog '{cat_data['name']}': {e}", exc_info=True)
                skipped += 1
    logging.info(f"Inserted {count} catalogs, skipped {skipped}.")


# --- Main Execution ---
if __name__ == "__main__":
    logging.info("Starting data import from backup...")

    # Fetch data from backup
    # Define columns carefully based on the *expected* schema in the backup
    # Adjust these lists if the backup schema differs significantly
    lang_cols = ['language_code', 'language_name', 'is_active'] # Assuming these columns exist
    cat_cols = ['id', 'name', 'description'] # Assuming these columns exist
    catalog_cols = ['id', 'name', 'description'] # Assuming these columns exist

    languages = fetch_from_backup('llm_languages', lang_cols)
    categories = fetch_from_backup('categories', cat_cols)
    catalogs = fetch_from_backup('catalogs', catalog_cols)

    if not languages and not categories and not catalogs:
        logging.warning("No data found in backup tables (or tables don't exist). Exiting.")
        sys.exit(0)

    # Create Flask app instance to get context
    flask_app = create_app()

    # Insert data into new database
    if languages:
        insert_languages(flask_app, languages)
    if categories:
        insert_categories(flask_app, categories)
    if catalogs:
        insert_catalogs(flask_app, catalogs)

    logging.info("Data import process finished.")
