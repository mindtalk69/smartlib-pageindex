from flask import (
    Blueprint,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_login import current_user, login_required
from sqlalchemy import text

from modules.database import MessageHistory, db

import csv
import logging
import os
from datetime import datetime, timedelta

messages_bp = Blueprint('admin_messages', __name__, url_prefix='/admin/messages')


def _ensure_admin_access():
    if not current_user.is_authenticated:
        return redirect(url_for('login_route'))
    if not getattr(current_user, 'is_admin', False):
        flash('Admin access required.', 'danger')
        return redirect(url_for('index'))
    return None


@messages_bp.before_request
def enforce_admin_access():
    return _ensure_admin_access()


def _resolve_log_directory() -> str:
    log_dir = current_app.config.get('LOG_DIR')
    if not log_dir:
        data_dir = current_app.config.get('DATA_VOLUME_PATH') or os.path.join(
            current_app.root_path, 'data'
        )
        log_dir = os.path.join(data_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    return log_dir


def _run_sqlite_vacuum():
    engine = db.engine
    if engine.url.get_backend_name() != 'sqlite':
        return
    try:
        with engine.begin() as connection:
            connection.execute(text('VACUUM'))
    except Exception as exc:
        current_app.logger.warning('VACUUM failed: %s', exc)


@messages_bp.route('/')
@login_required
def message_viewer():
    retention_days = current_app.config.get('MESSAGE_RETENTION_DAYS', 30)
    log_dir = _resolve_log_directory()
    try:
        messages = MessageHistory.query.order_by(MessageHistory.timestamp.desc()).all()
        return render_template(
            'admin/messages.html',
            messages=messages,
            default_retention_days=retention_days,
            message_log_directory=log_dir,
        )
    except Exception as e:
        logging.error(f"Error loading messages: {e}")
        flash('Error loading messages.', 'danger')
        return redirect(url_for('admin.dashboard'))


@messages_bp.route('/cleanup', methods=['POST'])
@login_required
def cleanup_messages():
    retention_input = request.form.get('retention_days')
    try:
        retention_days = int(retention_input) if retention_input else int(
            current_app.config.get('MESSAGE_RETENTION_DAYS', 30)
        )
        if retention_days < 1:
            raise ValueError
    except (TypeError, ValueError):
        flash('Retention days must be a positive integer.', 'warning')
        return redirect(url_for('admin_messages.message_viewer'))

    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    old_messages = (
        MessageHistory.query.filter(MessageHistory.timestamp < cutoff)
        .order_by(MessageHistory.timestamp.asc())
        .all()
    )

    if not old_messages:
        flash('No messages older than the selected retention window.', 'info')
        return redirect(url_for('admin_messages.message_viewer'))

    log_dir = _resolve_log_directory()
    export_filename = (
        f"message_history_archive_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    )
    export_path = os.path.join(log_dir, export_filename)

    try:
        with open(export_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['message_id', 'username', 'message', 'answer', 'timestamp'])
            for message in old_messages:
                writer.writerow(
                    [
                        message.message_id,
                        message.author.username if message.author else 'unknown',
                        message.message_text,
                        message.answer or '',
                        message.timestamp.isoformat() if message.timestamp else '',
                    ]
                )
    except Exception as exc:
        current_app.logger.error('Failed to export message history: %s', exc)
        flash('Could not export message history. Check logs for details.', 'danger')
        return redirect(url_for('admin_messages.message_viewer'))

    try:
        MessageHistory.query.filter(MessageHistory.timestamp < cutoff).delete(
            synchronize_session=False
        )
        db.session.commit()
        _run_sqlite_vacuum()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error('Failed to purge message history: %s', exc)
        flash('Export succeeded but cleanup failed. Review server logs.', 'danger')
        return redirect(url_for('admin_messages.message_viewer'))

    flash(
        f'Exported and removed {len(old_messages)} messages older than {retention_days} days. '
        f'Archive saved to {export_filename}.',
        'success',
    )
    return redirect(url_for('admin_messages.message_viewer'))


@messages_bp.route('/delete/<int:message_id>', methods=['POST'])
@login_required
def delete_message(message_id):
    try:
        message = MessageHistory.query.get_or_404(message_id)
        db.session.delete(message)
        db.session.commit()
        flash('Message deleted successfully.', 'success')
    except Exception as e:
        logging.error(f"Error deleting message: {e}")
        flash('Error deleting message.', 'danger')
    return redirect(url_for('admin_messages.message_viewer'))
