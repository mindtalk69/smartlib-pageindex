from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from modules.database import db, UserGroup, User, Group
from sqlalchemy.exc import SQLAlchemyError

user_groups_bp = Blueprint('admin_user_groups', __name__, url_prefix='/admin/user_groups')

@user_groups_bp.route('/')
@login_required
def user_groups():
    user_groups = UserGroup.query.options(db.joinedload(UserGroup.user), db.joinedload(UserGroup.group)).all()
    users = User.query.order_by(User.username).all()
    groups = Group.query.order_by(Group.name).all()
    return render_template('admin/user_groups.html', user_groups=user_groups, users=users, groups=groups)

@user_groups_bp.route('/data/<string:user_id>/<int:group_id>')
@login_required
def user_group_data(user_id, group_id):
    user_group = UserGroup.query.filter_by(user_id=user_id, group_id=group_id).first_or_404()
    data = {
        'user_id': user_group.user_id,
        'group_id': user_group.group_id,
        'joined_at': user_group.joined_at.isoformat() if user_group.joined_at else None
    }
    return jsonify({'status': 'success', 'user_group': data})

@user_groups_bp.route('/add', methods=['POST'])
@login_required
def add_user_group():
    data = request.get_json()
    user_id = data.get('user_id')
    group_id = data.get('group_id')

    if not user_id or not group_id:
        return jsonify({'status': 'error', 'message': 'User ID and Group ID are required.'}), 400

    try:
        existing = UserGroup.query.filter_by(user_id=user_id, group_id=group_id).first()
        if existing:
            return jsonify({'status': 'error', 'message': 'User is already in this group.'}), 200

        new_user_group = UserGroup(user_id=user_id, group_id=group_id)
        db.session.add(new_user_group)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'User added to group successfully.'})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@user_groups_bp.route('/delete/<string:user_id>/<int:group_id>', methods=['POST'])
@login_required
def delete_user_group(user_id, group_id):
    user_group = UserGroup.query.filter_by(user_id=user_id, group_id=group_id).first_or_404()
    try:
        db.session.delete(user_group)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'User removed from group successfully.'})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
