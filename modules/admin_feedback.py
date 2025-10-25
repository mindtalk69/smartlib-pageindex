from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from extensions import db
from modules.database import MessageFeedback, MessageHistory, User

admin_feedback_bp = Blueprint('admin_feedback', __name__, url_prefix='/admin')

@admin_feedback_bp.route('/feedback')
@login_required
def feedback_list():
    if not current_user.is_admin:
        return "Admin access required", 403

    # Query all feedback, join with message and user
    feedback_entries = (
        db.session.query(
            MessageFeedback,
            MessageHistory,
            User
        )
        .join(MessageHistory, MessageFeedback.message_id == MessageHistory.message_id)
        .join(User, MessageFeedback.user_id == User.user_id)
        .order_by(MessageFeedback.timestamp.desc())
        .all()
    )

    # Prepare data for template
    feedback_data = []
    for feedback, message, user in feedback_entries:
        feedback_data.append({
            'id': feedback.id,
            'user': user.username,
            'question': message.message_text,
            'answer': message.answer,
            'feedback_type': feedback.feedback_type,
            'timestamp': feedback.timestamp,
        })

    # Aggregate stats: likes/dislikes per message
    agg = (
        db.session.query(
            MessageFeedback.message_id,
            MessageHistory.message_text,
            MessageHistory.answer,
            db.func.count(db.case((MessageFeedback.feedback_type == 'like', 1))).label('like_count'),
            db.func.count(db.case((MessageFeedback.feedback_type == 'dislike', 1))).label('dislike_count')
        )
        .join(MessageHistory, MessageFeedback.message_id == MessageHistory.message_id)
        .group_by(MessageFeedback.message_id, MessageHistory.message_text, MessageHistory.answer)
        .order_by(db.func.count(db.case((MessageFeedback.feedback_type == 'like', 1))).desc())
        .all()
    )
    agg_data = []
    for row in agg:
        agg_data.append({
            'message_id': row[0],
            'question': row[1],
            'answer': row[2],
            'like_count': row[3],
            'dislike_count': row[4],
        })

    return render_template('admin/feedback.html', feedback_data=feedback_data, agg_data=agg_data)
