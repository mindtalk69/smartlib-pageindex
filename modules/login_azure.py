from flask import redirect, url_for, session, request, flash, current_app # Added flash and current_app
import msal
import os
import logging # Import logging
from .database import create_user, get_user_by_id # Added get_user_by_id
import requests
import json

DEFAULT_SCOPES=["User.ReadBasic.All",]
END_POINT = "https://graph.microsoft.com/v1.0/me"

def init_login_azure(app):
    @app.route('/login_azure', endpoint='login_azure')
    def login_azure():
        # Get Azure AD config from Flask app config        
        client_id = current_app.config.get("APP_CLIENT_ID")
        client_secret = current_app.config.get("APP_CLIENT_SECRET")
        client_tenant = current_app.config.get("APP_TENANT_ID")
        authority = f"https://login.microsoftonline.com/{client_tenant}"
        redirect_uri = current_app.config.get("REDIRECT_URI")

        # Check if Azure login is enabled via feature flag
        if not current_app.config.get('FEATURE_AZURE_LOGIN_ENABLED', False):
            logging.warning("Azure login attempt failed: Feature is disabled in configuration.")
            flash("Azure login is currently disabled.", "warning")
            return redirect(url_for('login_route')) # Redirect to standard login

        # Validate required configuration
        if not all([client_id, client_secret, authority, redirect_uri]):
            logging.error("Azure AD application configuration is incomplete (APP_CLIENT_ID, APP_CLIENT_SECRET, APP_AUTHORITY, REDIRECT_URI).")
            flash("Server configuration error prevents Azure login.", "danger")
            return redirect(url_for('login_route')) # Redirect to standard login or an error page

        # test debug ensure the client_secret is correct
        # print("REDIRECT:", redirect_uri) # Use variable loaded from config

        # Create MSAL confidential client
        try:
            client = msal.ConfidentialClientApplication(
                client_id,
                authority=authority,
                client_credential=client_secret
            )
        except Exception as e:
            logging.error(f"Failed to initialize MSAL client: {e}", exc_info=True)
            flash("Error initializing authentication service.", "danger")
            return redirect(url_for('login_route'))

        code = request.args.get('code')

        if code:
            # Process the callback from Azure after authentication
            result = client.acquire_token_by_authorization_code(
                code,
                scopes=DEFAULT_SCOPES,
                redirect_uri=redirect_uri
            )
            if "error" in result:
                return "Login failed: " + result.get("error_description")
            
            if "access_token" in result:
                # Get user email from Graph API
                graph_data = requests.get(
                    END_POINT,
                    headers={'Authorization': 'Bearer ' + result['access_token']},
                ).json()
                user_email = graph_data.get("mail")
                                    
            user_claims = result.get("id_token_claims")
            if not user_email:
                user_email = user_claims.get("email", user_claims.get("preferred_username", "Unknown"))
            
            # Create/update user in database
            create_user(
                auth_provider="azure",
                user_id=user_claims["oid"],
                username=user_email,
                azure_oid=user_claims["oid"],
                email=user_email
            )

            # --- Check if user is disabled ---
            db_user_data = get_user_by_id(user_claims["oid"])
            if db_user_data and db_user_data.is_disabled:
                flash('Your account is disabled. Please contact an administrator.', 'danger')
                # Redirect to index or a specific login error page
                return redirect(url_for("index")) 
            # --- End check ---

            # Create Flask-Login user object (only if not disabled)
            from flask_login import login_user
            from types import SimpleNamespace
            user = SimpleNamespace(
                id=user_claims["oid"],
                username=user_email,
                is_authenticated=True,
                is_admin=False,  # Admins must be promoted via admin interface
                get_id=lambda: user_claims["oid"],
                is_active=True
            )
            login_user(user)
            
            # Set session data
            session["user"] = {
                "user_id": user_claims["oid"],
                "username": user_email,
                "email": user_email,
                "auth_provider": "azure"
            }
            return redirect(url_for("index"))
        else:
            # Generate the authorization URL and redirect user to Azure login page
            auth_url = client.get_authorization_request_url(
                scopes=["User.Read"],
                redirect_uri=redirect_uri
            )
            return redirect(auth_url)
