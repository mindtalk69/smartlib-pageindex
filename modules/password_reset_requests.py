import logging

from flask import flash, redirect, render_template, request, url_for
from sqlalchemy import func

from modules.database import User, create_password_reset_request, get_user_by_username_local

logger = logging.getLogger(__name__)


def init_password_reset_requests(app):
    @app.route('/forgot-password', methods=['GET', 'POST'], endpoint='request_password_reset')
    def request_password_reset():
        form_data = {
            'username': request.form.get('username', '').strip(),
            'email': request.form.get('email', '').strip(),
            'reason': request.form.get('reason', '').strip(),
        } if request.method == 'POST' else {
            'username': '',
            'email': '',
            'reason': '',
        }

        if request.method == 'POST':
            username = form_data['username']
            email = form_data['email']
            reason = form_data['reason']

            if not username or not email:
                flash('Username and email are required to verify your account.', 'danger')
                return render_template('forgot_password.html', form_data=form_data)

            email_lower = email.lower()
            user = get_user_by_username_local(username)
            if not user and email_lower:
                user = (
                    User.query.filter(
                        User.auth_provider == 'local',
                        func.lower(User.email) == email_lower,
                    )
                    .order_by(User.created_at.desc())
                    .first()
                )

            if not user:
                flash('No local SmartLib account matches those details.', 'danger')
                return render_template('forgot_password.html', form_data=form_data)

            if user.auth_provider != 'local':
                flash('Password resets for federated accounts must happen with your identity provider.', 'warning')
                return render_template('forgot_password.html', form_data=form_data)

            if user.email and user.email.strip().lower() != email_lower:
                flash('The email you entered does not match what we have on file.', 'danger')
                return render_template('forgot_password.html', form_data=form_data)

            reset_request, created = create_password_reset_request(
                user,
                request_reason=reason,
                contact_email=email,
            )
            if created:
                logger.info('Password reset request created for user %s', user.user_id)
                flash('Thanks! We logged your request. An administrator will reach out with next steps.', 'success')
            else:
                flash('You already have an open password reset request. An administrator will follow up soon.', 'info')
            return redirect(url_for('login_route'))

        return render_template('forgot_password.html', form_data=form_data)
