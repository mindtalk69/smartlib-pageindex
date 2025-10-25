from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required
from modules.database import db, MessageHistory
import logging

messages_bp = Blueprint('admin_messages', __name__, url_prefix='/admin/messages')

@messages_bp.route('/')
@login_required
def message_viewer():
    try:
        messages = MessageHistory.query.order_by(MessageHistory.timestamp.desc()).all()
        return render_template('admin/messages.html', messages=messages)
    except Exception as e:
        logging.error(f"Error loading messages: {e}")
        flash('Error loading messages.', 'danger')
        return redirect(url_for('admin.dashboard'))

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
