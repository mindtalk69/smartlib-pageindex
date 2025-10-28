from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from modules.database import (
    db, Knowledge, Category, Catalog, get_knowledges, get_categories, get_catalogs,
    create_knowledge, get_knowledge_by_id, delete_knowledge
)
import logging
from extensions import csrf

knowledges_bp = Blueprint('admin_knowledges', __name__, url_prefix='/admin/knowledges')

def serialize_knowledge_instance(knowledge):
    """Serialize a Knowledge instance with related names for JSON responses."""
    if not knowledge:
        return None

    knowledge_dict = {column.name: getattr(knowledge, column.name) for column in Knowledge.__table__.columns}
    knowledge_dict['id'] = knowledge.id

    creator = getattr(knowledge, 'creator', None)
    knowledge_dict['created_by_username'] = getattr(creator, 'username', 'N/A') if creator else 'N/A'

    knowledge_dict['category_names'] = sorted(
        (category.name for category in getattr(knowledge, 'categories', []))
    )
    knowledge_dict['catalog_names'] = sorted(
        (catalog.name for catalog in getattr(knowledge, 'catalogs', []))
    )
    knowledge_dict['library_names'] = sorted(
        (library.name for library in getattr(knowledge, 'libraries', []))
    )
    knowledge_dict['group_names'] = sorted(
        (group.name for group in getattr(knowledge, 'groups', []))
    )

    created_at = knowledge_dict.get('created_at')
    if hasattr(created_at, 'isoformat'):
        knowledge_dict['created_at'] = created_at.isoformat()
    return knowledge_dict

@knowledges_bp.route('/')
@login_required
def knowledge_management():
    try:
        knowledges_data = get_knowledges()
        categories_data = get_categories()
        catalogs_data = get_catalogs()
        # Import get_libraries if not already imported
        from modules.admin_libraries import get_libraries
        libraries_data = get_libraries()
        from modules.database import Group
        groups_data = Group.query.order_by(Group.name).all()
        return render_template('admin/knowledges.html',
                               knowledges=knowledges_data,
                               categories=categories_data,
                               catalogs=catalogs_data,
                               libraries=libraries_data,
                               groups=groups_data)
    except Exception as e:
        logging.error(f"Error in /admin/knowledges route: {e}")
        flash('Error loading knowledges.', 'danger')
        return redirect(url_for('admin.dashboard'))

