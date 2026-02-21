"""
API Authentication endpoints for React frontend.
"""

from flask import request, jsonify, session
from flask_login import login_user, logout_user, current_user
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
