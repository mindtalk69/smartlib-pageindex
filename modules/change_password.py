from flask import render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
# Import SQLAlchemy db instance from extensions and User model
from extensions import db
from modules.database import User

def init_change_password(app):
    @app.route('/change_password', methods=['GET', 'POST'])
    @login_required # Add login required decorator
    def change_password():
        # Only allow for local users
        if current_user.auth_provider != 'local':
            flash('Password change is only available for local accounts.', 'warning')
            return redirect(url_for('index'))

        if request.method == 'POST':
            current_password = request.form.get('current_password')
            new_password = request.form.get('new_password')
            confirm_new_password = request.form.get('confirm_new_password')

            # Basic validation
            if not all([current_password, new_password, confirm_new_password]):
                flash('All password fields are required.', 'danger')
                return render_template('change_password.html')

            if new_password != confirm_new_password:
                flash('New passwords do not match.', 'danger')
                return render_template('change_password.html')

            # Fetch the user object using SQLAlchemy
            user = db.session.get(User, current_user.user_id)

            if not user or not check_password_hash(user.password_hash, current_password):
                flash('Incorrect current password.', 'danger')
                return render_template('change_password.html')

            # Validation for new password (similar to registration)
            if len(new_password) < 8:
                flash('New password must be at least 8 characters', 'danger')
                return render_template('change_password.html')
            if not any(c.isupper() for c in new_password):
                flash('New password must contain at least one uppercase letter', 'danger')
                return render_template('change_password.html')
            if not any(c.isdigit() for c in new_password):
                flash('New password must contain at least one number', 'danger')
                return render_template('change_password.html')

            # Update password hash
            try:
                user.password_hash = generate_password_hash(new_password)
                db.session.commit()
                flash('Password updated successfully!', 'success')
                return redirect(url_for('index')) # Redirect after successful change
            except Exception as e:
                db.session.rollback()
                app.logger.error(f"Error changing password for user {user.user_id}: {e}")
                flash('An error occurred while updating the password. Please try again.', 'danger')

        return render_template('change_password.html')
