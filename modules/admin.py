# modules/admin.py
import logging # Import the logging module
from datetime import datetime
import json # Import json for dumps
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, session, current_app, abort
from flask_login import login_required, current_user
from flask_wtf.csrf import generate_csrf, CSRFError
from flask_wtf import FlaskForm # Import FlaskForm
from sqlalchemy.exc import IntegrityError
import sqlalchemy.exc
import os # Import os for path validation
import glob # Import glob for file pattern matching
from sqlalchemy.orm import joinedload
from sqlalchemy import func, case, distinct # Import func, case, and distinct for aggregation/queries
from pathlib import Path # Import Path for directory scanning
from modules.admin_embeddings import EMBEDDING_MODELS # Import available models
from modules.celery_tasks import list_chroma_stores, delete_chroma_collection_via_worker
from extensions import db # Correct: Import db from extensions.py
# Import SQLAlchemy Models and rewritten functions
from modules.database import (
    User, UploadedFile, MessageHistory, Library, LibraryReference, Category, Catalog, Knowledge, LlmLanguage, UrlDownload, VectorReference, AppSettings, LLMPrompt, # Added AppSettings
    get_url_downloads,
    toggle_user_disabled_status,
    get_user_by_id,
    get_libraries,
    create_library,
    get_library_by_id,
    update_library,
    delete_library,
    get_catalogs,
    create_catalog,
    get_catalog_by_id,
    update_catalog,
    delete_catalog,
    get_categories,
    create_category,
    get_category_by_id,
    update_category,
    delete_category,
    get_knowledges,
    create_knowledge,
    get_knowledge_by_id,
    # update_knowledge is no longer used directly here
    delete_knowledge,
    # add_knowledge_catalogs, # Logic merged into add/edit routes
    get_knowledge_catalogs, # Still needed for get_knowledge_data
    # update_knowledge_catalogs, # Logic merged into edit route
    # Add functions for category associations (placeholders for now)
    # add_knowledge_categories, # Logic merged into add/edit routes
    # get_knowledge_categories, # Defined locally below, remove import
    # update_knowledge_categories, # Logic merged into edit route
    create_llm_language,
    get_llm_languages,
    get_llm_language_by_id,
    update_llm_language,
    delete_llm_language,
    get_active_llm_languages,
    VisualGroundingActivity,  # Added for reset functionality
    FolderUploadJob,         # Added for reset functionality
    Document,                # Added for reset functionality
    knowledge_libraries_association,
)
from modules.llm_utils import generate_simple_text
from modules.map_utils import purge_map_assets
import re # Ensure re is imported
from sqlalchemy import text # Ensure text is imported
import traceback
from urllib.parse import urlparse

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.context_processor
def inject_admin_flags():
    flag = current_app.config.get('IS_ENABLED_OCR', False)
    if isinstance(flag, str):
        flag = flag.lower() in ('1', 'true', 'yes')
    return {
        'is_enabled_ocr': bool(flag),
        'ocr_mode': current_app.config.get('OCR_MODE', 'default'),
        'is_auto_ocr': current_app.config.get('IS_AUTO_OCR', False),
    }


@admin_bp.route('/')
@login_required
def admin_root():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))
    return redirect(url_for('admin.dashboard'))


@admin_bp.route('/dashboard', endpoint='dashboard')
@login_required
def admin_dashboard():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

    current_app.logger.info(
        'admin_dashboard context: IS_ENABLED_OCR=%s, OCR_MODE=%s',
        current_app.config.get('IS_ENABLED_OCR'),
        current_app.config.get('OCR_MODE'),
    )

    user_count = db.session.query(func.count(User.user_id)).scalar() or 0
    file_count = db.session.query(func.count(UploadedFile.file_id)).scalar() or 0
    message_count = (
        db.session.query(func.count(MessageHistory.message_id)).scalar() or 0
    )

    library_reference_counts = (
        db.session.query(
            Library.name,
            func.count(LibraryReference.reference_id),
        )
        .join(LibraryReference, LibraryReference.library_id == Library.library_id)
        .group_by(Library.library_id, Library.name)
        .order_by(func.count(LibraryReference.reference_id).desc())
        .all()
    )
    library_chart_data = [
        [library_name or 'Unassigned', ref_count]
        for library_name, ref_count in library_reference_counts
        if ref_count
    ]

    user_library_distribution = (
        db.session.query(
            Library.name,
            func.count(distinct(LibraryReference.user_id)),
        )
        .join(LibraryReference, LibraryReference.library_id == Library.library_id)
        .group_by(Library.library_id, Library.name)
        .having(func.count(distinct(LibraryReference.user_id)) > 0)
        .order_by(func.count(distinct(LibraryReference.user_id)).desc())
        .all()
    )
    user_library_chart_data = [
        [library_name or 'Unassigned', user_count]
        for library_name, user_count in user_library_distribution
        if user_count
    ]

    reference_type_counts = {
        'files': 0,
        'urls': 0,
    }
    for ref_type, ref_count in (
        db.session.query(
            LibraryReference.reference_type,
            func.count(LibraryReference.reference_id),
        )
        .group_by(LibraryReference.reference_type)
        .all()
    ):
        if ref_type == 'file':
            reference_type_counts['files'] = ref_count
        elif ref_type == 'url_download':
            reference_type_counts['urls'] = ref_count

    file_counts_by_knowledge = dict(
        db.session.query(
            UploadedFile.knowledge_id,
            func.count(UploadedFile.file_id),
        )
        .filter(UploadedFile.knowledge_id.isnot(None))
        .group_by(UploadedFile.knowledge_id)
        .all()
    )
    download_counts_by_knowledge = dict(
        db.session.query(
            UrlDownload.knowledge_id,
            func.count(UrlDownload.download_id),
        )
        .filter(UrlDownload.knowledge_id.isnot(None))
        .group_by(UrlDownload.knowledge_id)
        .all()
    )
    knowledge_library_counts = dict(
        db.session.query(
            knowledge_libraries_association.c.knowledge_id,
            func.count(distinct(knowledge_libraries_association.c.library_id)),
        )
        .group_by(knowledge_libraries_association.c.knowledge_id)
        .all()
    )
    knowledge_stats = []
    for knowledge in Knowledge.query.order_by(Knowledge.name).all():
        knowledge_stats.append(
            {
                'name': knowledge.name,
                'file_count': file_counts_by_knowledge.get(knowledge.id, 0),
                'download_count': download_counts_by_knowledge.get(
                    knowledge.id, 0
                ),
                'library_count': knowledge_library_counts.get(knowledge.id, 0),
            }
        )

    user_reference_rows = (
        db.session.query(
            User.username,
            Library.name,
            func.count(LibraryReference.reference_id).label('total_refs'),
            func.sum(
                case((LibraryReference.reference_type == 'file', 1), else_=0)
            ).label('file_refs'),
            func.sum(
                case((LibraryReference.reference_type == 'url_download', 1), else_=0)
            ).label('url_refs'),
        )
        .join(LibraryReference, LibraryReference.user_id == User.user_id)
        .join(Library, Library.library_id == LibraryReference.library_id)
        .group_by(User.username, Library.name)
        .order_by(func.count(LibraryReference.reference_id).desc())
        .limit(25)
        .all()
    )
    user_reference_stats = [
        {
            'username': username,
            'library_name': library_name or 'Unassigned',
            'total_references': total_refs or 0,
            'file_references': file_refs or 0,
            'url_references': url_refs or 0,
        }
        for (
            username,
            library_name,
            total_refs,
            file_refs,
            url_refs,
        ) in user_reference_rows
    ]

    light_theme = request.cookies.get('light_theme') == 'true'

    return render_template(
        'admin/dashboard.html',
        user_count=user_count,
        file_count=file_count,
        message_count=message_count,
        library_counts_query=json.dumps(library_chart_data),
        user_library_counts=json.dumps(user_library_chart_data),
        file_url_counts=json.dumps(reference_type_counts),
        knowledge_stats=json.dumps(knowledge_stats),
        user_ref_counts=user_reference_stats,
        light_theme=light_theme,
    )


def purge_legacy_doc_intelligence_key() -> None:
    """Remove any stored Azure Doc Intelligence keys from AppSettings."""
    try:
        legacy_entry = db.session.get(AppSettings, 'doc_intelligence_key')
        if not legacy_entry:
            return
        db.session.delete(legacy_entry)
        db.session.commit()
        logging.info("Purged legacy 'doc_intelligence_key' from AppSettings.")
    except Exception:
        db.session.rollback()
        logging.error(
            "Failed to purge legacy 'doc_intelligence_key' entry:\n%s",
            traceback.format_exc(),
        )


# --- Custom CSRF error handler for AJAX/API requests ---
from flask import make_response
from wtforms import StringField, RadioField, SelectField, HiddenField
from wtforms.validators import DataRequired, Optional, URL

