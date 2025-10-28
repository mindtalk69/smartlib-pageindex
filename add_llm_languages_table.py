import sqlite3
import os

DB_PATH = os.path.join('data', 'app.db')

DEFAULT_LANGUAGES = [
    ('Indonesian', 'id'), ('English', 'en'), ('Chinese', 'lzh'),
    ('Japanese', 'ja'), ('Italian', 'it'), ('German', 'de'),
    ('Spanish', 'es'), ('Korean', 'ko'), ('Filipino', 'fil'),
    ('Vietnamese', 'vi'), ('French', 'fr'), ('Arabic', 'ar'),
    ('Malay', 'ms')
]

def create_connection(db_file):
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        return conn
    except sqlite3.Error as e:
        print(f"Error connecting to database: {e}")
    return conn

def create_table(conn):
    sql = """
    CREATE TABLE IF NOT EXISTS llm_languages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language_code TEXT NOT NULL UNIQUE,
        language_name TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
    );"""
    try:
        c = conn.cursor()
        c.execute(sql)
        print("Table 'llm_languages' checked/created.")
    except sqlite3.Error as e:
        print(f"Error creating table: {e}")

def insert_default_languages(conn, languages):
    sql = "INSERT OR IGNORE INTO llm_languages (language_name, language_code, is_active) VALUES (?, ?, ?);"
    try:
        c = conn.cursor()
        inserted_count = 0
        for lang in languages:
            is_active = 1 if lang[1] == 'en' else 0
            c.execute(sql, lang + (is_active,))
            if c.rowcount > 0: inserted_count += 1
        # Update existing rows to set only English active
        c.execute("UPDATE llm_languages SET is_active = 1 WHERE language_code = 'en';")
        c.execute("UPDATE llm_languages SET is_active = 0 WHERE language_code != 'en';")
        conn.commit()
        print(f"Processed languages. Inserted {inserted_count} new default languages.")
    except sqlite3.Error as e:
        print(f"Error inserting languages: {e}")

def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = create_connection(DB_PATH)
    if conn:
        create_table(conn)
        insert_default_languages(conn, DEFAULT_LANGUAGES)
        conn.close()
    else:
        print("DB connection failed.")

if __name__ == '__main__':
    main()
