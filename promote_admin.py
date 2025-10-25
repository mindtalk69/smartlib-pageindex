import sqlite3
from pathlib import Path
from modules.database import DB_PATH

username = "admin"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check if user exists
cursor.execute("SELECT user_id FROM users WHERE username = ?", (username,))
user = cursor.fetchone()

if user:
    user_id = user[0]
    # Promote to admin
    cursor.execute("UPDATE users SET is_admin = TRUE WHERE user_id = ?", (user_id,))
    conn.commit()
    print(f"Successfully promoted user '{username}' (ID: {user_id}) to admin")
else:
    print(f"Error: User '{username}' not found")

conn.close()