@admin_bp.app_errorhandler(CSRFError)
def handle_csrf_error(e):
    # If AJAX or expects JSON, return JSON error
    wants_json = (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
        request.headers.get('Accept', '').startswith('application/json') or
        request.is_json
    )
    if wants_json:
        resp = jsonify({'status': 'error', 'message': 'CSRF token missing or invalid. Please refresh the page and try again.'})
        resp.status_code = 400
        return resp
    # Otherwise, render default error page
    return make_response(render_template('csrf_error.html', reason=e.description), 400)

def init_admin(app):
    app.register_blueprint(admin_bp)
    with app.app_context():
        purge_legacy_doc_intelligence_key()

    from modules.admin_user_groups import user_groups_bp
    app.register_blueprint(user_groups_bp)
    from modules.admin_groups import groups_bp
    app.register_blueprint(groups_bp, url_prefix='/admin/groups')
    from modules.admin_visual_grounding import visual_grounding_bp
    app.register_blueprint(visual_grounding_bp)
    from modules.admin_libraries import libraries_bp
    app.register_blueprint(libraries_bp)
    from modules.admin_knowledges import knowledges_bp
    app.register_blueprint(knowledges_bp)
    from modules.admin_catalogs import catalogs_bp
    app.register_blueprint(catalogs_bp)
    from modules.admin_languages import languages_bp
    app.register_blueprint(languages_bp)
    from modules.admin_messages import messages_bp
    app.register_blueprint(messages_bp)
    from modules.admin_users import users_bp
    app.register_blueprint(users_bp)
    from modules.admin_vector_references import vector_references_bp
    app.register_blueprint(vector_references_bp)
    from modules.admin_files import files_bp
    app.register_blueprint(files_bp)
    from modules.admin_downloads import downloads_bp
    app.register_blueprint(downloads_bp)
    # Register models admin blueprint (ModelConfig CRUD / default selection)
    try:
        from modules.admin_models import models_bp
        app.register_blueprint(models_bp)
    except Exception as e:
        # If the module is missing or has errors, log and continue to avoid breaking app import
        logging.error(f"Failed to register admin_models blueprint: {e}", exc_info=True)

    # Register embeddings admin blueprint (Embedding model selection)
    try:
        from modules.admin_embeddings import embeddings_bp
        app.register_blueprint(embeddings_bp)
    except Exception as e:
        # If the module is missing or has errors, log and continue to avoid breaking app import
        logging.error(f"Failed to register admin_embeddings blueprint: {e}", exc_info=True)

@admin_bp.route('/users/toggle_admin/<string:user_id>')
@login_required
def toggle_admin(user_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))
    if user_id == current_user.get_id():
         flash("You cannot change your own admin status.", 'danger')
         return redirect(url_for('admin_users.user_management'))


@admin_bp.route('/users/toggle-status/<string:user_id>')
@login_required
def toggle_user_status(user_id):
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))
    if user_id == current_user.get_id():
         flash("You cannot disable your own account.", 'danger')
         return redirect(url_for('admin_users.user_management'))
    try:
        success = toggle_user_disabled_status(user_id)
        if success:
            user = get_user_by_id(user_id)
            if user:
                 status_text = "disabled" if user.is_disabled else "enabled"
                 flash(f'User successfully {status_text}.', 'success')
            else:
                 flash('User status updated, but could not fetch current status.', 'warning')
        else:
            flash('Failed to update user status (User not found?).', 'danger')
    except Exception as e:
        print(f"Error in toggle_user_status route: {e}")
        flash('An unexpected error occurred while toggling user status.', 'danger')
    return redirect(url_for('admin.user_management'))

@admin_bp.route('/files')
def file_management():
    files = []
    try:
        files_data = UploadedFile.query.join(User, UploadedFile.user_id == User.user_id).with_entities(
            UploadedFile.file_id,
            UploadedFile.original_filename,
            UploadedFile.file_size,
            UploadedFile.upload_time,
            User.username
        ).order_by(UploadedFile.upload_time.desc()).all()
        files = [
            {
                'id': f[0], 'filename': f[1], 'file_size': f[2],
                'upload_time': f[3], 'username': f[4]
            } for f in files_data
        ]
    except Exception as e:
        print(f"Error fetching files: {e}")
        flash("Error loading files.", "danger")
        files = []
    return render_template('admin/files.html', files=files)

@admin_bp.route('/downloads', endpoint='download_management')
def download_management():
    try:
        downloads_raw = get_url_downloads()
        return render_template('admin/downloads.html',
                            downloads=downloads_raw,
                            light_theme=request.cookies.get('light_theme') == 'true')
    except Exception as e:
        print(f"Error loading downloads: {e}")
        flash(f'Error loading downloads: {str(e)}', 'danger')
        return redirect(url_for('admin.dashboard'))

# Removed raw SQL import as it's no longer needed here
# from sqlalchemy import text

# ... (keep other imports)

@admin_bp.route('/vector_references')
def vector_references():
    """Legacy route retained for backward compatibility; redirects to log list."""
    return redirect(url_for('admin.list_vector_reference_logs'))

@admin_bp.route('/vector_reference_logs')
def list_vector_reference_logs():
    """
    Lists all available vector reference log files.
    """
    log_dir = os.path.join('data', 'logs')
    log_pattern = os.path.join(log_dir, 'vector_references_*.log')
    log_files_paths = glob.glob(log_pattern)
    
    log_files = [os.path.basename(p) for p in log_files_paths]
    log_files.sort(reverse=True) # Show newest first

    return render_template('admin/vector_reference_logs.html', log_files=log_files)

@admin_bp.route('/vector_reference_logs/view/<string:log_filename>')
def view_vector_reference_log(log_filename):
    """
    Displays the content of a specific vector reference log file.
    """
    log_dir = os.path.join('data', 'logs')
    # Basic security check to prevent directory traversal
    if '..' in log_filename or not log_filename.startswith('vector_references_'):
        abort(400, "Invalid log filename.")

    log_file_path = os.path.join(log_dir, log_filename)

    if not os.path.exists(log_file_path):
        abort(404, "Log file not found.")

    references = []
    try:
        with open(log_file_path, 'r') as f:
            for line in f:
                if line.strip():
                    references.append(json.loads(line))
    except Exception as e:
        # Handle potential JSON decoding errors or file read errors
        abort(500, f"Error reading log file: {e}")

    # Calculate statistics
    log_stats = {}
    if references:
        log_stats['total_entries'] = len(references)
        log_stats['unique_files'] = len(set(ref['file_id'] for ref in references if ref.get('file_id')))
        
        # File distribution
        file_counts = {}
        for ref in references:
            if ref.get('file_id'):
                file_counts[ref['file_id']] = file_counts.get(ref['file_id'], 0) + 1
        log_stats['file_counts'] = file_counts
        
        # Date range
        timestamps = [ref['timestamp'] for ref in references if ref.get('timestamp')]
        if timestamps:
            log_stats['date_range'] = f"{timestamps[-1][:10]} to {timestamps[0][:10]}"
        else:
            log_stats['date_range'] = "N/A"

    return render_template('admin/vector_reference_log_view.html', 
                       references=references, 
                       log_filename=log_filename,
                       log_stats=log_stats)

# --- Library CRUD Routes ---
# (REMOVED: All /libraries* routes are now handled by modules/admin_libraries.py to avoid conflicts)
# --- Knowledge CRUD Routes ---
# @admin_bp.route('/knowledges')
def knowledge_management():
    try:
        knowledges_data = get_knowledges()
        categories_data = get_categories()
        catalogs_data = get_catalogs()
        active_languages = get_active_llm_languages()
        return render_template('admin/knowledges.html',
                               knowledges=knowledges_data,
                               categories=categories_data,
                               catalogs=catalogs_data,
                               languages=active_languages)
    except Exception as e:
        print(f"Error in /admin/knowledges route:\n{traceback.format_exc()}")
        flash('Error loading knowledges.', 'danger')
        return redirect(url_for('admin.dashboard'))

# --- Add/Update Knowledge Category Association Functions (Placeholder - Implement in database.py later if needed) ---
# These might be better handled directly within the update_knowledge route for simplicity
# def add_knowledge_categories(knowledge_id, category_ids): # Merged into add_knowledge
#     # Placeholder: Logic to add associations in knowledge_category_association table
#     logging.warning("Placeholder function add_knowledge_categories called.")
#     pass

def get_knowledge_categories(knowledge_id): # Keep this one for get_knowledge_data
    # Placeholder: Logic to add associations in knowledge_category_association table
    logging.warning("Placeholder function add_knowledge_categories called.")
    # Placeholder: Logic to get associated Category objects or IDs
    logging.warning("Placeholder function get_knowledge_categories called.")
    knowledge = Knowledge.query.options(joinedload(Knowledge.categories)).get(knowledge_id)
    return knowledge.categories if knowledge else []

