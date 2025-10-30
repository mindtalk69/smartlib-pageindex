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

DEFAULT_CATALOGS = [
    ('Contracts', 'A contract is a legally binding agreement between two or more parties. These parties may include a business, employees, third parties, and other entities. It is a document which states the nature and terms of collaboration between those involved.'),
    ('Corporate Bylaws', 'Katalog \'Corporate Bylaws\' menyediakan kumpulan dokumen dan pedoman yang mengatur struktur, fungsi, dan prosedur operasional suatu perusahaan. Dalam katalog ini, Anda akan menemukan berbagai contoh anggaran dasar, ketentuan rapat, serta aturan mengenai kepemilikan saham dan tanggung jawab direksi. Katalog ini bertujuan untuk membantu perusahaan dalam memastikan kepatuhan hukum, transparansi, dan pengelolaan yang efektif, serta mendukung pengambilan keputusan yang strategis. Ideal untuk pengacara, pemilik bisnis, dan profesional di bidang corporate governance.'),
    ('Business Plan', '**Business Plan Catalog**\n\nUnlock the potential of your entrepreneurial vision with our comprehensive \'Business Plan\' catalog. This resource is designed to guide startups and established businesses alike in crafting effective business strategies. It features templates, sample plans, and expert insights on market analysis, financial projections, operational planning, and marketing strategies. Whether you\'re seeking funding, exploring new markets, or refining your business model, this catalog provides the essential tools and knowledge to help you articulate your goals and drive your business forward.'),
    ('Financial Documents', ''),
    ('Transactional Documents', ''),
    ('Business Reports', '**Business Reports Catalog**\n\nThe \'Business Reports\' catalog serves as a comprehensive resource for professionals seeking in-depth analyses and insights into various industries and market trends. Featuring a diverse collection of detailed reports, this catalog covers financial performance, operational assessments, consumer behavior studies, and strategic forecasts. Ideal for business leaders, analysts, and decision-makers, it aims to enhance understanding and facilitate informed decision-making by providing valuable data and expert commentary on current and emerging business landscapes.'),
    ('Minutes Of Business Meeting', ''),
    ('Letters And Memos', ''),
    ('HR Documents', ''),
    ('Marketing Materials', ''),
    ('Proposals And Bids', ''),
    ('Board Resolutions', '**Board Resolutions Catalog**: This catalog serves as a comprehensive collection of formal decisions made by a company\'s board of directors. It includes templates and examples of resolutions covering various topics such as approvals for financial transactions, policy implementations, and corporate governance matters. Designed for corporate secretaries, legal teams, and board members, this resource aims to streamline the documentation process, ensure compliance with legal requirements, and enhance organizational transparency.'),
    ('Business Pitch', '**Business Pitch Shorts Catalog Description:**\n\nThe "Business Pitch" shorts catalog is a curated collection designed to inspire and equip entrepreneurs with concise, impactful presentations. Each entry features innovative ideas, strategies, and success stories from various industries, showcasing effective pitching techniques and essential elements for capturing investor interest. Ideal for startups and seasoned businesses alike, this catalog serves as a valuable resource for anyone looking to refine their pitch and elevate their business proposals.'),
    ('Compliance And Regulatory Documents', ''),
    ('Operational Documents', ''),
    ('Project Management Documents', ''),
    ('Non-Business', ''),
    ('Others', ''),
    ('Sales and Marketing Documents', '**Sales & Marketing Documents Catalog**\n\nThis catalog serves as a comprehensive repository for essential sales and marketing resources. It includes a curated collection of documents designed to enhance marketing strategies, streamline sales processes, and improve customer engagement. Expect to find templates, brochures, case studies, presentations, and analytical reports that provide valuable insights and support for both sales teams and marketing professionals. Ideal for businesses seeking to optimize their outreach efforts and drive growth through effective communication and branding materials.'),
    ('Sample Catalog', '')
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
    CREATE TABLE IF NOT EXISTS catalogs (
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
        print("Table 'catalogs' checked/created.")
    except sqlite3.Error as e:
        print(f"Error creating table: {e}")

def insert_default_catalogs(conn, catalogs):
    # First, ensure a sample user exists (assuming table has basic columns)
    sql_user = "INSERT OR IGNORE INTO users (user_id, username, auth_provider, is_admin) VALUES (?, ?, ?, ?);"
    sql_catalogs = "INSERT OR IGNORE INTO catalogs (name, description, created_by_user_id) VALUES (?, ?, ?);"
    
    try:
        c = conn.cursor()
        # Insert sample user if not exists
        c.execute(sql_user, ('admin@smarthing.com', 'admin', 'local', 1))
        
        inserted_count = 0
        for catalog in catalogs:
            c.execute(sql_catalogs, (*catalog, 'admin@smarthing.com'))
            if c.rowcount > 0: 
                inserted_count += 1
        conn.commit()
        print(f"Inserted {inserted_count} new default catalogs.")
    except sqlite3.Error as e:
        print(f"Error inserting catalogs: {e}")

def main():
    print(f"Using database path: {DB_PATH}")
    if DB_PATH != ":memory:":
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = create_connection(DB_PATH)
    if conn:
        create_table(conn)
        insert_default_catalogs(conn, DEFAULT_CATALOGS)
        conn.close()
    else:
        print("DB connection failed.")

if __name__ == '__main__':
    main()