from flask import session
@csrf.exempt
@knowledges_bp.route('/add', methods=['POST'])
@login_required
def add_knowledge():
    import logging
    
    # Force-parse JSON body and inspect raw data for debugging
    data = request.get_json(force=True)
    #logging.info(f"DEBUG_LOG RAW REQUEST DATA: {request.get_data()}")
    #logging.info(f"DEBUG_LOG PARSED JSON DATA: {data}")
    name = data.get('name')
    description = data.get('description')
    category_ids = data.get('category_ids', [])
    catalog_ids = data.get('catalog_ids', [])
    library_ids = data.get('library_ids', [])
    group_ids = data.get('group_ids', [])

    if not name:
        return jsonify({"status": "error", "message": "Knowledge name is required."}), 400
    if not isinstance(category_ids, list) or not isinstance(catalog_ids, list) or not isinstance(library_ids, list) or not isinstance(group_ids, list):
        return jsonify({"status": "error", "message": "Category, Catalog, Library, and Group IDs must be lists."}), 400
    try:
        valid_category_ids = [int(cid) for cid in category_ids]
        valid_catalog_ids = [int(cid) for cid in catalog_ids]
        valid_library_ids = [int(lid) for lid in library_ids]
        valid_group_ids = [int(gid) for gid in group_ids]
        logging.info(f"DEBUG_LOG: valid_library_ids = {valid_library_ids}, valid_group_ids = {valid_group_ids}")
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid ID format in category, catalog, library, or group lists."}), 400

    # Try several ways to get user id
    user_id = session.get('_user_id')
    if not user_id:
        user_id = getattr(current_user, 'id', None)
    if not user_id:
        user_id = getattr(current_user, 'user_id', None)
    if not user_id:
        user_id = getattr(current_user, 'username', None)
    if not user_id:
        logging.error("Could not identify current user.")
        return jsonify({"status": "error", "message": "Could not identify current user."}), 500

    new_knowledge = Knowledge(
        name=name,
        description=description,
        created_by_user_id=user_id
    )
    try:
        db.session.add(new_knowledge)
        db.session.flush()
        knowledge_id = new_knowledge.id

        if valid_category_ids:
            categories = Category.query.filter(Category.id.in_(valid_category_ids)).all()
            new_knowledge.categories = categories

        if valid_catalog_ids:
            catalogs = Catalog.query.filter(Catalog.id.in_(valid_catalog_ids)).all()
            new_knowledge.catalogs = catalogs

        if valid_library_ids:
            from modules.database import Library
            libraries = Library.query.filter(Library.library_id.in_(valid_library_ids)).all()
            new_knowledge.libraries = libraries

        if valid_group_ids:
            from modules.database import Group
            groups = Group.query.filter(Group.group_id.in_(valid_group_ids)).all()
            new_knowledge.groups = groups

        db.session.commit()
        import logging
        logging.info(f"DEBUG_LOG: (add) committed knowledge.libraries = {[lib.library_id for lib in new_knowledge.libraries]}")
        logging.info(f"DEBUG_LOG: (add) committed knowledge.groups = {[grp.group_id for grp in new_knowledge.groups]}")

        created_knowledge = Knowledge.query.options(
            joinedload(Knowledge.creator),
            joinedload(Knowledge.categories),
            joinedload(Knowledge.catalogs),
            joinedload(Knowledge.libraries),
            joinedload(Knowledge.groups)
        ).get(knowledge_id)

        if created_knowledge:
            knowledge_dict = serialize_knowledge_instance(created_knowledge)
            return jsonify({
                "status": "success",
                "message": "Knowledge added successfully.",
                "sent_library_ids": library_ids,
                "sent_group_ids": group_ids,
                "knowledge": knowledge_dict,
            }), 201
        return jsonify({
            "status": "success",
            "message": "Knowledge added, but failed to fetch details.",
            "knowledge_id": knowledge_id,
        }), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Knowledge name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error in /admin/knowledges/add route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@knowledges_bp.route('/data/<int:knowledge_id>', methods=['GET'])
