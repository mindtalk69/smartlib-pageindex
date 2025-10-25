from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from modules.database import db, Group, User
from sqlalchemy.exc import SQLAlchemyError

groups_bp = Blueprint('admin_groups', __name__, url_prefix='/admin/groups')

from sqlalchemy.orm import joinedload

@groups_bp.route('/')
@login_required
def groups():
    groups = Group.query.options(joinedload(Group.creator)).all()
    group_dicts = []
    for group in groups:
        group_dicts.append({
            'group_id': group.group_id,
            'name': group.name,
            'description': group.description,
            'creator_name': group.creator.username if group.creator else 'Unknown',
            'created_at': group.created_at,
        })
    return render_template('admin/groups.html', groups=group_dicts)

@groups_bp.route('/data/<int:group_id>')
@login_required
def group_data(group_id):
    group = Group.query.get_or_404(group_id)
    data = {
        'group_id': group.group_id,
        'name': group.name,
        'description': group.description,
        'created_at': group.created_at.isoformat() if group.created_at else None,
        'created_by_user_id': group.created_by_user_id
    }
    return jsonify({'status': 'success', 'group': data})

@groups_bp.route('/add', methods=['POST'])
@login_required
def add_group():
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')

    if not name:
        return jsonify({'status': 'error', 'message': 'Group name is required.'}), 400

    try:
        existing = Group.query.filter_by(name=name).first()
        if existing:
            return jsonify({'status': 'error', 'message': 'Group name already exists.'}), 400

        user_id = getattr(current_user, 'user_id', None)
        if not user_id:
            return jsonify({'status': 'error', 'message': 'Could not identify current user.'}), 500

        new_group = Group(name=name, description=description, created_by_user_id=user_id)
        db.session.add(new_group)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Group added successfully.'})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@groups_bp.route('/edit/<int:group_id>', methods=['POST'])
@login_required
def edit_group(group_id):
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')

    if not name:
        return jsonify({'status': 'error', 'message': 'Group name is required.'}), 400

    group = Group.query.get_or_404(group_id)

    # Check for duplicate name excluding current group
    existing = Group.query.filter(Group.name == name, Group.group_id != group_id).first()
    if existing:
        return jsonify({'status': 'error', 'message': 'Group name already exists.'}), 400

    try:
        group.name = name
        group.description = description
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Group updated successfully.'})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@groups_bp.route('/delete/<int:group_id>', methods=['POST'])
@login_required
def delete_group(group_id):
    group = Group.query.get_or_404(group_id)
    try:
        db.session.delete(group)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Group deleted successfully.'})
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
