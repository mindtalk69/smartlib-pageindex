# promote_admin_sqlalchemy.py
# Ensures an admin user exists and is promoted, creating if necessary.
# Uses credentials from environment variables (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL).
# Idempotent and safe for container startup - won't delete existing users.

import os
import sys
from flask import Flask
from extensions import db
from modules.database import get_user_by_username_local, create_user, set_user_admin
import bcrypt
from app import create_app

def promote_or_create_admin():
    username = os.environ.get("ADMIN_USERNAME", "admin")
    password = os.environ.get("ADMIN_PASSWORD","admin")
    email = os.environ.get("ADMIN_EMAIL")
    auth_provider = "local"
    user_id = username  # or generate a UUID if needed

    flask_app = create_app()
    with flask_app.app_context():
        user = get_user_by_username_local(username)
        if user:
            set_user_admin(user.user_id, True)
            print(f"User '{username}' promoted to admin.")
            
            # Optionally update password if requested, by converting to bcrypt
            if password:
                hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                user.password_hash = hashed_password
                db.session.commit()
                print(f"User '{username}' password updated with bcrypt hash.")
        else:
            if not password:
                print("ERROR: ADMIN_PASSWORD environment variable not set. Cannot create admin user.", file=sys.stderr)
                sys.exit(1)
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            create_user(
                auth_provider=auth_provider,
                user_id=user_id,
                username=username,
                email=email,
                password_hash=hashed_password,
                is_admin=True
            )
            print(f"Admin user '{username}' created and promoted.")

if __name__ == "__main__":
    promote_or_create_admin()