@login_required
def get_knowledge_data(knowledge_id):
    import logging
    logging.info(f"DEBUG_LOG: get_knowledge_data called for knowledge_id={knowledge_id}")
    try:
        knowledge = Knowledge.query.options(
            joinedload(Knowledge.categories),
            joinedload(Knowledge.catalogs),
            joinedload(Knowledge.libraries),
            joinedload(Knowledge.groups)
        ).get(knowledge_id)

        if knowledge:
            print(f"DEBUG: knowledge.libraries = {[lib.library_id for lib in knowledge.libraries]}")
            print(f"DEBUG: knowledge.groups = {[grp.group_id for grp in knowledge.groups]}")
            import logging
            logging.info(f"DEBUG_LOG: knowledge.libraries = {[lib.library_id for lib in knowledge.libraries]}")
            logging.info(f"DEBUG_LOG: knowledge.groups = {[grp.group_id for grp in knowledge.groups]}")
            selected_catalog_ids = [cat.id for cat in knowledge.catalogs]
            selected_category_ids = [cat.id for cat in knowledge.categories]
            selected_library_ids = [lib.library_id for lib in knowledge.libraries]
            selected_group_ids = [grp.group_id for grp in knowledge.groups]
            knowledge_dict = serialize_knowledge_instance(knowledge)
            return jsonify({
                "knowledge": knowledge_dict,
                "selected_catalogs": selected_catalog_ids,
                "selected_categories": selected_category_ids,
                "selected_libraries": selected_library_ids,
                "selected_groups": selected_group_ids,
            })
        else:
            return jsonify({"status": "error", "message": "Knowledge not found."}), 404
    except Exception as e:
        logging.error(f"Error in /admin/knowledges/data route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@csrf.exempt
@knowledges_bp.route('/edit/<int:knowledge_id>', methods=['POST'])
@login_required
def edit_knowledge(knowledge_id):
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    category_ids = data.get('category_ids', [])
    catalog_ids = data.get('catalog_ids', [])
    library_ids = data.get('library_ids', [])
    group_ids = data.get('group_ids', [])

    if not name:
        return jsonify({"status": "error", "message": "Knowledge name is required."}), 400
    if not isinstance(category_ids, list) or not isinstance(catalog_ids, list) or not isinstance(library_ids, list) or not isinstance(group_ids, list):
        return jsonify({"status": "error", "message": "Category, Catalog, Library, and Group IDs must be lists."}), 400
    try:
        valid_category_ids = [int(cid) for cid in category_ids]
        valid_catalog_ids = [int(cid) for cid in catalog_ids]
        valid_library_ids = [int(lid) for lid in library_ids]
        valid_group_ids = [int(gid) for gid in group_ids]
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid ID format in category, catalog, library, or group lists."}), 400

    knowledge = Knowledge.query.options(
        joinedload(Knowledge.categories),
        joinedload(Knowledge.catalogs),
        joinedload(Knowledge.libraries),
        joinedload(Knowledge.groups)
    ).get(knowledge_id)

    if not knowledge:
        return jsonify({"status": "error", "message": "Knowledge not found."}), 404

    try:
        knowledge.name = name
        knowledge.description = description

        new_categories = set(Category.query.filter(Category.id.in_(valid_category_ids)).all())
        knowledge.categories = list(new_categories)

        new_catalogs = set(Catalog.query.filter(Catalog.id.in_(valid_catalog_ids)).all())
        knowledge.catalogs = list(new_catalogs)

        if valid_library_ids:
            from modules.database import Library
            print(f"EDIT: valid_library_ids = {valid_library_ids}")
            libraries = Library.query.filter(Library.library_id.in_(valid_library_ids)).all()
            print(f"EDIT: libraries found = {[lib.library_id for lib in libraries]}")
            knowledge.libraries = libraries
            print(f"EDIT: knowledge.libraries after assignment = {[lib.library_id for lib in knowledge.libraries]}")

        if valid_group_ids:
            from modules.database import Group
            print(f"EDIT: valid_group_ids = {valid_group_ids}")
            groups = Group.query.filter(Group.group_id.in_(valid_group_ids)).all()
            print(f"EDIT: groups found = {[grp.group_id for grp in groups]}")
            knowledge.groups = groups
            print(f"EDIT: knowledge.groups after assignment = {[grp.group_id for grp in knowledge.groups]}")

        db.session.commit()

        updated_knowledge = Knowledge.query.options(
            joinedload(Knowledge.creator),
            joinedload(Knowledge.categories),
            joinedload(Knowledge.catalogs),
            joinedload(Knowledge.libraries),
            joinedload(Knowledge.groups)
        ).get(knowledge_id)

        if updated_knowledge:
            knowledge_dict = serialize_knowledge_instance(updated_knowledge)
            return jsonify({
                "status": "success",
                "message": "Knowledge updated successfully.",
                "knowledge": knowledge_dict,
            })
        return jsonify({"status": "success", "message": "Knowledge updated, but failed to fetch details."})

    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Knowledge name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error in /admin/knowledges/edit route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@csrf.exempt
@knowledges_bp.route('/delete/<int:knowledge_id>', methods=['POST', 'DELETE'])
@login_required
def delete_knowledge_route(knowledge_id):
    try:
        success = delete_knowledge(knowledge_id)
        if success:
            return jsonify({"status": "success", "message": "Knowledge deleted successfully."})
        else:
            return jsonify({"status": "error", "message": "Could not delete knowledge (ID not found)."}), 404
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error in /admin/knowledges/delete route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500
