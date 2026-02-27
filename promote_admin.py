import sqlite3
import bcrypt
from pathlib import Path
from database_fastapi import DB_PATH

username = "admin"
password = "password" # NOTE: default admin password for dev environments

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check if user exists
cursor.execute("SELECT user_id FROM users WHERE username = ?", (username,))
user = cursor.fetchone()

# Hash the new password
hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

if user:
    user_id = user[0]
    # Promote to admin, overwrite hash, and set email to username if empty
    cursor.execute("UPDATE users SET is_admin = TRUE, password_hash = ?, email = ? WHERE user_id = ?", (hashed_password, username, user_id,))
    conn.commit()
    print(f"Successfully promoted user '{username}' (ID: {user_id}) to admin and reset their password using bcrypt.")
else:
    print(f"Error: User '{username}' not found")

conn.close()
