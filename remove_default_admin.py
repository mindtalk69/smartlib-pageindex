#!/usr/bin/env python3
import sys
from modules.database import get_db_connection

def main():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE username = ?", ("admin",))
    conn.commit()
    print("Removed user(s) with username 'admin'.")
    conn.close()

if __name__ == '__main__':
    main()
