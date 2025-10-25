import sqlite3
import os
from modules.database import DB_PATH # Use existing path

# List the tables you want to clear completely
TABLES_TO_CLEAR = [
    'vector_references',
    'url_downloads',
    'uploaded_files',
    'message_history' # Include message_history
]

def clear_tables(conn, tables):
    """ Executes DELETE FROM statement for each table in the list """
    cursor = conn.cursor()
    print(f"Attempting to clear data from tables: {', '.join(tables)}")
    for table in tables:
        try:
            print(f"Clearing table: {table}...")
            cursor.execute(f"DELETE FROM {table};")
            # Optional: Reset autoincrement counter for tables that have it (like uploaded_files)
            # try:
            #     cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}';")
            # except sqlite3.Error:
            #     pass # Ignore if table doesn't have autoincrement or sequence entry doesn't exist
            print(f"Successfully cleared table: {table}")
        except sqlite3.Error as e:
            print(f"Error clearing table {table}: {e}")
    conn.commit()
    print("Finished clearing tables.")

def main():
    print(f"Connecting to database: {DB_PATH}")
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        print("Connection successful.")
        clear_tables(conn, TABLES_TO_CLEAR)
    except sqlite3.Error as e:
        print(f"Database error during clearing: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == '__main__':
    main()