# def update_knowledge_categories(knowledge_id, category_ids): # Merged into edit_knowledge
#     # Placeholder: Logic to update associations (clear existing, add new)
#     logging.warning("Placeholder function update_knowledge_categories called.")
#     knowledge = Knowledge.query.options(joinedload(Knowledge.categories)).get(knowledge_id)
#     if not knowledge: return False
#     try:
#         new_categories = set(Category.query.filter(Category.id.in_(category_ids)).all())
#         knowledge.categories = list(new_categories)
#         # db.session.commit() # Commit should happen in the calling route
#         return True
#     except Exception as e:
#         logging.error(f"Error updating knowledge categories for {knowledge_id}: {e}")
#         # db.session.rollback() # Rollback should happen in the calling route
#         return False
    # Placeholder: Logic to update associations (clear existing, add new)
    logging.warning("Placeholder function update_knowledge_categories called.")
    knowledge = Knowledge.query.options(joinedload(Knowledge.categories)).get(knowledge_id)
    if not knowledge: return False
    try:
        new_categories = set(Category.query.filter(Category.id.in_(category_ids)).all())
        knowledge.categories = list(new_categories)
        # db.session.commit() # Commit should happen in the calling route
        return True
    except Exception as e:
        logging.error(f"Error updating knowledge categories for {knowledge_id}: {e}")
        # db.session.rollback() # Rollback should happen in the calling route
        return False


# @admin_bp.route('/knowledges/add', methods=['POST'])
def add_knowledge():
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    # Get list of category IDs
    category_ids = data.get('category_ids', [])
    catalog_ids = data.get('catalog_ids', [])

    if not name: return jsonify({"status": "error", "message": "Knowledge name is required."}), 400
    # Validate category_ids is a list of integers
    if not isinstance(category_ids, list): return jsonify({"status": "error", "message": "Category IDs must be provided as a list."}), 400
    try: valid_category_ids = [int(cid) for cid in category_ids]
    except (ValueError, TypeError): return jsonify({"status": "error", "message": "Invalid Category ID format in list."}), 400
    # Validate catalog_ids is a list of integers
    if not isinstance(catalog_ids, list): return jsonify({"status": "error", "message": "Catalog IDs must be provided as a list."}), 400
    try: valid_catalog_ids = [int(cid) for cid in catalog_ids]
    except (ValueError, TypeError): return jsonify({"status": "error", "message": "Invalid Catalog ID format in list."}), 400

    session_user_id = session.get('_user_id')
    current_user_id_attr = getattr(current_user, 'id', None)
    user_id = session_user_id or current_user_id_attr
    if not user_id:
         logging.error(f"Error in add_knowledge: Could not get valid user ID.") # Use logger
         return jsonify({"status": "error", "message": "Could not identify current user."}), 500

    # Create the knowledge entry first (without category/catalog links initially)
    new_knowledge = Knowledge(
        name=name,
        description=description,
        created_by_user_id=user_id
    )
    try:
        db.session.add(new_knowledge)
        db.session.flush() # Flush to get the new_knowledge.id
        knowledge_id = new_knowledge.id

        # Associate Categories
        if valid_category_ids:
            categories = Category.query.filter(Category.id.in_(valid_category_ids)).all()
            if len(categories) != len(valid_category_ids):
                logging.warning("Some category IDs provided for new knowledge were not found.")
            new_knowledge.categories = categories # Assign the list directly

        # Associate Catalogs
        if valid_catalog_ids:
            catalogs = Catalog.query.filter(Catalog.id.in_(valid_catalog_ids)).all()
            if len(catalogs) != len(valid_catalog_ids):
                 logging.warning("Some catalog IDs provided for new knowledge were not found.")
            new_knowledge.catalogs = catalogs # Assign the list directly

        db.session.commit() # Commit all changes together

        # Fetch the newly created knowledge with relationships for the response
        # Ensure eager loading of all relevant relationships
        created_knowledge = Knowledge.query.options(
            joinedload(Knowledge.creator),
            joinedload(Knowledge.categories), # Eager load categories
            joinedload(Knowledge.catalogs)  # Eager load catalogs
        ).get(knowledge_id)

        if created_knowledge:
             # Build response dictionary
             knowledge_dict = {c.name: getattr(created_knowledge, c.name) for c in created_knowledge.__table__.columns} # Keep all columns from model
             knowledge_dict['id'] = created_knowledge.id
             knowledge_dict['created_by_username'] = created_knowledge.creator.username if created_knowledge.creator else 'N/A'
             # Get names from loaded relationships
             knowledge_dict['category_names'] = sorted([cat.name for cat in created_knowledge.categories]) # Sort for consistency
             knowledge_dict['catalog_names'] = sorted([cat.name for cat in created_knowledge.catalogs]) # Sort for consistency
             if isinstance(knowledge_dict.get('created_at'), datetime):
                 knowledge_dict['created_at'] = knowledge_dict['created_at'].isoformat()
             return jsonify({"status": "success", "message": "Knowledge added successfully.", "knowledge": knowledge_dict}), 201
        else:
             # Should not happen if commit succeeded, but handle defensively
             return jsonify({"status": "success", "message": "Knowledge added, but failed to fetch details.", "knowledge_id": knowledge_id}), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Knowledge name '{name}' already exists."}), 409
    except ValueError as ve:
         db.session.rollback()
         return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/knowledges/add route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

