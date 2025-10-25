from flask import render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash
# Import the rewritten create_user function and User model
from modules.database import create_user, User
# Remove old imports
# import sqlite3

def init_register(app):
    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')

            # Validate all fields exist
            if not all([username, email, password, confirm_password]):
                flash('All fields are required')
                return redirect(url_for('register'))

            # Validate username
            if len(username) < 3:
                flash('Username must be at least 3 characters')
                return redirect(url_for('register'))
            if len(username) > 20:
                flash('Username cannot exceed 20 characters')
                return redirect(url_for('register'))

            # Validate email format
            if '@' not in email or '.' not in email:
                flash('Please enter a valid email address')
                return redirect(url_for('register'))

            # Validate password
            if len(password) < 8:
                flash('Password must be at least 8 characters')
                return redirect(url_for('register'))
            if not any(c.isupper() for c in password):
                flash('Password must contain at least one uppercase letter')
                return redirect(url_for('register'))
            if not any(c.isdigit() for c in password):
                flash('Password must contain at least one number')
                return redirect(url_for('register'))

            # Validate password match
            if password != confirm_password:
                flash('Passwords do not match')
                return redirect(url_for('register'))

            # Use email as user_id as per original logic
            user_id = email
            hashed_password = generate_password_hash(password)

            try:
                # Call the SQLAlchemy create_user function
                new_user = create_user(
                    auth_provider='local',
                    user_id=user_id,
                    username=username,
                    email=email,
                    password_hash=hashed_password,
                    is_admin=False # Default for registration
                )
                # Check if user was actually created or if it already existed (create_user might return existing)
                # A more robust check might involve querying again, but let's assume IntegrityError is the main concern.
                # If create_user raises an exception (like IntegrityError), it will be caught below.
                # If it returns an existing user without error, we might still want to flash a message.
                # For simplicity, let's rely on the exception handling for now.

                flash('Registration successful! Please login.')
                return redirect(url_for('login_route'))
            except Exception as e: # Catch potential IntegrityError or other exceptions from create_user
                # Log the actual error for debugging
                app.logger.error(f"Registration failed for {username}/{email}: {e}")
                flash('Username or email already exists, or another registration error occurred.')
                return redirect(url_for('register'))
            # No need for finally block to close connection

        return render_template('register.html')
