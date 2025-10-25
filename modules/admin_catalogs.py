from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
from modules.database import (
    db, Catalog, create_catalog, get_catalogs, get_catalog_by_id, update_catalog, delete_catalog
)

catalogs_bp = Blueprint('admin_catalogs', __name__, url_prefix='/admin/catalogs')

@catalogs_bp.route('/')
@login_required
def catalog_management():
    try:
        catalogs_data = get_catalogs()
        return render_template('admin/catalogs.html', catalogs=catalogs_data)
    except Exception as e:
        print(f"Error in /admin/catalogs route: {e}")
        flash('Error loading catalogs.', 'danger')
        return redirect(url_for('admin.dashboard'))

@catalogs_bp.route('/add', methods=['POST'])
@login_required
def add_catalog():
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    if not name:
        return jsonify({"status": "error", "message": "Catalog name is required."}), 400
    user_id = getattr(current_user, 'id', None)
    if not user_id:
        print("Error in add_catalog: Could not get valid user ID.")
        return jsonify({"status": "error", "message": "Could not identify current user."}), 500
    try:
        catalog_id = create_catalog(name, description, user_id)
        new_catalog = get_catalog_by_id(catalog_id)
        catalog_dict = {c.name: getattr(new_catalog, c.name) for c in new_catalog.__table__.columns} if new_catalog else {"id": catalog_id, "name": name, "description": description}
        if catalog_dict.get('created_at'):
            catalog_dict['created_at'] = catalog_dict['created_at'].isoformat()
        catalog_dict['created_by_username'] = new_catalog.creator.username if new_catalog and new_catalog.creator else 'N/A'
        return jsonify({"status": "success", "message": "Catalog added successfully.", "catalog": catalog_dict}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Catalog name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/catalogs/add route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@catalogs_bp.route('/data/<int:catalog_id>', methods=['GET'])
@login_required
def get_catalog_data(catalog_id):
    try:
        catalog = get_catalog_by_id(catalog_id)
        if catalog:
            catalog_dict = {c.name: getattr(catalog, c.name) for c in catalog.__table__.columns}
            if catalog_dict.get('created_at'):
                catalog_dict['created_at'] = catalog_dict['created_at'].isoformat()
            return jsonify(catalog_dict)
        else:
            return jsonify({"status": "error", "message": "Catalog not found."}), 404
    except Exception as e:
        print(f"Error in /admin/catalogs/data route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@catalogs_bp.route('/edit/<int:catalog_id>', methods=['POST'])
@login_required
def edit_catalog(catalog_id):
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    if not name:
        return jsonify({"status": "error", "message": "Catalog name is required."}), 400
    try:
        success = update_catalog(catalog_id, name, description)
        if success:
            updated_catalog = get_catalog_by_id(catalog_id)
            catalog_dict = {c.name: getattr(updated_catalog, c.name) for c in updated_catalog.__table__.columns} if updated_catalog else {"id": catalog_id, "name": name, "description": description}
            if catalog_dict.get('created_at'):
                catalog_dict['created_at'] = catalog_dict['created_at'].isoformat()
            catalog_dict['created_by_username'] = updated_catalog.creator.username if updated_catalog and updated_catalog.creator else 'N/A'
            return jsonify({"status": "success", "message": "Catalog updated successfully.", "catalog": catalog_dict})
        else:
            return jsonify({"status": "error", "message": "Catalog update failed."}), 500
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Catalog name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/catalogs/edit route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@catalogs_bp.route('/delete/<int:catalog_id>', methods=['POST', 'DELETE'])
@login_required
def delete_catalog_route(catalog_id):
    try:
        success = delete_catalog(catalog_id)
        if success:
            return jsonify({"status": "success", "message": "Catalog deleted successfully."})
        else:
            return jsonify({"status": "error", "message": "Could not delete catalog."}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/catalogs/delete route: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500