# @admin_bp.route('/knowledges/data/<int:knowledge_id>', methods=['GET'])
def get_knowledge_data(knowledge_id):
    try:
        # Eager load relationships
        knowledge = Knowledge.query.options(
            joinedload(Knowledge.categories),
            joinedload(Knowledge.catalogs)
        ).get(knowledge_id)

        if knowledge:
            # Use the already loaded relationships
            selected_catalog_ids = [cat.id for cat in knowledge.catalogs]
            selected_category_ids = [cat.id for cat in knowledge.categories]
            knowledge_dict = {c.name: getattr(knowledge, c.name) for c in knowledge.__table__.columns} # Keep all columns
            knowledge_dict = {c.name: getattr(knowledge, c.name) for c in knowledge.__table__.columns} # Keep all columns
            knowledge_dict['id'] = knowledge.id # Ensure ID is present
            if isinstance(knowledge_dict.get('created_at'), datetime):
                 knowledge_dict['created_at'] = knowledge_dict['created_at'].isoformat()
            # Return selected category IDs as well
            return jsonify({
                "knowledge": knowledge_dict,
                "selected_catalogs": selected_catalog_ids,
                "selected_categories": selected_category_ids
            })
        else:
            return jsonify({"status": "error", "message": "Knowledge not found."}), 404
    except Exception as e:
        print(f"Error in /admin/knowledges/data route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

# @admin_bp.route('/knowledges/edit/<int:knowledge_id>', methods=['POST'])
def edit_knowledge(knowledge_id):
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    # Get lists of IDs
    category_ids = data.get('category_ids', [])
    catalog_ids = data.get('catalog_ids', [])

    if not name: return jsonify({"status": "error", "message": "Knowledge name is required."}), 400
    # Validate category_ids
    if not isinstance(category_ids, list): return jsonify({"status": "error", "message": "Category IDs must be provided as a list."}), 400
    try: valid_category_ids = [int(cid) for cid in category_ids]
    except (ValueError, TypeError): return jsonify({"status": "error", "message": "Invalid Category ID format in list."}), 400
    # Validate catalog_ids
    if not isinstance(catalog_ids, list): return jsonify({"status": "error", "message": "Catalog IDs must be provided as a list."}), 400
    try: valid_catalog_ids = [int(cid) for cid in catalog_ids]
    except (ValueError, TypeError): return jsonify({"status": "error", "message": "Invalid Catalog ID format in list."}), 400

    knowledge = Knowledge.query.options(
        joinedload(Knowledge.categories),
        joinedload(Knowledge.catalogs)
    ).get(knowledge_id)

    if not knowledge:
        return jsonify({"status": "error", "message": "Knowledge not found."}), 404

    try:
        # Update basic fields
        knowledge.name = name
        knowledge.description = description

        # Update Categories
        new_categories = set(Category.query.filter(Category.id.in_(valid_category_ids)).all())
        knowledge.categories = list(new_categories)

        # Update Catalogs
        new_catalogs = set(Catalog.query.filter(Catalog.id.in_(valid_catalog_ids)).all())
        knowledge.catalogs = list(new_catalogs)

        db.session.commit() # Commit all changes

        # Fetch updated data for response
        updated_knowledge = Knowledge.query.options(
            joinedload(Knowledge.creator),
            joinedload(Knowledge.categories),
            joinedload(Knowledge.catalogs)
        ).get(knowledge_id)

        if updated_knowledge:
            knowledge_dict = {c.name: getattr(updated_knowledge, c.name) for c in updated_knowledge.__table__.columns} # Keep all columns
            knowledge_dict = {c.name: getattr(updated_knowledge, c.name) for c in updated_knowledge.__table__.columns} # Keep all columns
            knowledge_dict['id'] = updated_knowledge.id
            knowledge_dict['created_by_username'] = updated_knowledge.creator.username if updated_knowledge.creator else 'N/A'
            knowledge_dict['category_names'] = sorted([cat.name for cat in updated_knowledge.categories]) # Sort for consistency
            knowledge_dict['catalog_names'] = sorted([cat.name for cat in updated_knowledge.catalogs]) # Sort for consistency
            if isinstance(knowledge_dict.get('created_at'), datetime):
                knowledge_dict['created_at'] = knowledge_dict['created_at'].isoformat()
            return jsonify({"status": "success", "message": "Knowledge updated successfully.", "knowledge": knowledge_dict})
        else:
            # Should not happen if commit succeeded
            return jsonify({"status": "success", "message": "Knowledge updated, but failed to fetch details."})

    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Knowledge name '{name}' already exists."}), 409
    except ValueError as ve:
         db.session.rollback()
         return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/knowledges/edit route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

# @admin_bp.route('/knowledges/delete/<int:knowledge_id>', methods=['POST', 'DELETE'])
def delete_knowledge_route(knowledge_id):
    try:
        success = delete_knowledge(knowledge_id)
        if success: return jsonify({"status": "success", "message": "Knowledge deleted successfully."})
        else: return jsonify({"status": "error", "message": "Could not delete knowledge (ID not found)."}), 404
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/knowledges/delete route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

# --- Catalog CRUD Routes ---
@admin_bp.route('/catalogs')
def catalog_management():
    try:
        catalogs = get_catalogs()
        users = User.query.order_by(User.username).all()
        catalog_dicts = []
        for catalog in catalogs:
            catalog_dicts.append({
                'id': catalog.id,
                'name': catalog.name,
                'description': catalog.description,
                'creator_name': catalog.creator.username if catalog.creator else 'Unknown',
                'created_at': catalog.created_at,
            })
        return render_template('admin/catalogs.html', catalogs=catalog_dicts, users=users)
    except Exception as e:
        print(f"Error in /admin/catalogs route:\n{traceback.format_exc()}")
        flash('Error loading catalogs.', 'danger')
        return redirect(url_for('admin.dashboard'))

@admin_bp.route('/catalogs/add', methods=['POST'])
def add_catalog():
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    if not name: return jsonify({"status": "error", "message": "Catalog name is required."}), 400
    session_user_id = session.get('_user_id')
    current_user_id_attr = getattr(current_user, 'id', 'AttributeMissing')
    user_id = session_user_id or (current_user_id_attr if current_user_id_attr != 'AttributeMissing' else None)
    if not user_id:
         print(f"Error in add_catalog: Could not get valid user ID.")
         return jsonify({"status": "error", "message": "Could not identify current user."}), 500
    try:
        catalog_id = create_catalog(name, description, user_id)
        new_catalog = get_catalog_by_id(catalog_id)
        catalog_dict = {c.name: getattr(new_catalog, c.name) for c in new_catalog.__table__.columns} if new_catalog else {"id": catalog_id, "name": name, "description": description}
        if isinstance(catalog_dict.get('created_at'), datetime): catalog_dict['created_at'] = catalog_dict['created_at'].isoformat()
        catalog_dict['created_by_username'] = new_catalog.creator.username if new_catalog and new_catalog.creator else 'N/A'
        return jsonify({"status": "success", "message": "Catalog added successfully.", "catalog": catalog_dict}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Catalog name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/catalogs/add route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/catalogs/data/<int:catalog_id>', methods=['GET'])
def get_catalog_data(catalog_id):
    try:
        catalog = get_catalog_by_id(catalog_id)
        if catalog:
            catalog_dict = {c.name: getattr(catalog, c.name) for c in catalog.__table__.columns}
            if isinstance(catalog_dict.get('created_at'), datetime):
                 catalog_dict['created_at'] = catalog_dict['created_at'].isoformat()
            return jsonify(catalog_dict)
        else: return jsonify({"status": "error", "message": "Catalog not found."}), 404
    except Exception as e:
        print(f"Error in /admin/catalogs/data route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/catalogs/edit/<int:catalog_id>', methods=['POST'])
def edit_catalog(catalog_id):
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    if not name: return jsonify({"status": "error", "message": "Catalog name is required."}), 400
    try:
        success = update_catalog(catalog_id, name, description)
        if success:
             updated_catalog = get_catalog_by_id(catalog_id)
             catalog_dict = {c.name: getattr(updated_catalog, c.name) for c in updated_catalog.__table__.columns} if updated_catalog else {"id": catalog_id, "name": name, "description": description}
             if isinstance(catalog_dict.get('created_at'), datetime): catalog_dict['created_at'] = catalog_dict['created_at'].isoformat()
             catalog_dict['created_by_username'] = updated_catalog.creator.username if updated_catalog and updated_catalog.creator else 'N/A'
             return jsonify({"status": "success", "message": "Catalog updated successfully.", "catalog": catalog_dict})
        else: return jsonify({"status": "error", "message": "Catalog update failed."}), 500
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Catalog name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/catalogs/edit route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/catalogs/delete/<int:catalog_id>', methods=['POST', 'DELETE'])
def delete_catalog_route(catalog_id):
    try:
        success = delete_catalog(catalog_id)
        if success: return jsonify({"status": "success", "message": "Catalog deleted successfully."})
        else: return jsonify({"status": "error", "message": "Could not delete catalog."}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/catalogs/delete route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

# --- LLM Description Generation Route ---
@admin_bp.route('/generate-description', methods=['POST'])
@login_required
def generate_description_route():
    if not current_user.is_admin: return jsonify({"status": "error", "message": "Admin access required."}), 403
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    context_text = data.get('context_text')
    item_type = data.get('item_type')
    deployment_name = data.get('deployment_name')
    catalog_names = data.get('catalog_names', [])
    if not context_text: return jsonify({"status": "error", "message": "Missing 'context_text' in request."}), 400
    if not item_type: return jsonify({"status": "error", "message": "Missing 'item_type' in request."}), 400
    if not deployment_name: return jsonify({"status": "error", "message": "Missing 'deployment_name' in request."}), 400
    target_language_name = None
    try:
        active_languages = get_active_llm_languages()
        if active_languages: target_language_name = active_languages[0].language_name
        else: print("No active LLM languages found, defaulting prompt language.")
    except Exception as lang_e: print(f"Error fetching active languages: {lang_e}. Defaulting prompt language.")
    # TODO: Insert From Table llm_prompts, manage by /admin/prompt by
    # --- Fetch admin description prompt from llm_prompts ---
    from modules.llm_utils import get_active_prompt_content
    prompt_name_map = {
        "library": "admin_library_description",
        "catalog": "admin_catalog_description",
        "category": "admin_category_description",
        "knowledge": "admin_knowledge_description"
    }
    prompt_name = prompt_name_map.get(item_type, "admin_library_description")
    # Compose context variables
    context_vars = {
        "name": context_text,
        "catalogs": ", ".join(catalog_names) if catalog_names else "",
        "language": target_language_name or "English",
        "item_type": item_type
    }
    # Try to fetch prompt from llm_prompts
    from modules.llm_utils import get_active_prompt_content
    prompt_template = get_active_prompt_content(prompt_name, fallback=None)
    if prompt_template:
        try:
            prompt = prompt_template.format(**context_vars)
        except Exception as e:
            print(f"Error formatting admin description prompt from llm_prompts: {e}. Falling back to default prompt.")
            prompt = f"Generate a concise and informative description for a {item_type} named '{context_text}' shorts"
            if catalog_names: prompt += f" This item belongs to the following catalogs: {', '.join(catalog_names)}."
            prompt += " Focus on its potential purpose or content based on the name and catalogs."
            prompt += f"\n\nPlease generate the description in {target_language_name or 'English'}."
    else:
        prompt = f"Generate a concise and informative description for a {item_type} named '{context_text}' shorts"
        if catalog_names: prompt += f" This item belongs to the following catalogs: {', '.join(catalog_names)}."
        prompt += " Focus on its potential purpose or content based on the name and catalogs."
        prompt += f"\n\nPlease generate the description in {target_language_name or 'English'}."
    try:
        generated_description = generate_simple_text(prompt=prompt, deployment_name=deployment_name)
        return jsonify({"status": "success", "description": generated_description})
    except ValueError as ve: return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        print(f"Error in /admin/generate-description route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"Failed to generate description: {str(e)}"}), 500

# --- LLM Language Management Routes ---
@admin_bp.route('/languages')
def language_management():
    try:
        languages_data = get_llm_languages()
        return render_template('admin/languages.html', languages=languages_data)
    except Exception as e:
        print(f"Error in /admin/languages route:\n{traceback.format_exc()}")
        flash('Error loading languages.', 'danger')
        return redirect(url_for('admin.dashboard'))

@admin_bp.route('/language-test')
def language_test():
    """Serve the standalone language test page for debugging."""
    print("Language test page requested")
    return render_template('admin/language_test.html')

@admin_bp.route('/languages/add', methods=['POST'])
def add_language():
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    code = data.get('language_code')
    name = data.get('language_name')
    if not code or not name: return jsonify({"status": "error", "message": "Language code and name are required."}), 400
    creator = current_user.username if hasattr(current_user, 'username') else 'Admin'
    try:
        language_id = create_llm_language(code.strip(), name.strip(), creator)
        new_language = get_llm_language_by_id(language_id)
        lang_dict = {c.name: getattr(new_language, c.name) for c in new_language.__table__.columns} if new_language else {"id": language_id, "language_code": code, "language_name": name}
        if isinstance(lang_dict.get('created_at'), datetime): lang_dict['created_at'] = lang_dict['created_at'].isoformat()
        return jsonify({"status": "success", "message": "Language added successfully.", "language": lang_dict}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Language code '{code}' or name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/languages/add route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/languages/edit/<int:language_id>', methods=['POST'])
def edit_language(language_id):
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    code = data.get('language_code')
    name = data.get('language_name')
    is_active = data.get('is_active')
    if not code or not name or is_active is None: return jsonify({"status": "error", "message": "Language code, name, and active status are required."}), 400
    try:
        success = update_llm_language(language_id, code.strip(), name.strip(), bool(is_active))
        if success:
            updated_language = get_llm_language_by_id(language_id)
            lang_dict = {c.name: getattr(updated_language, c.name) for c in updated_language.__table__.columns} if updated_language else {"id": language_id, "language_code": code, "language_name": name, "is_active": is_active}
            if isinstance(lang_dict.get('created_at'), datetime): lang_dict['created_at'] = lang_dict['created_at'].isoformat()
            return jsonify({"status": "success", "message": "Language updated successfully.", "language": lang_dict})
        else: return jsonify({"status": "error", "message": "Language update failed (ID not found?)."}), 404
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Language code '{code}' or name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/languages/edit route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/languages/data/<int:language_id>', methods=['GET'])
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
        print(f"Error in /admin/languages/data route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/languages/delete/<int:language_id>', methods=['POST', 'DELETE'])
def delete_language_route(language_id):
    try:
        success = delete_llm_language(language_id)
        if success: return jsonify({"status": "success", "message": "Language deleted successfully."})
        else: return jsonify({"status": "error", "message": "Could not delete language (ID not found?)."}), 404
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/languages/delete route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

# --- Category CRUD Routes ---
@admin_bp.route('/categories')
def category_management():
    try:
        categories = Category.query.options(joinedload(Category.creator)).all()
        category_dicts = []
        for category in categories:
            category_dicts.append({
                'id': category.id,
                'name': category.name,
                'description': category.description,
                'creator_name': category.creator.username if category.creator else 'Unknown',
                'created_at': category.created_at,
            })
        return render_template('admin/categories.html', categories=category_dicts)
    except Exception as e:
        print(f"Error in /admin/categories route:\n{traceback.format_exc()}")
        flash('Error loading categories.', 'danger')
        return redirect(url_for('admin.dashboard'))

@admin_bp.route('/categories/add', methods=['POST'])
def add_category():
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    if not name: return jsonify({"status": "error", "message": "Category name is required."}), 400
    session_user_id = session.get('_user_id')
    current_user_id_attr = getattr(current_user, 'id', 'AttributeMissing')
    user_id = session_user_id or (current_user_id_attr if current_user_id_attr != 'AttributeMissing' else None)
    if not user_id:
         print(f"Error in add_category: Could not get valid user ID.")
         return jsonify({"status": "error", "message": "Could not identify current user."}), 500
    try:
        category_id = create_category(name, description, user_id)
        new_category = get_category_by_id(category_id)
        cat_dict = {c.name: getattr(new_category, c.name) for c in new_category.__table__.columns} if new_category else {"id": category_id, "name": name, "description": description}
        if isinstance(cat_dict.get('created_at'), datetime): cat_dict['created_at'] = cat_dict['created_at'].isoformat()
        cat_dict['created_by_username'] = new_category.creator.username if new_category and new_category.creator else 'N/A'
        return jsonify({"status": "success", "message": "Category added successfully.", "category": cat_dict}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Category name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/categories/add route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/categories/data/<int:category_id>', methods=['GET'])
def get_category_data(category_id):
    try:
        category = get_category_by_id(category_id)
        if category:
            category_dict = {c.name: getattr(category, c.name) for c in category.__table__.columns}
            if isinstance(category_dict.get('created_at'), datetime):
                 category_dict['created_at'] = category_dict['created_at'].isoformat()
            return jsonify(category_dict)
        else: return jsonify({"status": "error", "message": "Category not found."}), 404
    except Exception as e:
        print(f"Error in /admin/categories/data route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/categories/edit/<int:category_id>', methods=['POST'])
def edit_category(category_id):
    if not request.is_json: return jsonify({"status": "error", "message": "Request must be JSON"}), 400
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')
    if not name: return jsonify({"status": "error", "message": "Category name is required."}), 400
    try:
        success = update_category(category_id, name, description)
        if success:
            updated_category = get_category_by_id(category_id)
            cat_dict = {c.name: getattr(updated_category, c.name) for c in updated_category.__table__.columns} if updated_category else {"id": category_id, "name": name, "description": description}
            if isinstance(cat_dict.get('created_at'), datetime): cat_dict['created_at'] = cat_dict['created_at'].isoformat()
            cat_dict['created_by_username'] = updated_category.creator.username if updated_category and updated_category.creator else 'N/A'
            return jsonify({"status": "success", "message": "Category updated successfully.", "category": cat_dict})
        else: return jsonify({"status": "error", "message": "Category update failed."}), 500
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Category name '{name}' already exists."}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/categories/edit route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500

@admin_bp.route('/categories/delete/<int:category_id>', methods=['POST', 'DELETE'])
def delete_category_route(category_id):
    try:
        success = delete_category(category_id)
        if success: return jsonify({"status": "success", "message": "Category deleted successfully."})
        else: return jsonify({"status": "error", "message": "Could not delete category."}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Error in /admin/categories/delete route:\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500




class SettingsForm(FlaskForm):
    ocr_mode = RadioField(
        'OCR Mode',
        choices=[('azure', 'Azure Document Intelligence'), ('default', 'Default')],
        default='default',
        validators=[DataRequired()],
    )
    endpoint = StringField(
        'Azure Document Intelligence Endpoint',
        validators=[Optional(), URL(require_tld=True, message="Provide a valid https endpoint.")],
    )
    dummy = HiddenField('dummy')  # Retain dummy for compatibility

    def validate(self, extra_validators=None):
        if self.endpoint.data:
            self.endpoint.data = self.endpoint.data.strip()

        is_valid = super().validate(extra_validators=extra_validators)
        if not is_valid:
            return False

        if self.ocr_mode.data == 'azure':
            if not self.endpoint.data:
                self.endpoint.errors.append(
                    'Endpoint is required when Azure Document Intelligence is selected.',
                )
                is_valid = False
            else:
                parsed = urlparse(self.endpoint.data)
                if parsed.scheme != 'https' or not parsed.netloc:
                    self.endpoint.errors.append(
                        'Endpoint must start with https:// and include a valid host.',
                    )
                    is_valid = False

        return is_valid

# --- Visual Grounding Settings Route ---
@admin_bp.route('/settings/visual_grounding', methods=['GET', 'POST'])
def visual_grounding_settings():
    form = SettingsForm() # Instantiate the form
    if form.validate_on_submit(): # Use validate_on_submit for POST CSRF check
        # POST request handling (already inside try block)
        try:
            # Get form data (remains the same)
            enabled_value = request.form.get('visual_grounding_enabled') == 'true' # Checkbox value is 'true' if checked
            doc_store_path = request.form.get('visual_grounding_doc_store_path', '').strip()

            if not doc_store_path:
                flash('Document store path cannot be empty.', 'danger')
                return redirect(url_for('admin.visual_grounding_settings'))

            # Basic path validation (more robust checks could be added)
            # For simplicity, just ensuring it's not obviously invalid like '/'
            if not os.path.isabs(doc_store_path) and not doc_store_path.startswith(('data/', 'static/', 'templates/')): # Allow relative paths starting with known dirs or absolute paths
                 # This is a basic check, adjust as needed for your security/deployment model
                 # Consider checking if the path is outside the project root if using relative paths
                 pass # Allow relative paths for now, but consider validation

            # Update or Insert settings
            settings_to_update = {
                'visual_grounding_enabled': str(enabled_value).lower(), # Store as 'true' or 'false' string
                'visual_grounding_doc_store_path': doc_store_path
            }

            for key, value in settings_to_update.items():
                setting = db.session.get(AppSettings, key)
                if setting:
                    setting.value = value
                else:
                    new_setting = AppSettings(key=key, value=value)
                    db.session.add(new_setting)

            db.session.commit()

            # Update live app config (important!)
            current_app.config['VISUAL_GROUNDING_ENABLED'] = enabled_value
            current_app.config['VISUAL_GROUNDING_DOC_STORE_PATH'] = doc_store_path

            flash('Visual grounding settings updated successfully.', 'success')

        except Exception as e:
            db.session.rollback()
            print(f"Error updating visual grounding settings:\n{traceback.format_exc()}")
            flash(f'An error occurred while saving settings: {str(e)}', 'danger')
        # Redirect after POST processing
        return redirect(url_for('admin.visual_grounding_settings'))

    # GET request handling (or initial form display if POST validation failed)
    logging.info("Attempting to render visual grounding settings page (GET request).") # Add log
    try:
        logging.debug("Querying AppSettings table...") # Add log
        settings_query = AppSettings.query.filter(AppSettings.key.in_([
            'visual_grounding_enabled',
            'visual_grounding_doc_store_path'
        ])).all()
        settings = {s.key: s.value for s in settings_query}
        # Ensure defaults if not found
        settings.setdefault('visual_grounding_enabled', 'false')
        settings.setdefault('visual_grounding_doc_store_path', 'data/doc_store')
        logging.debug(f"Settings loaded/defaulted: {settings}") # Add log

    except Exception as e:
        # Use logger instead of print
        logging.error(f"Error fetching visual grounding settings:\n{traceback.format_exc()}")
        flash('Error loading settings.', 'danger')
        settings = {
            'visual_grounding_enabled': 'false',
            'visual_grounding_doc_store_path': 'data/doc_store'
        } # Provide defaults on error

    # No longer need DummyForm
    # form = SettingsForm() # Instantiate form here for GET request rendering
    logging.debug("Attempting to render template 'admin/settings_visual_grounding.html'") # Add log
    try:
        # Pass the real form object to the template
        rendered_template = render_template('admin/settings_visual_grounding.html', settings=settings, form=form)
        logging.info("Successfully rendered visual grounding settings template.") # Add log
        return rendered_template
    except Exception as render_e:
        logging.error(f"Error rendering visual grounding settings template:\n{traceback.format_exc()}")
        # Return a generic error page or message if template rendering fails
        flash('An internal error occurred while trying to display the settings page.', 'danger')
        # Redirect to dashboard or return a simple error response
        return redirect(url_for('admin.dashboard')) # Redirecting might hide the flash message briefly
        # Alternatively: return "Internal Server Error", 500

# --- OCR Settings Route ---
@admin_bp.route('/settings/ocr', methods=['GET', 'POST'])
@login_required
def ocr_settings():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('admin.dashboard'))

    form = SettingsForm()
    # Load current settings from AppSettings
    try:
        settings_query = AppSettings.query.filter(
            AppSettings.key.in_([
                'is_enabled_ocr',
                'is_auto_ocr',
                'ocr_mode',
                'doc_intelligence_endpoint',
            ])
        ).all()
        settings = {s.key: s.value for s in settings_query}
        # Set defaults if not found, and check env for IS_ENABLED_OCR
        if 'is_enabled_ocr' not in settings:
            env_ocr = os.environ.get('IS_ENABLED_OCR', '0')
            settings['is_enabled_ocr'] = '1' if env_ocr in ['1', 'true', 'True'] else '0'
        settings.setdefault('is_auto_ocr', '0')
        settings.setdefault('ocr_mode', 'default')
        settings.setdefault('doc_intelligence_endpoint', '')
    except Exception as e:
        logging.error(f"Error fetching OCR settings: {traceback.format_exc()}")
        flash('Error loading OCR settings.', 'danger')
        settings = {
            'is_enabled_ocr': '0',
            'ocr_mode': 'default',
            'doc_intelligence_endpoint': '',
        }

    legacy_key_setting = db.session.get(AppSettings, 'doc_intelligence_key')
    key_env_available = bool(
        os.environ.get('DOC_INTELLIGENCE_KEY')
        or os.environ.get('AZURE_DOCUMENT_INTELLIGENCE_KEY')
    )
    legacy_key_present = bool(legacy_key_setting and legacy_key_setting.value)

    if form.validate_on_submit():
        try:
            is_enabled_ocr = request.form.get('is_enabled_ocr', '0')
            is_auto_ocr = request.form.get('is_auto_ocr', '0')
            ocr_mode = form.ocr_mode.data
            endpoint = form.endpoint.data or ''

            if ocr_mode == 'azure':
                key_available = bool(
                    os.environ.get('DOC_INTELLIGENCE_KEY')
                    or os.environ.get('AZURE_DOCUMENT_INTELLIGENCE_KEY')
                )
                if not key_available:
                    flash(
                        'Configure DOC_INTELLIGENCE_KEY as a Key Vault reference before '
                        'enabling Azure Document Intelligence.',
                        'danger',
                    )
                    return redirect(url_for('admin.ocr_settings'))

            settings_to_update = {
                'is_enabled_ocr': is_enabled_ocr,
                'is_auto_ocr': is_auto_ocr,
                'ocr_mode': ocr_mode,
                'doc_intelligence_endpoint': endpoint,
            }

            for key_name, value in settings_to_update.items():
                setting = db.session.get(AppSettings, key_name)
                if setting:
                    setting.value = value
                else:
                    new_setting = AppSettings(key=key_name, value=value)
                    db.session.add(new_setting)

            if legacy_key_setting:
                db.session.delete(legacy_key_setting)
                legacy_key_present = False

            db.session.commit()

            current_app.config['IS_ENABLED_OCR'] = is_enabled_ocr == '1'
            current_app.config['IS_AUTO_OCR'] = is_auto_ocr == '1'
            current_app.config['OCR_MODE'] = ocr_mode
            current_app.config['DOC_INTELLIGENCE_ENDPOINT'] = endpoint
            current_app.config['DOC_INTELLIGENCE_KEY'] = (
                os.environ.get('DOC_INTELLIGENCE_KEY')
                or os.environ.get('AZURE_DOCUMENT_INTELLIGENCE_KEY')
            )

            flash('OCR settings updated successfully.', 'success')
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error updating OCR settings: {traceback.format_exc()}")
            flash(f'An error occurred while saving OCR settings: {str(e)}', 'danger')
        return redirect(url_for('admin.ocr_settings'))

    if request.method == 'GET':
        form.ocr_mode.data = settings.get('ocr_mode', 'default')
        form.endpoint.data = settings.get('doc_intelligence_endpoint', '')

    return render_template(
        'admin/settings_ocr.html',
        form=form,
        is_enabled_ocr=settings.get('is_enabled_ocr', '0') == '1',
        is_auto_ocr=settings.get('is_auto_ocr', '0') == '1',
        key_env_available=key_env_available,
        legacy_key_present=legacy_key_present,
    )
# --- Reset Global Vector Store Route ---
@admin_bp.route('/reset_global_vector_store', methods=['POST'])
@login_required
def reset_global_vector_store():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('admin.vector_store_settings'))
    import shutil
    from pathlib import Path
    global_store_path = Path('faiss_indexes/global/stores')
    try:
        if global_store_path.exists() and global_store_path.is_dir():
            shutil.rmtree(global_store_path)
            flash('Global vector store has been reset (deleted) successfully.', 'success')
        else:
            flash('Global vector store directory not found or already empty.', 'info')
    except Exception as e:
        flash(f'Error resetting global vector store: {str(e)}', 'danger')
    return redirect(url_for('admin.vector_store_settings'))

# --- Reset Knowledge Vector Store Route ---
@admin_bp.route('/reset_knowledge_vector_store', methods=['POST'])
@login_required
def reset_knowledge_vector_store():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('admin.vector_store_settings'))
    import shutil
    from pathlib import Path
    knowledge_id = request.form.get('knowledge_id')
    if not knowledge_id:
        flash('No knowledge base selected.', 'danger')
        return redirect(url_for('admin.vector_store_settings'))
    try:
        knowledge_id_int = int(knowledge_id)
    except ValueError:
        flash('Invalid knowledge base selected.', 'danger')
        return redirect(url_for('admin.vector_store_settings'))
    store_path = Path(f'faiss_indexes/knowledge_{knowledge_id_int}/stores')
    try:
        if store_path.exists() and store_path.is_dir():
            shutil.rmtree(store_path)
            flash(f'Knowledge vector store for knowledge ID {knowledge_id_int} has been reset (deleted) successfully.', 'success')
        else:
            flash('Knowledge vector store directory not found or already empty.', 'info')
    except Exception as e:
        flash(f'Error resetting knowledge vector store: {str(e)}', 'danger')
    return redirect(url_for('admin.vector_store_settings'))

@admin_bp.route('/cleanup_generated_maps', methods=['POST'])
@login_required
def admin_cleanup_generated_maps():
    retention_hours = current_app.config.get('MAP_RETENTION_HOURS', 24)
    override = request.form.get('retention_hours')
    if override:
        try:
            retention_hours = max(0, int(override))
        except ValueError:
            flash('Retention hours must be a valid integer.', 'warning')
            return redirect(url_for('admin.admin_reset_data'))

    map_dir = Path(current_app.config.get('MAP_PUBLIC_DIR', Path(current_app.root_path) / 'static' / 'maps'))
    removed = purge_map_assets(map_dir, retention_hours, logger=logging.getLogger(__name__))

    if removed:
        flash(f'Removed {removed} generated map files older than {retention_hours} hours.', 'success')
    else:
        flash('No generated map files met the retention threshold.', 'info')

    return redirect(url_for('admin.admin_reset_data'))

# --- Reset/Clear Transaction Tables Route ---
@admin_bp.route('/reset_data', methods=['GET', 'POST'])
@login_required
def admin_reset_data():
    from modules.database import UploadedFile, UrlDownload, VectorReference, MessageHistory, MessageFeedback, LibraryReference, Document
    import datetime

    if request.method == 'POST':
        confirm_text = request.form.get('confirm_text', '')
        if confirm_text != 'RESET':
            flash('You must type RESET to confirm.', 'danger')
            return redirect(url_for('admin.admin_reset_data'))

        try:
            # Import all transaction tables including missing FolderUploadJob
            from modules.database import UploadedFile, UrlDownload, VectorReference, MessageHistory, MessageFeedback, LibraryReference, Document, FolderUploadJob

            # Delete in proper order to respect foreign key constraints
            # Start with tables that have foreign keys pointing TO them (dependent tables first)

            num_folder_jobs = 0
            try:
                num_folder_jobs = db.session.query(FolderUploadJob).delete(synchronize_session=False)
                logging.info(f"Deleted {num_folder_jobs} rows from FolderUploadJob")
            except Exception as e:
                logging.warning(f"Could not delete FolderUploadJob: {e}")
                # Continue - this might not be critical

            num_docs = db.session.query(Document).delete(synchronize_session=False)
            logging.info(f"Deleted {num_docs} rows from Document")

            num_vg = db.session.query(VisualGroundingActivity).delete(synchronize_session=False)
            logging.info(f"Deleted {num_vg} rows from VisualGroundingActivity")

            num_feedback = db.session.query(MessageFeedback).delete(synchronize_session=False)
            logging.info(f"Deleted {num_feedback} rows from MessageFeedback")

            num_vectors = db.session.query(VectorReference).delete(synchronize_session=False)
            logging.info(f"Deleted {num_vectors} rows from VectorReference")

            num_refs = db.session.query(LibraryReference).delete(synchronize_session=False)
            logging.info(f"Deleted {num_refs} rows from LibraryReference")

            num_urls = db.session.query(UrlDownload).delete(synchronize_session=False)
            logging.info(f"Deleted {num_urls} rows from UrlDownload")

            num_files = db.session.query(UploadedFile).delete(synchronize_session=False)
            logging.info(f"Deleted {num_files} rows from UploadedFile")

            num_msgs = db.session.query(MessageHistory).delete(synchronize_session=False)
            logging.info(f"Deleted {num_msgs} rows from MessageHistory")

            # Force session sync after bulk operations
            db.session.commit()
            db.session.expire_all()  # Clear all cached objects to prevent stale references

            # Verify deletion success by checking remaining rows
            verification_counts = {}
            all_cleared = True
            models_to_verify = [UploadedFile, UrlDownload, VectorReference, MessageHistory,
                               LibraryReference, MessageFeedback, Document, FolderUploadJob]

            for model in models_to_verify:
                count = db.session.query(model).count()
                verification_counts[model.__tablename__] = count
                logging.info(f"Rows remaining in {model.__tablename__}: {count}")
                if count > 0:
                    all_cleared = False
                    logging.warning(f"Table {model.__tablename__} still has {count} rows after reset!")

            # Final session cleanup to prevent orphaned object issues
            db.session.expunge_all()

            # Log the action
            log_entry = {
                "user": current_user.username,
                "user_id": current_user.get_id(),
                "action": "reset_transaction_tables",
                "tables_cleared": [
                    "uploaded_files", "url_downloads", "vector_references",
                    "message_history", "library_references", "message_feedback",
                    "visual_grounding_activity", " documents", "folder_upload_jobs"
                ],
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "counts": {
                    "uploaded_files": num_files,
                    "url_downloads": num_urls,
                    "vector_references": num_vectors,
                    "message_history": num_msgs,
                    "library_references": num_refs,
                    "message_feedback": num_feedback,
                    "visual_grounding_activity": num_vg,
                    "documents": num_docs,
                    "folder_upload_jobs": num_folder_jobs
                },
                "verification": verification_counts,
                "success": all_cleared
            }

            log_path = "data/reset_data_log.jsonl"
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            with open(log_path, "a") as f:
                f.write(json.dumps(log_entry) + "\n")

            if all_cleared:
                flash('All transaction tables have been successfully cleared. This action has been logged.', 'success')
            else:
                flash('Reset completed but some tables may still contain data. Check logs for details.', 'warning')

        except Exception as e:
            db.session.rollback()
            logging.error(f"Error during reset operation: {str(e)}", exc_info=True)
            flash(f'Error clearing tables: {str(e)}', 'danger')
        return redirect(url_for('admin.admin_reset_data'))

    return render_template('admin/reset_data.html', map_retention_hours=current_app.config.get('MAP_RETENTION_HOURS', 24))

@admin_bp.route('/reset_data_log')
@login_required
def admin_reset_data_log():
    import os
    log_path = "data/reset_data_log.jsonl"
    log_entries = []
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    log_entries.append(entry)
                except Exception:
                    continue
    return render_template('admin/reset_data_log.html', log_entries=log_entries)

@admin_bp.route('/export_message_history_csv')
@login_required
def export_message_history_csv():
    import csv
    from io import StringIO
    from modules.database import MessageHistory, User

    si = StringIO()
    cw = csv.writer(si)
    # Write header
    cw.writerow(['User', 'Message', 'Answer', 'Date'])

    # Query all messages, join with user
    messages = (
        db.session.query(MessageHistory, User)
        .join(User, MessageHistory.user_id == User.user_id)
        .order_by(MessageHistory.timestamp)
        .all()
    )
    for msg, user in messages:
        cw.writerow([
            user.username if user else 'Unknown User',
            msg.message_text,
            msg.answer or '',
            msg.timestamp.strftime('%Y-%m-%d %H:%M:%S') if msg.timestamp else ''
        ])

    output = si.getvalue()
    from flask import Response
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=message_history.csv"}
    )
    
# --- New Form for Vector Store Settings ---
class VectorStoreSettingsForm(FlaskForm):
    provider = RadioField(
        'Vector Store Provider',
        choices=[
            ('chromadb', 'ChromaDB (Local Persistence)'), # Updated
            ('pgvector', 'PGVector (PostgreSQL Extension)')
        ],
        default='chromadb', # Updated default
        validators=[DataRequired()]
    )
    store_mode = SelectField( # Keep for local stores (ChromaDB)
        'Local Store Mode (ChromaDB)',
        choices=[
            ('knowledge', 'Per Knowledge ID'),
            ('user', 'Per User'),
            ('global', 'Global Single Store')
        ],
        default='knowledge',
        validators=[DataRequired()]
    )
    # --- ChromaDB Specific ---
    chroma_collection = StringField(
        'ChromaDB Collection Name',
        default='documents-vectors',
        validators=[Optional()] # Required if provider is chromadb
    )
    # You might not need a configurable base path if LOCAL_VECTOR_STORE_BASE_PATH is sufficient
    # chroma_base_path = StringField('ChromaDB Base Path (Overrides Default)', validators=[Optional()])

    # --- PGVector Specific ---
    pg_connection = StringField(
        'PGVector Connection String',
        description='Example: postgresql+psycopg2://user:pass@host:port/db',
        validators=[Optional()]
    )
    pg_collection = StringField(
        'PGVector Collection/Table Name',
        default='langchain_vectors',
        validators=[Optional()]
    )


# --- New Route for Vector Store Settings ---
@admin_bp.route('/settings/vectorstore', methods=['GET', 'POST'])
@login_required
def vector_store_settings():
    form = VectorStoreSettingsForm()
    pg_conn_placeholder = '(No connection string saved)'

    # Load current settings
    try:
        settings_keys = [
            'VECTOR_STORE_PROVIDER', 'VECTOR_STORE_MODE', 'vector_store_mode',
            'CHROMA_COLLECTION_NAME',
            'PGVECTOR_CONNECTION_STRING', 'PGVECTOR_COLLECTION_NAME',
        ]
        settings_query = AppSettings.query.filter(AppSettings.key.in_(settings_keys)).all()
        settings = {s.key: s.value for s in settings_query}
        # Set defaults if not found
        settings.setdefault('VECTOR_STORE_PROVIDER', 'chromadb')
        settings.setdefault('VECTOR_STORE_MODE', 'knowledge')
        settings.setdefault('vector_store_mode', 'knowledge')
        settings.setdefault('CHROMA_COLLECTION_NAME', 'documents-vectors')
        settings.setdefault('PGVECTOR_CONNECTION_STRING', '')
        settings.setdefault('PGVECTOR_COLLECTION_NAME', 'langchain_vectors')

    except Exception as e:
        logging.error(f"Error fetching vector store settings: {traceback.format_exc()}")
        flash('Error loading vector store settings.', 'danger')
        # Use safe defaults on error
        settings = {
            'VECTOR_STORE_PROVIDER': 'chromadb', 
            'VECTOR_STORE_MODE': 'knowledge',
            'vector_store_mode': 'knowledge',
            'CHROMA_COLLECTION_NAME': 'documents-vectors',
            'PGVECTOR_CONNECTION_STRING': '', 
            'PGVECTOR_COLLECTION_NAME': 'langchain_vectors'
        }

    # --- ChromaDB Inspection (if provider is chromadb) ---
    current_embedding = None
    chroma_stores_info = []
    chroma_base_path = None
    if settings.get('VECTOR_STORE_PROVIDER') == 'chromadb':
        worker_result = list_chroma_stores()
        if worker_result:
            chroma_stores_info = worker_result.get('stores', [])
            current_embedding = worker_result.get('embedding')
            chroma_base_path = worker_result.get('base_path')
        else:
            flash("Unable to inspect Chroma collections. Ensure the worker container is running.", "warning")

    if current_embedding is None:
        from modules.llm_utils import get_current_embedding_model
        current_embedding = get_current_embedding_model()


    if form.validate_on_submit(): # POST
        try:
            provider = form.provider.data
            store_mode = form.store_mode.data
            chroma_collection = form.chroma_collection.data or 'documents-vectors'
            pg_collection = form.pg_collection.data or 'langchain_vectors'
            submitted_pg_conn = form.pg_connection.data

            # Validation based on provider
            if provider == 'chromadb' and not chroma_collection:
                 flash('ChromaDB Collection Name is required.', 'danger')
            if provider == 'pgvector' and not submitted_pg_conn and not settings.get('PGVECTOR_CONNECTION_STRING'):
                 flash('PGVector Connection String is required.', 'danger')
            if provider == 'pgvector' and not pg_collection:
                 flash('PGVector Collection Name is required.', 'danger')
                 
            settings_to_update = {
                'VECTOR_STORE_PROVIDER': provider,
                'CHROMA_COLLECTION_NAME': chroma_collection,
                'PGVECTOR_COLLECTION_NAME': pg_collection,
            }
                    
            # Update non-connection string settings
            for key_name, value in settings_to_update.items():
                setting = db.session.get(AppSettings, key_name)
                if setting:
                    setting.value = value
                else:
                    db.session.add(AppSettings(key=key_name, value=value))

            # Explicitly update both vector store mode keys for consistency
            for key_name in ['vector_store_mode', 'VECTOR_STORE_MODE']:
                setting = AppSettings.query.filter_by(key=key_name).first()
                if setting:
                    setting.value = store_mode
                else:
                    db.session.add(AppSettings(key=key_name, value=store_mode))

            # Conditionally update PGVector connection string
            pg_conn_key = 'PGVECTOR_CONNECTION_STRING'
            if submitted_pg_conn: # Only update if user entered something
                key_setting = db.session.get(AppSettings, pg_conn_key)
                if key_setting:
                    key_setting.value = submitted_pg_conn
                else:
                    new_key_setting = AppSettings(key=pg_conn_key, value=submitted_pg_conn)
                    db.session.add(new_key_setting)
                logging.info("PGVector Connection String was updated.")
                current_app.config[pg_conn_key] = submitted_pg_conn # Update live config
            else:
                # If empty, preserve existing DB value but ensure live config matches
                logging.info("PGVector Connection String field was empty, database value preserved.")
                existing_db_conn = settings.get(pg_conn_key, '')
                current_app.config[pg_conn_key] = existing_db_conn

            db.session.commit()

            # Update other live app config values
            current_app.config['VECTOR_STORE_PROVIDER'] = provider
            current_app.config['VECTOR_STORE_MODE'] = store_mode
            current_app.config['vector_store_mode'] = store_mode
            current_app.config['CHROMA_COLLECTION_NAME'] = chroma_collection
            current_app.config['PGVECTOR_COLLECTION_NAME'] = pg_collection

            flash('Vector store settings updated successfully.', 'success')
            return redirect(url_for('admin.vector_store_settings')) # Redirect after POST
            
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error updating vector store settings: {traceback.format_exc()}")
            flash(f'An error occurred while saving settings: {str(e)}', 'danger')
            pass
        
    # GET Request: Populate form and placeholder
    form.provider.data = settings.get('VECTOR_STORE_PROVIDER', 'chromadb')
    form.store_mode.data = settings.get('vector_store_mode', settings.get('VECTOR_STORE_MODE', 'knowledge'))
    form.chroma_collection.data = settings.get('CHROMA_COLLECTION_NAME', 'documents-vectors')
    form.pg_collection.data = settings.get('PGVECTOR_COLLECTION_NAME', 'langchain_vectors')

    # Handle placeholder for connection string
    if settings.get('PGVECTOR_CONNECTION_STRING', ''):
        pg_conn_placeholder = '****************** (Saved - Enter new string to change)'
    # Ensure form field is empty for rendering
    form.pg_connection.data = ''

    # --- Fetch data for reset dropdowns ---
    knowledges = []
    users = []
    try:
        knowledges = Knowledge.query.order_by(Knowledge.name).all()
        users = User.query.order_by(User.username).all()
    except Exception as e:
        logging.error(f"Error fetching knowledges/users for reset dropdowns: {e}")
        flash("Could not load data needed for reset options.", "warning")

    return render_template(
        'admin/settings_vectorstore.html',
        form=form,
        pg_conn_placeholder=pg_conn_placeholder,
        knowledges=knowledges,
        users=users,
        current_settings=settings,
        chroma_stores_info=chroma_stores_info,
        chroma_base_path=chroma_base_path,
        current_embedding=current_embedding,
    )


# --- ADD NEW ROUTES FOR RESET ACTIONS ---
import shutil
from modules.llm_utils import get_lc_store_path # Import helper

@admin_bp.route('/settings/vectorstore/delete_collection', methods=['POST'])
@login_required
def delete_chroma_collection():
    if not current_user.is_admin: return jsonify({"error": "Admin access required"}), 403

    store_path = request.form.get('store_path')
    collection_name = request.form.get('collection_name')

    if not store_path or not collection_name:
        flash("Invalid request. Store path and collection name are required.", "danger")
        return redirect(url_for('admin.vector_store_settings'))

    try:
        if delete_chroma_collection_via_worker(store_path, collection_name):
            flash(f"Successfully requested deletion of collection '{collection_name}' from store '{Path(store_path).name}'.", "success")
        else:
            flash("Vector worker unavailable. Could not delete collection.", "warning")
    except Exception as e:
        flash(f"Error deleting collection '{collection_name}': {e}", "danger")
        logging.error(f"Error deleting Chroma collection '{collection_name}' from path '{store_path}': {e}", exc_info=True)

    return redirect(url_for('admin.vector_store_settings'))

@admin_bp.route('/settings/vectorstore/reset/pgvector', methods=['POST'])
@login_required
def reset_pgvector_store():
    if not current_user.is_admin: return jsonify({"error": "Admin access required"}), 403

    confirm_text = request.form.get('confirm_text', '')
    # Get the configured name for confirmation message, but don't use it for DELETE SQL
    configured_collection_name = current_app.config.get('PGVECTOR_COLLECTION_NAME')

    if confirm_text != 'RESET PGVECTOR':
        flash('Incorrect confirmation text. Type RESET PGVECTOR exactly to confirm.', 'danger')
        return redirect(url_for('admin.vector_store_settings'))

    if not configured_collection_name:
        flash('PGVector collection name is not configured in settings (though reset targets fixed names).', 'warning')
        # Allow proceeding, but warn user config might be missing

    # --- Define the ACTUAL table names created by Langchain PGVector ---
    # Based on your observation, these are the likely names. Adjust if different.
    actual_metadata_table = "langchain_pg_collection"
    actual_embedding_table = "langchain_pg_embedding"
    
    logging.warning(f"Attempting to DELETE ALL DATA from PGVector tables: '{actual_metadata_table}' and '{actual_embedding_table}' (based on configured collection: '{configured_collection_name}')")
    
    
    try:
        # IMPORTANT: Ensure the user connecting to the DB has DELETE permissions on these tables.

        # Delete from the metadata table first (might have FK references from embedding table in some setups)
        result_meta = db.session.execute(text(f'DELETE FROM "{actual_metadata_table}"'))
        logging.info(f"Executed DELETE on '{actual_metadata_table}'. Rows affected (approx): {result_meta.rowcount}")

        # Delete from the embedding table
        result_embed = db.session.execute(text(f'DELETE FROM "{actual_embedding_table}"'))
        logging.info(f"Executed DELETE on '{actual_embedding_table}'. Rows affected (approx): {result_embed.rowcount}")

        db.session.commit()

        total_deleted = (result_meta.rowcount if result_meta.rowcount is not None else 0) + \
                        (result_embed.rowcount if result_embed.rowcount is not None else 0)

        logging.info(f"Successfully deleted data from PGVector tables '{actual_metadata_table}' and '{actual_embedding_table}'.")
        flash(f"PGVector data reset successfully (deleted data from '{actual_metadata_table}' and '{actual_embedding_table}').", "success")

    except Exception as e:
        db.session.rollback()
        # Provide more specific error if tables don't exist
        if isinstance(e, sqlalchemy.exc.ProgrammingError) and 'relation' in str(e) and 'does not exist' in str(e):
             flash(f"Error resetting PGVector: Table '{actual_metadata_table}' or '{actual_embedding_table}' not found. Has data been ingested yet?", "danger")
             logging.error(f"Error resetting PGVector: Table '{actual_metadata_table}' or '{actual_embedding_table}' not found.", exc_info=True)
        else:
             flash(f"Error resetting PGVector data: {str(e)}", "danger")
             logging.error(f"Error deleting from PGVector tables: {str(e)}", exc_info=True)

    return redirect(url_for('admin.vector_store_settings'))
