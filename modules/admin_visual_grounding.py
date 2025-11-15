from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import login_required
from flask_wtf import FlaskForm
from modules.database import db, AppSettings
import os
import logging
import traceback

visual_grounding_bp = Blueprint('admin_visual_grounding', __name__, url_prefix='/admin/visual_grounding')

class SettingsForm(FlaskForm):
    # No fields needed, just inherits CSRF protection
    pass

@visual_grounding_bp.route('/settings', methods=['GET', 'POST'])
@login_required
def visual_grounding_settings():
    form = SettingsForm()
    if form.validate_on_submit():
        try:
            enabled_value = request.form.get('visual_grounding_enabled') == 'true'
            doc_store_path = request.form.get('visual_grounding_doc_store_path', '').strip()

            if not doc_store_path:
                flash('Document store path cannot be empty.', 'danger')
                return redirect(url_for('admin_visual_grounding.visual_grounding_settings'))

            if not os.path.isabs(doc_store_path) and not doc_store_path.startswith(('data/', 'static/', 'templates/')):
                # Basic validation, allow relative paths starting with known dirs or absolute paths
                pass

            settings_to_update = {
                'visual_grounding_enabled': str(enabled_value).lower(),
                'visual_grounding_doc_store_path': doc_store_path
            }

            for key, value in settings_to_update.items():
                setting = db.session.get(AppSettings, key)
                if setting:
                    setting.value = value
                else:
                    new_setting = AppSettings(key=key, value=value)
                    db.session.add(new_setting)

            db.session.commit()

            current_app.config['VISUAL_GROUNDING_ENABLED'] = enabled_value
            current_app.config['VISUAL_GROUNDING_DOC_STORE_PATH'] = doc_store_path

            flash('Visual grounding settings updated successfully.', 'success')

        except Exception as e:
            db.session.rollback()
            logging.error(f"Error updating visual grounding settings: {traceback.format_exc()}")
            flash(f'An error occurred while saving settings: {str(e)}', 'danger')

        return redirect(url_for('admin_visual_grounding.visual_grounding_settings'))

    try:
        settings_query = AppSettings.query.filter(AppSettings.key.in_([
            'visual_grounding_enabled',
            'visual_grounding_doc_store_path'
        ])).all()
        settings = {s.key: s.value for s in settings_query}
        settings.setdefault('visual_grounding_enabled', 'false')
        settings.setdefault('visual_grounding_doc_store_path', 'data/doc_store')
    except Exception as e:
        logging.error(f"Error fetching visual grounding settings: {traceback.format_exc()}")
        flash('Error loading settings.', 'danger')
        settings = {
            'visual_grounding_enabled': 'false',
            'visual_grounding_doc_store_path': 'data/doc_store'
        }

    try:
        return render_template('admin/settings_visual_grounding.html', settings=settings, form=form)
    except Exception as e:
        logging.error(f"Error rendering visual grounding settings template: {traceback.format_exc()}")
        flash('An internal error occurred while trying to display the settings page.', 'danger')
        return redirect(url_for('admin.dashboard'))

@visual_grounding_bp.route('/activities')
@login_required
def visual_grounding_activities():
    try:
        from modules.database import VisualGroundingActivity

        from modules.database import UploadedFile, User, Group

        activity_rows = (
            db.session.query(
                VisualGroundingActivity.id.label('id'),
                VisualGroundingActivity.status.label('status'),
                VisualGroundingActivity.created_at.label('created_at'),
                VisualGroundingActivity.updated_at.label('updated_at'),
                VisualGroundingActivity.file_id.label('file_id'),
                User.username.label('username'),
                Group.name.label('group_name'),
                UploadedFile.original_filename.label('file_name'),
                UploadedFile.library_id.label('library_id'),
            )
            .outerjoin(User, VisualGroundingActivity.user_id == User.user_id)
            .outerjoin(Group, VisualGroundingActivity.group_id == Group.group_id)
            .outerjoin(UploadedFile, VisualGroundingActivity.file_id == UploadedFile.file_id)
            .order_by(VisualGroundingActivity.created_at.desc())
            .all()
        )

        activities = [
            {
                "id": row.id,
                "status": (row.status or 'pending'),
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "user": row.username,
                "group": row.group_name,
                "file": row.file_name,
                "file_id": row.file_id,
                "library_id": row.library_id,
            }
            for row in activity_rows
        ]


        return render_template('admin/visual_grounding_activities.html', activities=activities)
    except Exception:
        logging.error(f"Error loading visual grounding activities: {traceback.format_exc()}")
        flash('Error loading visual grounding activities.', 'danger')
        return redirect(url_for('admin.dashboard'))
