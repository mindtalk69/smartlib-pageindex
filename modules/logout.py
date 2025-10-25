from flask import redirect, url_for, flash, session
from flask_login import logout_user, login_required

def init_logout(app):
    @app.route('/logout', endpoint='logout')
    @login_required # Logout should only be accessible if logged in
    def logout():
        # Perform logout using Flask-Login
        logout_user()
        # Clear the session data
        session.clear()
        flash('You have been logged out.', 'info')
        # Redirect to the correct login route endpoint
        return redirect(url_for('login_route'))
