from flask import Blueprint, render_template, abort, flash, redirect, url_for
from flask_login import login_required, current_user
import os
import glob
import json

vector_references_bp = Blueprint('vector_reference_logs', __name__, url_prefix='/admin/vector_reference_logs')

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
    log_dir = os.path.join('data', 'logs')
    log_pattern = os.path.join(log_dir, 'vector_references_*.log')
    log_files_paths = glob.glob(log_pattern)
    
    log_files = [os.path.basename(p) for p in log_files_paths]
    log_files.sort(reverse=True) # Show newest first

    return render_template('admin/vector_reference_logs.html', log_files=log_files)

@vector_references_bp.route('/view/<string:log_filename>')
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

    return render_template('admin/vector_references.html', references=references, log_filename=log_filename)
