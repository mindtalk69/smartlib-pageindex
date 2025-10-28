import logging

from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required
from modules.database import delete_url_download, get_url_downloads


downloads_bp = Blueprint('admin_downloads', __name__, url_prefix='/admin/downloads')


@downloads_bp.route('/')
@login_required
def download_management():
    try:
        downloads_raw = get_url_downloads()
        return render_template(
            'admin/downloads.html',
            downloads=downloads_raw,
            light_theme=request.cookies.get('light_theme') == 'true',
        )
    except Exception as e:
        logging.error(f"Error loading downloads: {e}")
        flash(f'Error loading downloads: {str(e)}', 'danger')
        return render_template('admin/downloads.html', downloads=[])


@downloads_bp.route('/delete/<int:download_id>', methods=['POST', 'DELETE'])
@login_required
def delete_download(download_id):
    try:
        if delete_url_download(download_id):
            return jsonify({"status": "success", "message": "Download removed."})
        return (
            jsonify({"status": "error", "message": "Download record not found."}),
            404,
        )
    except Exception as e:
        logging.error(f"Error deleting download {download_id}: {e}", exc_info=True)
        return (
            jsonify({
                "status": "error",
                "message": "Failed to delete download record.",
            }),
            500,
        )
