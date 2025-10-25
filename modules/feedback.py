from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from extensions import db, csrf
from modules.database import MessageFeedback, MessageHistory

feedback_bp = Blueprint('feedback', __name__, url_prefix='/api')

@csrf.exempt
@feedback_bp.route('/message_feedback', methods=['POST'])
@login_required
def message_feedback():
    data = request.get_json() or request.form
    message_id = data.get('message_id')
    feedback_type = data.get('feedback_type')

    # Convert message_id to integer
    try:
        message_id = int(message_id)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Invalid message_id format'}), 400

    if not message_id or feedback_type not in ('like', 'dislike'):
        return jsonify({'success': False, 'error': 'Invalid parameters'}), 400

    # Ensure message exists
    message = MessageHistory.query.get(message_id)
    if not message:
        return jsonify({'success': False, 'error': 'Message not found'}), 404

    # Check for existing feedback from this user
    feedback = MessageFeedback.query.filter_by(message_id=message_id, user_id=current_user.get_id()).first()
    if feedback:
        # Update feedback type if changed
        if feedback.feedback_type != feedback_type:
            feedback.feedback_type = feedback_type
            db.session.commit()
    else:
        # Add new feedback
        feedback = MessageFeedback(
            message_id=message_id,
            user_id=current_user.get_id(),
            feedback_type=feedback_type
        )
        db.session.add(feedback)
        db.session.commit()

    # Aggregate counts
    like_count = MessageFeedback.query.filter_by(message_id=message_id, feedback_type='like').count()
    dislike_count = MessageFeedback.query.filter_by(message_id=message_id, feedback_type='dislike').count()

    import logging
    logging.info(f"Saved feedback: user={current_user.get_id()}, message_id={message_id}, feedback_type={feedback_type}")

    return jsonify({
        'success': True,
        'like_count': like_count,
        'dislike_count': dislike_count
    })
