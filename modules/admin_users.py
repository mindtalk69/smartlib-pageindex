from flask import Blueprint, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from extensions import db
from modules.database import User, toggle_user_disabled_status, get_user_by_id
import logging

users_bp = Blueprint('admin_users', __name__, url_prefix='/admin/users')

@users_bp.route('/')
@login_required
def user_management():
    try:
        users = User.query.order_by(User.username).all()
        return render_template('admin/users.html', users=users)
    except Exception as e:
        logging.error(f"Error fetching users: {e}")
        flash("Error loading user list.", "danger")
        return render_template('admin/users.html', users=[])

@users_bp.route('/actions/toggle_admin/<string:user_id>')
@login_required
def toggle_admin(user_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))
    if user_id == current_user.get_id():
        flash("You cannot change your own admin status.", 'danger')
        return redirect(url_for('admin_users.user_management'))
    user = db.session.get(User, user_id)
    if user:
        try:
            new_status = not user.is_admin
            user.is_admin = new_status
            db.session.commit()
            flash(f'Admin status {"granted" if new_status else "revoked"} successfully.', 'success')
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error toggling admin status: {e}")
            flash('An error occurred while updating admin status.', 'danger')
    else:
        flash('User not found.', 'danger')
    return redirect(url_for('admin_users.user_management'))

@users_bp.route('/actions/toggle-status/<string:user_id>')
@login_required
def toggle_user_status(user_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))
    if user_id == current_user.get_id():
        flash("You cannot disable your own account.", 'danger')
        return redirect(url_for('admin_users.user_management'))
    try:
        success = toggle_user_disabled_status(user_id)
        if success:
            user = get_user_by_id(user_id)
            if user:
                status_text = "disabled" if user.is_disabled else "enabled"
                flash(f'User successfully {status_text}.', 'success')
            else:
                flash('User status updated, but could not fetch current status.', 'warning')
        else:
            flash('Failed to update user status (User not found?).', 'danger')
    except Exception as e:
        logging.error(f"Error in toggle_user_status route: {e}")
        flash('An unexpected error occurred while toggling user status.', 'danger')
    return redirect(url_for('admin_users.user_management'))
