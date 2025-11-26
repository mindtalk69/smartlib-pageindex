import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user

from modules.database import (
    get_app_setting,
    set_app_setting,
    count_active_users,
    AppSettings,
)

settings_bp = Blueprint('admin_settings', __name__, url_prefix='/admin/settings')


@settings_bp.route('/')
@login_required
def settings_page():
    """Display application settings page."""
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

    try:
        # Get current settings from database
        from flask import current_app
        max_active_users = get_app_setting(
            'max_active_users',
            default=current_app.config.get('MAX_ACTIVE_USERS', 10)
        )

        # Get current active user count for display
        active_user_count = count_active_users()

        # Get all settings for display
        all_settings = AppSettings.query.order_by(AppSettings.key).all()

        return render_template(
            'admin/settings.html',
            max_active_users=max_active_users,
            active_user_count=active_user_count,
            all_settings=all_settings
        )
    except Exception as e:
        logging.error(f"Error loading settings page: {e}")
        flash('Error loading settings.', 'danger')
        return redirect(url_for('admin.dashboard'))


@settings_bp.route('/update', methods=['POST'])
@login_required
def update_settings():
    """Update application settings."""
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

    try:
        # Get form data
        max_active_users = request.form.get('max_active_users', type=int)

        # Validate input
        if max_active_users is None or max_active_users < 1:
            flash('Maximum active users must be at least 1.', 'danger')
            return redirect(url_for('admin_settings.settings_page'))

        # Check if new limit is lower than current active users
        current_active = count_active_users()
        if max_active_users < current_active:
            flash(
                f'Cannot set limit to {max_active_users} - you currently have {current_active} active users. '
                f'Please disable {current_active - max_active_users} user(s) first.',
                'warning'
            )
            return redirect(url_for('admin_settings.settings_page'))

        # Update setting in database
        success = set_app_setting(
            key='max_active_users',
            value=max_active_users,
            value_type='int'
        )

        if success:
            flash(f'Settings updated successfully. Maximum active users set to {max_active_users}.', 'success')
        else:
            flash('Failed to update settings. Please try again.', 'danger')

    except ValueError:
        flash('Invalid input. Please enter a valid number.', 'danger')
    except Exception as e:
        logging.error(f"Error updating settings: {e}")
        flash('An unexpected error occurred while updating settings.', 'danger')

    return redirect(url_for('admin_settings.settings_page'))
