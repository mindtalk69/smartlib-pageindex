from flask import Blueprint, render_template, request, flash
from modules.database import get_url_downloads
import logging

downloads_bp = Blueprint('admin_downloads', __name__, url_prefix='/admin/downloads')

@downloads_bp.route('/')
def download_management():
    try:
        downloads_raw = get_url_downloads()
        return render_template('admin/downloads.html',
                               downloads=downloads_raw,
                               light_theme=request.cookies.get('light_theme') == 'true')
    except Exception as e:
        logging.error(f"Error loading downloads: {e}")
        flash(f'Error loading downloads: {str(e)}', 'danger')
        return render_template('admin/downloads.html', downloads=[])
