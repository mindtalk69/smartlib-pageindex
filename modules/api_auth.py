"""
API Authentication endpoints for React frontend.
"""

from flask import request, jsonify, session
from flask_login import login_user, logout_user, current_user, login_required
from modules.database import User, get_user_by_username_local
from werkzeug.security import check_password_hash
import logging

logger = logging.getLogger(__name__)


def init_api_auth(app):
    """Register API auth endpoints."""
    csrf = app.extensions.get('csrf', None)

    @app.route('/api/login', methods=['POST'])
    @csrf.exempt if csrf else lambda f: f
    def api_login():
        """
        API login endpoint for React frontend.
        Expects JSON: {username, password}
        Returns: {success: bool, user: {id, username, is_admin} | null, error: str}
        """
        try:
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'JSON body required'}), 400

            username = data.get('username', '').strip() if data.get('username') else ''
            password = data.get('password', '')

            if not username or not password:
                return jsonify({'success': False, 'error': 'Username and password are required'}), 400

            # Try username lookup first, then fall back to email (user_id)
            user = get_user_by_username_local(username)
            if not user and "@" in username:
                user_by_email = User.query.filter_by(user_id=username, auth_provider='local').first()
                if user_by_email:
                    user = user_by_email

            if not user:
                logger.warning(f"API login attempt: User '{username}' not found")
                return jsonify({'success': False, 'error': 'Invalid username or password'}), 401

            # Check if password hash exists
            if not user.password_hash:
                logger.error(f"API login: User '{username}' has no password hash")
                return jsonify({'success': False, 'error': 'Account password not set'}), 401

            # Check password and disabled status
            if check_password_hash(user.password_hash, password):
                if user.is_disabled:
                    logger.warning(f"API login: Disabled user '{username}'")
                    return jsonify({'success': False, 'error': 'Account is disabled'}), 403

                # Log in the user
                login_user(user)
                session["user"] = {
                    "user_id": user.user_id,
                    "username": user.username,
                    "auth_provider": "local"
                }

                logger.info(f"API login successful for user: {username}")
                return jsonify({
                    'success': True,
                    'user': {
                        'id': user.user_id,
                        'username': user.username,
                        'is_admin': user.is_admin,
                        'profile_picture_url': getattr(user, 'profile_picture_url', None)
                    }
                })
            else:
                logger.warning(f"API login: Invalid password for user '{username}'")
                return jsonify({'success': False, 'error': 'Invalid username or password'}), 401

        except Exception as e:
            logger.error(f"API login error: {e}", exc_info=True)
            return jsonify({'success': False, 'error': 'Internal server error'}), 500

    @app.route('/api/me', methods=['GET'])
    def api_me():
        """
        Get current authenticated user info.
        Returns: {authenticated: bool, user: {id, username, is_admin, profile_picture_url} | null}
        """
        if current_user.is_authenticated:
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': current_user.user_id,
                    'username': current_user.username,
                    'is_admin': current_user.is_admin,
                    'profile_picture_url': getattr(current_user, 'profile_picture_url', None)
                }
            })
        else:
            return jsonify({
                'authenticated': False,
                'user': None
            }), 401

    @app.route('/api/logout', methods=['POST', 'GET'])
    def api_logout():
        """
        API logout endpoint.
        Returns: {success: bool}
        """
        try:
            logout_user()
            session.pop('user', None)
            session.clear()
            logger.info("User logged out via API")
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"API logout error: {e}", exc_info=True)
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/libraries', methods=['GET'])
    def api_libraries():
        """
        Return libraries accessible to the current user, with their knowledges.
        Used by the React UploadPage to populate the library selector.
        Returns: {libraries: [...]}
        """
        from flask import current_app
        from flask_login import current_user
        from modules.database import get_libraries_with_details
        from modules.access_control import filter_accessible_knowledges, get_user_group_ids

        if not current_user.is_authenticated:
            return jsonify({'libraries': []}), 401

        try:
            vector_store_setting = current_app.config.get('VECTOR_STORE_MODE', 'user')
            user_group_ids = get_user_group_ids(current_user.user_id)
            raw_libraries = get_libraries_with_details()

            libraries = []
            for library in raw_libraries:
                accessible_knowledges = filter_accessible_knowledges(
                    getattr(library, 'knowledges', []) or [],
                    user_group_ids,
                )
                if vector_store_setting == 'knowledge' and not accessible_knowledges:
                    continue

                knowledges_data = []
                for k in accessible_knowledges:
                    knowledges_data.append({
                        'id': k.id,
                        'name': k.name,
                        'categories': [
                            {'id': c.id, 'name': c.name}
                            for c in (getattr(k, 'categories', []) or [])
                        ],
                        'catalogs': [
                            {'id': c.id, 'name': c.name}
                            for c in (getattr(k, 'catalogs', []) or [])
                        ],
                        'groups': [
                            {'group_id': g.group_id, 'name': g.name}
                            for g in (getattr(k, 'groups', []) or [])
                        ],
                    })

                libraries.append({
                    'library_id': library.library_id,
                    'name': library.name,
                    'description': getattr(library, 'description', '') or '',
                    'knowledges': knowledges_data,
                })

            return jsonify({'libraries': libraries})
        except Exception as e:
            logger.error(f"API libraries error: {e}", exc_info=True)
            return jsonify({'libraries': [], 'error': str(e)}), 500

    @app.route('/api/config', methods=['GET'])
    def api_config():
        """
        Return app configuration relevant to the React UploadPage.
        Returns: {vector_store_mode, visual_grounding_enabled, is_admin, username}
        """
        from flask import current_app
        from flask_login import current_user

        if not current_user.is_authenticated:
            return jsonify({'error': 'Unauthenticated'}), 401

        try:
            vector_store_mode = current_app.config.get('VECTOR_STORE_MODE', 'user')
            visual_grounding_enabled = current_app.config.get('VISUAL_GROUNDING_ENABLED', False)

            return jsonify({
                'vector_store_mode': vector_store_mode,
                'visual_grounding_enabled': bool(visual_grounding_enabled),
                'is_admin': bool(current_user.is_admin),
                'username': current_user.username or '',
            })
        except Exception as e:
            logger.error(f"API config error: {e}", exc_info=True)
            return jsonify({'error': str(e)}), 500

    @app.route('/api/knowledges', methods=['GET'])
    def api_knowledges():
        """
        Return knowledges accessible to the current user, along with the vector store mode.
        Returns: {knowledges: [...], knowledge_libraries_map: {...}, mode: '...'}
        """
        from flask import current_app
        from flask_login import current_user
        from modules.database import Knowledge, UserGroup, Group

        if not current_user.is_authenticated:
            return jsonify({'knowledges': [], 'knowledge_libraries_map': {}, 'mode': 'user'}), 401

        try:
            vector_store_mode = current_app.config.get('VECTOR_STORE_MODE', 'user')
            
            knowledge_libraries_map = {}
            knowledges_list = []
            
            if vector_store_mode == 'knowledge':
                if getattr(current_user, "is_admin", False):
                    # Admin gets everything
                    knowledges = Knowledge.query.order_by(Knowledge.name).all()
                else:
                    user_id = current_user.get_id()
                    knowledges = []
                    if user_id:
                        user_group_ids = [ug.group_id for ug in UserGroup.query.filter_by(user_id=user_id).all()]
                        if user_group_ids:
                            knowledges = Knowledge.query.join(Knowledge.groups).filter(
                                Group.group_id.in_(user_group_ids)
                            ).distinct().order_by(Knowledge.name).all()
                            
                for k in knowledges:
                    knowledges_list.append({"id": k.id, "name": k.name})
                    # Use 'id' and 'name' for the library entries explicitly as frontend expects
                    knowledge_libraries_map[str(k.id)] = {
                        "name": k.name,
                        "libraries": [
                            {"id": lib.library_id, "name": lib.name}
                            for lib in k.libraries
                        ]
                    }

            return jsonify({
                'knowledges': knowledges_list,
                'knowledge_libraries_map': knowledge_libraries_map,
                'mode': vector_store_mode
            })
        except Exception as e:
            logger.error(f"API knowledges error: {e}", exc_info=True)
            return jsonify({'error': str(e)}), 500

    @app.route('/api/branding', methods=['GET'])
    def api_branding():
        """
        Return branding info (app name, logo URL) from AppSettings.
        Returns: {app_name, logo_url}
        """
        try:
            from modules.database import get_app_setting
            app_name = get_app_setting('app_name', default='SmartLib')
            logo_url = get_app_setting('logo_url', default=None)
            return jsonify({
                'app_name': app_name,
                'logo_url': logo_url,
            })
        except Exception as e:
            logger.error(f"API branding error: {e}", exc_info=True)
            return jsonify({'app_name': 'SmartLib', 'logo_url': None})

    @app.route('/api/document_content/<int:library_id>/<string:document_id>', methods=['GET'])
    @login_required
    def api_document_content(library_id, document_id):
        """
        Return the text chunks for a document stored in the sqlite-vec document_vectors table.
        Used by the DocumentViewer React component.

        URL params:
            library_id: Library integer ID (used to validate access)
            document_id: UUID string of the document

        Query params:
            page: Optional integer page filter

        Returns:
            {name, document_id, library_id, page_filter, chunks: [{content, page, metadata}], total_chunks}
        """
        try:
            import json
            import sqlite3
            from flask import current_app, request

            page_filter = request.args.get('page', None)
            if page_filter is not None:
                try:
                    page_filter = int(page_filter)
                except ValueError:
                    page_filter = None

            # Lookup document name from DB
            from modules.database import Document
            doc_record = Document.query.filter_by(id=document_id).first()
            doc_name = doc_record.source if doc_record else document_id

            # Open raw sqlite3 connection to read document_vectors table
            db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
            db_path = db_uri.replace('sqlite:///', '', 1)
            table_name = current_app.config.get('SQLITE_VECTOR_TABLE_NAME', 'document_vectors')

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # Check if the table exists
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            if not cur.fetchone():
                conn.close()
                return jsonify({
                    'name': doc_name,
                    'document_id': document_id,
                    'library_id': library_id,
                    'page_filter': page_filter,
                    'chunks': [],
                    'total_chunks': 0,
                })

            cur.execute(f"SELECT text, metadata FROM {table_name}")
            rows = cur.fetchall()
            conn.close()

            chunks = []
            for row in rows:
                try:
                    meta = json.loads(row['metadata']) if row['metadata'] else {}
                except Exception:
                    meta = {}

                # Match by doc_id or document_id metadata field
                row_doc_id = meta.get('doc_id') or meta.get('document_id') or meta.get('source')
                if str(row_doc_id) != str(document_id):
                    continue

                page = meta.get('page') or meta.get('page_number')
                if page_filter is not None and str(page) != str(page_filter):
                    continue

                chunks.append({
                    'content': row['text'],
                    'page': page,
                    'metadata': meta,
                })

            return jsonify({
                'name': doc_name,
                'document_id': document_id,
                'library_id': library_id,
                'page_filter': page_filter,
                'chunks': chunks,
                'total_chunks': len(chunks),
            })

        except Exception as e:
            logger.error(f"API document_content error: {e}", exc_info=True)
            return jsonify({'error': str(e)}), 500
