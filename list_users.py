import sqlite3
import argparse
from pathlib import Path
from modules.database import DB_PATH

parser = argparse.ArgumentParser()
parser.add_argument('--admin', action='store_true', help='Only show admin users')
args = parser.parse_args()

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

query = "SELECT user_id, username, email, is_admin FROM users"
if args.admin:
    query += " WHERE is_admin = 1"
    
cursor.execute(query)
users = cursor.fetchall()

if users:
    print("Current users in database:")
    print("{:<20} {:<20} {:<30} {:<10}".format("User ID", "Username", "Email", "Admin"))
    print("-" * 80)
    for user in users:
        uid = user[0] if user[0] is not None else ""
        uname = user[1] if user[1] is not None else ""
        email = user[2] if user[2] is not None else ""
        admin_flag = "Yes" if user[3] else "No"
        print("{:<20} {:<20} {:<30} {:<10}".format(uid, uname, email, admin_flag))
else:
    print("No users found in database")

conn.close()
