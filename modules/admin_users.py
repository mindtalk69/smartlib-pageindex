import logging
import secrets
import string

from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash

from extensions import db
from modules.database import (
    PASSWORD_RESET_STATUS_COMPLETED,
    PASSWORD_RESET_STATUS_DENIED,
    PASSWORD_RESET_STATUS_PENDING,
    User,
    get_latest_pending_password_reset_request,
    get_password_reset_request_by_id,
    get_user_by_id,
    list_password_reset_requests,
    resolve_password_reset_request,
    toggle_user_disabled_status,
)

users_bp = Blueprint('admin_users', __name__, url_prefix='/admin/users')


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password for admin-initiated resets."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    length = max(8, length or 12)
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def _close_pending_request_for_user(user_id: str, admin_user_id: str, note: str) -> None:
    pending_request = get_latest_pending_password_reset_request(user_id)
    if not pending_request:
        return
    try:
        resolve_password_reset_request(
            pending_request,
            PASSWORD_RESET_STATUS_COMPLETED,
            admin_user_id,
            note,
        )
    except Exception as exc:
        logging.error(
            "Failed to mark password reset request %s as completed: %s",
            pending_request.id,
            exc,
        )


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


@users_bp.route('/actions/reset-password/<string:user_id>', methods=['POST'])
@login_required
def reset_password(user_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))
    user = db.session.get(User, user_id)
    if not user:
        flash('User not found.', 'danger')
        return redirect(url_for('admin_users.user_management'))
    if user.auth_provider and user.auth_provider.lower() != 'local':
        flash('Password resets are only available for local accounts.', 'warning')
        return redirect(url_for('admin_users.user_management'))
    try:
        temp_password = _generate_temp_password()
        user.password_hash = generate_password_hash(temp_password)
        db.session.commit()
        _close_pending_request_for_user(
            user.user_id,
            current_user.get_id(),
            "Password reset from user management page.",
        )
        logging.info(
            "[AdminUsers] Admin %s (%s) reset password for user %s (%s)",
            current_user.username,
            current_user.get_id(),
            user.username,
            user.user_id,
        )
        flash(
            f"Temporary password for {user.username}: {temp_password}. Provide it securely and ask them to change it after login.",
            'success',
        )
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error resetting password for {user_id}: {e}")
        flash('Failed to reset password. Please try again.', 'danger')
    return redirect(url_for('admin_users.user_management'))


@users_bp.route('/reset-requests')
@login_required
def password_reset_requests():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

    pending_requests = list_password_reset_requests(PASSWORD_RESET_STATUS_PENDING)
    recent_requests = list_password_reset_requests(
        [PASSWORD_RESET_STATUS_COMPLETED, PASSWORD_RESET_STATUS_DENIED]
    )[:50]

    return render_template(
        'admin/password_reset_requests.html',
        pending_requests=pending_requests,
        recent_requests=recent_requests,
    )


def _get_reset_request_or_redirect(request_id: int):
    reset_request = get_password_reset_request_by_id(request_id)
    if not reset_request:
        flash('Password reset request not found.', 'danger')
        return None
    return reset_request


@users_bp.route('/reset-requests/<int:request_id>/approve', methods=['POST'])
@login_required
def approve_password_reset_request(request_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

    reset_request = _get_reset_request_or_redirect(request_id)
    if reset_request is None:
        return redirect(url_for('admin_users.password_reset_requests'))

    if reset_request.status != PASSWORD_RESET_STATUS_PENDING:
        flash('That request has already been processed.', 'info')
        return redirect(url_for('admin_users.password_reset_requests'))

    user = db.session.get(User, reset_request.user_id)
    if not user:
        flash('The associated user account no longer exists.', 'warning')
        resolve_password_reset_request(
            reset_request,
            PASSWORD_RESET_STATUS_DENIED,
            current_user.get_id(),
            'User account missing during approval.',
        )
        return redirect(url_for('admin_users.password_reset_requests'))

    if user.auth_provider and user.auth_provider.lower() != 'local':
        flash('Password resets are only available for local accounts.', 'warning')
        resolve_password_reset_request(
            reset_request,
            PASSWORD_RESET_STATUS_DENIED,
            current_user.get_id(),
            'Account is not eligible for local password resets.',
        )
        return redirect(url_for('admin_users.password_reset_requests'))

    try:
        temp_password = _generate_temp_password()
        user.password_hash = generate_password_hash(temp_password)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logging.error("Error approving password reset request %s: %s", request_id, exc)
        flash('Failed to update the password. Please try again.', 'danger')
        return redirect(url_for('admin_users.password_reset_requests'))

    admin_notes = request.form.get('admin_notes')
    try:
        resolve_password_reset_request(
            reset_request,
            PASSWORD_RESET_STATUS_COMPLETED,
            current_user.get_id(),
            admin_notes,
        )
    except Exception as exc:
        logging.error(
            "Password updated but failed to mark request %s completed: %s",
            reset_request.id,
            exc,
        )
        flash(
            'Password updated, but the request could not be marked as completed. Please review logs.',
            'warning',
        )
    else:
        flash(
            f"Temporary password for {user.username}: {temp_password}. Provide it securely and ask them to change it after login.",
            'success',
        )

    return redirect(url_for('admin_users.password_reset_requests'))


@users_bp.route('/reset-requests/<int:request_id>/deny', methods=['POST'])
@login_required
def deny_password_reset_request(request_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

    reset_request = _get_reset_request_or_redirect(request_id)
    if reset_request is None:
        return redirect(url_for('admin_users.password_reset_requests'))

    if reset_request.status != PASSWORD_RESET_STATUS_PENDING:
        flash('That request has already been processed.', 'info')
        return redirect(url_for('admin_users.password_reset_requests'))

    admin_notes = request.form.get('admin_notes')
    try:
        resolve_password_reset_request(
            reset_request,
            PASSWORD_RESET_STATUS_DENIED,
            current_user.get_id(),
            admin_notes,
        )
        flash('Password reset request marked as denied.', 'info')
    except Exception as exc:
        logging.error("Failed to deny password reset request %s: %s", request_id, exc)
        flash('Unable to update the request. Please try again.', 'danger')

    return redirect(url_for('admin_users.password_reset_requests'))
