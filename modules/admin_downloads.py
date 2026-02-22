import logging

from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required
from modules.database import delete_url_download, get_url_downloads


downloads_bp = Blueprint('admin_downloads', __name__, url_prefix='/admin/downloads')

# Also register at /api/admin/downloads for frontend use
api_downloads_bp = Blueprint(
    'api_admin_downloads',
    __name__,
    url_prefix='/api/admin/downloads'
)


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


@downloads_bp.route('/api/downloads/', methods=['GET'])
@login_required
def list_downloads_api():
    """API endpoint to get all URL downloads as JSON."""
    try:
        downloads = get_url_downloads()
        # Convert to list of dicts if needed
        if hasattr(downloads[0], '__dict__') if downloads else False:
            downloads_data = []
            for d in downloads:
                downloads_data.append({
                    'id': d.id,
                    'url': d.url,
                    'library_name': d.library_name,
                    'knowledge_name': d.knowledge_name,
                    'metadata_summary': d.metadata_summary,
                    'status': d.status,
                    'content_type': d.content_type,
                    'username': d.username,
                    'processed_at': d.processed_at.isoformat() if d.processed_at else None,
                    'is_ocr': d.is_ocr,
                    'error_message': d.error_message,
                })
            return jsonify({'success': True, 'data': downloads_data})
        return jsonify(downloads)
    except Exception as e:
        logging.error(f"Error fetching downloads API: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


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


# API routes for frontend (mirroring the admin routes)
@api_downloads_bp.route('/', methods=['GET'])
@login_required
def api_list_downloads():
    """API endpoint to get all URL downloads as JSON."""
    try:
        downloads = get_url_downloads()
        # Convert to list of dicts if needed
        if downloads and hasattr(downloads[0], '__dict__'):
            downloads_data = []
            for d in downloads:
                downloads_data.append({
                    'id': d.id,
                    'url': d.url,
                    'library_name': d.library_name,
                    'knowledge_name': d.knowledge_name,
                    'metadata_summary': d.metadata_summary,
                    'status': d.status,
                    'content_type': d.content_type,
                    'username': d.username,
                    'processed_at': d.processed_at.isoformat() if d.processed_at else None,
                    'is_ocr': d.is_ocr,
                    'error_message': d.error_message,
                })
            return jsonify({'success': True, 'data': downloads_data})
        return jsonify(downloads)
    except Exception as e:
        logging.error(f"Error fetching downloads API: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_downloads_bp.route('/delete/<int:download_id>', methods=['POST', 'DELETE'])
@login_required
def api_delete_download(download_id):
    """API endpoint to delete a download record - wraps the admin delete_download function."""
    return delete_download(download_id)
