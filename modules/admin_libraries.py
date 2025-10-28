from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
from modules.database import (
    db,
    Library,
    get_libraries,
    get_libraries_with_details,
    get_knowledges,
    create_library,
    get_library_by_id,
    get_library_with_details,
    update_library,
    delete_library,
)


libraries_bp = Blueprint('admin_libraries', __name__, url_prefix='/admin/libraries')


def serialize_library(library):
    if not library:
        return None
    knowledge_names = sorted(
        [
            knowledge.name
            for knowledge in getattr(library, 'knowledges', [])
            if getattr(knowledge, 'name', None)
        ]
    )
    knowledge_ids = [
        knowledge.id
        for knowledge in getattr(library, 'knowledges', [])
        if hasattr(knowledge, 'id')
    ]
    creator_username = (
        library.creator.username if getattr(library, 'creator', None) else 'N/A'
    )
    return {
        'library_id': library.library_id,
        'id': library.library_id,
        'name': library.name,
        'description': library.description or '',
        'knowledge_names': knowledge_names,
        'knowledge_ids': knowledge_ids,
        'created_by_username': creator_username,
        'created_at': library.created_at.isoformat() if library.created_at else None,
    }


@libraries_bp.route('/')
@login_required
def library_management():
    try:
        libraries_data = get_libraries_with_details()
        knowledges_data = get_knowledges()
        return render_template('admin/libraries.html',
                               libraries=libraries_data,
                               knowledges=knowledges_data)
    except Exception as e:
        print(f"Error in /admin/libraries route: {e}")
        flash('Error loading libraries.', 'danger')
        return redirect(url_for('admin.dashboard'))

@libraries_bp.route('/add', methods=['POST'])
@login_required
def add_library():
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    knowledge_id_str = data.get('knowledge_id')
    if not name:
        return jsonify({"status": "error", "message": "Library name is required."}), 400
    knowledge_id = None
    if knowledge_id_str:
        try:
            knowledge_id = int(knowledge_id_str)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Invalid Knowledge ID format."}), 400
    user_id = getattr(current_user, 'user_id', None)
    if not user_id:
        print("Error in add_library: Could not get valid user ID.")
        return jsonify({"status": "error", "message": "Could not identify current user."}), 500
    try:
        library_id = create_library(name, description, user_id, knowledge_id)
        print(f"DEBUG: create_library invoked, new library_id = {library_id}")
        detailed_library = get_library_with_details(library_id)
        library_payload = serialize_library(detailed_library)
        if library_payload is None:
            library_payload = {
                'library_id': library_id,
                'id': library_id,
                'name': name,
                'description': description or '',
                'knowledge_names': [],
                'knowledge_ids': [],
                'created_by_username': getattr(current_user, 'username', 'N/A'),
                'created_at': None,
            }
        return (
            jsonify(
                {
                    'status': 'success',
                    'message': 'Library added successfully.',
                    'library': library_payload,
                }
            ),
            201,
        )
    except IntegrityError:
        db.session.rollback()
        print(f"DEBUG: IntegrityError on create_library with name={name}")
        return jsonify({"status": "error", "message": f"Library name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/libraries/add route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@libraries_bp.route('/data/<int:library_id>', methods=['GET'])
@login_required
def get_library_data(library_id):
    try:
        library = get_library_with_details(library_id)
        if library:
            library_payload = serialize_library(library)
            if library_payload is None:
                return jsonify({'status': 'error', 'message': 'Library serialization failed.'}), 500
            return jsonify(library_payload)
        else:
            return jsonify({'status': 'error', 'message': 'Library not found.'}), 404
    except Exception as e:
        print(f"Error in /admin/libraries/data route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@libraries_bp.route('/edit/<int:library_id>', methods=['POST'])
@login_required
def edit_library(library_id):
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    knowledge_id_str = data.get('knowledge_id')
    if not name:
        return jsonify({"status": "error", "message": "Library name is required."}), 400
    knowledge_id = None
    if knowledge_id_str:
        try:
            knowledge_id = int(knowledge_id_str)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Invalid Knowledge ID format."}), 400
    try:
        success = update_library(library_id, name, description, knowledge_id)
        print(f"DEBUG: update_library invoked for id={library_id}, success={success}")
        if success:
            detailed_library = get_library_with_details(library_id)
            library_payload = serialize_library(detailed_library)
            if library_payload is None:
                return jsonify({'status': 'success', 'message': 'Library updated successfully.'})
            return jsonify(
                {
                    'status': 'success',
                    'message': 'Library updated successfully.',
                    'library': library_payload,
                }
            )
        else:
            return jsonify({'status': 'error', 'message': 'Library update failed.'}), 500
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Library name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/libraries/edit route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@libraries_bp.route('/delete/<int:library_id>', methods=['POST', 'DELETE'])
@login_required
def delete_library_route(library_id):
    try:
        success = delete_library(library_id)
        if success:
            return jsonify({"status": "success", "message": "Library deleted successfully."})
        else:
            return jsonify({"status": "error", "message": "Could not delete library. It might have associated references."}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/libraries/delete route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500
