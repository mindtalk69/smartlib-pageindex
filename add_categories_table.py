import os
import sqlite3
from sqlalchemy.engine import make_url


def resolve_db_path() -> str:
    uri = os.environ.get("SQLALCHEMY_DATABASE_URI")
    if uri:
        try:
            url = make_url(uri)
        except Exception as exc:  # pragma: no cover - defensive logging
            print(
                f"Warning: unable to parse SQLALCHEMY_DATABASE_URI '{uri}': {exc}"
            )
        else:
            if url.get_backend_name() == "sqlite":
                database = url.database or ""
                if database == ":memory:":
                    return database
                if not os.path.isabs(database):
                    return os.path.abspath(os.path.join(os.getcwd(), database))
                return database
    data_root = os.environ.get("DATA_VOLUME_PATH")
    if data_root:
        return os.path.join(data_root, "app.db")
    return os.path.abspath(os.path.join(os.getcwd(), "data", "app.db"))


DB_PATH = resolve_db_path()

DEFAULT_CATEGORIES = [
    ('Public Data', 'Kategori \'Data Publik\' mencakup informasi yang tersedia untuk umum dan dapat diakses tanpa batasan. Konten dalam kategori ini meliputi statistik pemerintah, laporan penelitian, data demografis, informasi lingkungan, serta data terkait kesehatan dan pendidikan. Tujuan utama dari data publik adalah untuk meningkatkan transparansi, mendukung penelitian, dan memberikan dasar untuk pengambilan keputusan yang informasional oleh masyarakat, peneliti, dan pembuat kebijakan. Ketersediaan data ini berkontribusi pada partisipasi publik yang lebih besar dan pengembangan kebijakan yang berbasis bukti.'),
    ('Private Data', 'The \'Private Data\' category encompasses sensitive and confidential information that is intended for restricted access and use. This may include personal identifiers, financial records, health information, and proprietary business data. The primary purpose of this category is to safeguard individual privacy and protect organizational integrity, ensuring that such information is handled responsibly and in compliance with relevant laws and regulations. Proper management and security protocols are essential to prevent unauthorized access and potential data breaches.'),
    ('Internal Data', 'Data for exclusive enterprise use.'),
    ('Confidential Data', 'Sersitive data needing protection from unauthorized access.'),
    ('Restricted data', 'Data with additional access Limitations beyond what is considered confidential due to legal obligations.'),
    ('Critical data', 'Data vital for business operations and strategic objectives.'),
    ('Regulatory data', 'Data subject to legal or regulatory requirements.')
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
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
    );"""
    try:
        c = conn.cursor()
        c.execute(sql)
        print("Table 'categories' checked/created.")
    except sqlite3.Error as e:
        print(f"Error creating table: {e}")

def insert_default_categories(conn, categories):
    # First, ensure a sample user exists (assuming table has basic columns)
    sql_user = "INSERT OR IGNORE INTO users (user_id, username, auth_provider, is_admin) VALUES (?, ?, ?, ?);"
    sql_categories = "INSERT OR IGNORE INTO categories (name, description, created_by_user_id) VALUES (?, ?, ?);"
    
    try:
        c = conn.cursor()
        # Insert sample user if not exists
        c.execute(sql_user, ('admin@smarthing.com', 'admin', 'local', 1))
        
        inserted_count = 0
        for category in categories:
            c.execute(sql_categories, (*category, 'admin@smarthing.com'))
            if c.rowcount > 0: 
                inserted_count += 1
        conn.commit()
        print(f"Inserted {inserted_count} new default categories.")
    except sqlite3.Error as e:
        print(f"Error inserting categories: {e}")

def main():
    print(f"Using database path: {DB_PATH}")
    if DB_PATH != ":memory:":
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = create_connection(DB_PATH)
    if conn:
        create_table(conn)
        insert_default_categories(conn, DEFAULT_CATEGORIES)
        conn.close()
    else:
        print("DB connection failed.")

if __name__ == '__main__':
    main()
