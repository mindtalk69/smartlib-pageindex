from flask import render_template, request, redirect, url_for, flash, session
from flask_login import login_user, logout_user # Import logout_user
# Import the rewritten database functions and User model
from modules.database import get_user_by_username_local, User
from werkzeug.security import check_password_hash
import logging # Import logging

def init_login(app):
    # Get the app's logger instance once during initialization
    logger = app.logger

    @app.route('/login', methods=['GET', 'POST'], endpoint='login_route') # Added endpoint name for clarity
    def login():
        if request.method == 'POST':
            logger.info(f"Login POST request received for user: {request.form.get('username')}") # ADDED LOGGING
            # Strip whitespace from inputs
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "").strip()

            if not username or not password:
                flash('Username and password are required.')
                return render_template('login.html')

            # Use the rewritten function
            user = get_user_by_username_local(username)

            if not user:
                app.logger.warning(f"Login attempt failed: User '{username}' not found for auth_provider 'local'.")
                flash('Invalid username or password')
                return render_template('login.html')

            # Check if password hash exists before trying to check it
            if not user.password_hash:
                 app.logger.error(f"Login attempt failed: User '{username}' (ID: {user.user_id}) has no password hash stored.")
                 flash('Login error: Account password not set correctly. Please contact support or try resetting password.')
                 return render_template('login.html')

            # Check password and disabled status using object attributes
            if check_password_hash(user.password_hash, password):
                if user.is_disabled:
                    app.logger.warning(f"Login attempt failed: User '{username}' (ID: {user.user_id}) is disabled.")
                    flash('Your account is disabled. Please contact an administrator.', 'danger')
                    return render_template('login.html') # Stay on login page

                # Proceed with login if not disabled
                # The SQLAlchemy User model should work directly with Flask-Login
                login_user(user)
                # Use session consistently, accessing attributes
                session["user"] = {
                    "user_id": user.user_id,
                    "username": user.username,
                    "auth_provider": "local" # Or user.auth_provider
                }
                return redirect(url_for('index'))
            else:
                # Password check failed
                app.logger.warning(f"Login attempt failed: Invalid password for user '{username}' (ID: {user.user_id}).")
                flash('Invalid username or password')

        return render_template('login.html')

    @app.route('/admin/login', methods=['GET', 'POST'])
    def admin_login():
        if request.method == 'POST':
            username = request.form.get("username")
            password = request.form.get("password")

            # Use the rewritten function, adding filters for admin and local provider
            user = User.query.filter_by(username=username, is_admin=True, auth_provider='local').first()

            if user and check_password_hash(user.password_hash, password):
                # Logout any existing user and clear session before admin login
                logout_user()
                session.clear()
                session.pop('user', None)

                # Log in the admin user (SQLAlchemy User object works)
                login_user(user)
                # Optionally set a specific session variable for admin if needed
                # session["admin_user"] = {"user_id": user.user_id}
                return redirect(url_for('admin.dashboard'))

            flash('Invalid admin credentials')
        return render_template('admin/login.html')
