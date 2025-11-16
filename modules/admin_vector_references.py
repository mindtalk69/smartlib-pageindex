from flask import Blueprint, render_template, abort, flash, redirect, url_for, current_app
from flask_login import login_required, current_user
import os
import glob
import json

vector_references_bp = Blueprint('vector_reference_logs', __name__, url_prefix='/admin/vector_reference_logs')


def _get_log_directory() -> str:
    base_dir = current_app.config.get('LOG_DIR')
    if not base_dir:
        data_volume = current_app.config.get('DATA_VOLUME_PATH') or os.path.join(current_app.root_path, 'data')
        base_dir = os.path.join(data_volume, 'logs')
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

@vector_references_bp.before_request
@login_required
def check_admin():
    if not current_user.is_admin:
        flash('Admin access required', 'danger')
        return redirect(url_for('index'))

@vector_references_bp.route('/')
def list_vector_reference_logs():
    """
    Lists all available vector reference log files.
    """
    log_dir = _get_log_directory()
    log_pattern = os.path.join(log_dir, 'vector_references_*.log')
    log_files_paths = glob.glob(log_pattern)
    
    log_files = [os.path.basename(p) for p in log_files_paths]
    log_files.sort(reverse=True) # Show newest first

    return render_template(
        'admin/vector_reference_logs.html',
        log_files=log_files,
        log_directory=log_dir,
    )

@vector_references_bp.route('/view/<string:log_filename>')
def view_vector_reference_log(log_filename):
    """
    Displays the content of a specific vector reference log file.
    """
    log_dir = _get_log_directory()
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

    log_stats = {}
    if references:
        log_stats['total_entries'] = len(references)
        log_stats['unique_files'] = len({ref.get('file_id') for ref in references if ref.get('file_id')})

        file_counts = {}
        for ref in references:
            file_id = ref.get('file_id')
            if file_id:
                file_counts[file_id] = file_counts.get(file_id, 0) + 1
        log_stats['file_counts'] = file_counts

        timestamps = [ref.get('timestamp') for ref in references if ref.get('timestamp')]
        if timestamps:
            timestamps.sort()
            log_stats['date_range'] = f"{timestamps[0][:10]} to {timestamps[-1][:10]}"
        else:
            log_stats['date_range'] = "N/A"

    return render_template(
        'admin/vector_reference_log_view.html',
        references=references,
        log_filename=log_filename,
        log_stats=log_stats,
        log_directory=log_dir,
    )
