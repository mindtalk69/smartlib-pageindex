from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
from modules.database import (
    db, LlmLanguage, create_llm_language, get_llm_languages, get_llm_language_by_id,
    update_llm_language, delete_llm_language
)

languages_bp = Blueprint('admin_languages', __name__, url_prefix='/admin/languages')

from flask_wtf.csrf import generate_csrf

@languages_bp.route('/')
@login_required
def language_management():
    try:
        languages_data = get_llm_languages()
        return render_template('admin/languages.html', languages=languages_data)
    except Exception as e:
        print(f"Error in /admin/languages route: {e}")
        flash('Error loading languages.', 'danger')
        return redirect(url_for('admin.dashboard'))

@languages_bp.route('/language-test')
@login_required
def language_test():
    """Serve the standalone language test page for debugging."""
    return render_template('admin/language_test.html')

@languages_bp.route('/add', methods=['POST'])
@login_required
def add_language():
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    code = data.get('language_code')
    name = data.get('language_name')
    if not code or not name:
        return jsonify({"status": "error", "message": "Language code and name are required."}), 400
    creator = current_user.username if hasattr(current_user, 'username') else 'Admin'
    try:
        language_id = create_llm_language(code.strip(), name.strip(), creator)
        new_language = get_llm_language_by_id(language_id)
        lang_dict = {c.name: getattr(new_language, c.name) for c in new_language.__table__.columns} if new_language else {"id": language_id, "language_code": code, "language_name": name}
        if lang_dict.get('created_at'):
            lang_dict['created_at'] = lang_dict['created_at'].isoformat()
        return jsonify({"status": "success", "message": "Language added successfully.", "language": lang_dict}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Language code '{code}' or name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/languages/add route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@languages_bp.route('/edit/<int:language_id>', methods=['POST'])
@login_required
def edit_language(language_id):
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    code = data.get('language_code')
    name = data.get('language_name')
    is_active = data.get('is_active')
    if not code or not name or is_active is None:
        return jsonify({"status": "error", "message": "Language code, name, and active status are required."}), 400
    try:
        success = update_llm_language(language_id, code.strip(), name.strip(), bool(is_active))
        if success:
            updated_language = get_llm_language_by_id(language_id)
            lang_dict = {c.name: getattr(updated_language, c.name) for c in updated_language.__table__.columns} if updated_language else {"id": language_id, "language_code": code, "language_name": name, "is_active": is_active}
            if lang_dict.get('created_at'):
                lang_dict['created_at'] = lang_dict['created_at'].isoformat()
            return jsonify({"status": "success", "message": "Language updated successfully.", "language": lang_dict})
        else:
            return jsonify({"status": "error", "message": "Language update failed (ID not found?)."}), 404
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Language code '{code}' or name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/languages/edit route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@languages_bp.route('/data/<int:language_id>', methods=['GET'])
@login_required
def get_language_data(language_id):
    try:
        language = get_llm_language_by_id(language_id)
        if language:
            return jsonify({
                'id': language.id,
                'language_code': language.language_code,
                'language_name': language.language_name,
                'is_active': language.is_active,
                'created_at': language.created_at.isoformat() if language.created_at else None,
                'created_by': language.created_by,
                'status': 'success'
            })
        else:
            return jsonify({"status": "error", "message": "Language not found."}), 404
    except Exception as e:
        print(f"Error in /admin/languages/data route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@languages_bp.route('/delete/<int:language_id>', methods=['POST', 'DELETE'])
@login_required
def delete_language_route(language_id):
    try:
        success = delete_llm_language(language_id)
        if success:
            return jsonify({"status": "success", "message": "Language deleted successfully."})
        else:
            return jsonify({"status": "error", "message": "Could not delete language (ID not found?)."}), 404
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/languages/delete route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500
