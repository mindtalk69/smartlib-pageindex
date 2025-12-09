// Upload Status Tracker
// Polls backend for upload task status and updates navbar badge + dropdown

class UploadStatusTracker {
    constructor() {
        this.pollInterval = 5000; // 5 seconds
        this.timer = null;
        this.activeTasks = new Map(); // Track task states for toast notifications
        this.init();
    }

    init() {
        // Check if user is authenticated
        const uploadBtn = document.getElementById('upload-status-btn');
        if (!uploadBtn) {
            console.log('[UploadStatus] Not authenticated, skipping initialization');
            return;
        }

        // Start polling
        this.startPolling();

        // Listen for new upload submissions from upload page
        document.addEventListener('file-uploaded', (e) => {
            console.log('[UploadStatus] File uploaded event:', e.detail);
            this.addTask(e.detail.task_id, e.detail.filename);
            this.refresh();
        });

        // Refresh when dropdown is opened
        uploadBtn.addEventListener('show.bs.dropdown', () => {
            this.refresh();
        });
    }

    startPolling() {
        if (this.timer) return;
        console.log('[UploadStatus] Starting polling');
        this.timer = setInterval(() => this.refresh(), this.pollInterval);
        this.refresh(); // Initial load
    }

    stopPolling() {
        if (this.timer) {
            console.log('[UploadStatus] Stopping polling');
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async refresh() {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            if (!csrfToken) {
                console.warn('[UploadStatus] No CSRF token found');
                return;
            }

            const response = await fetch('/api/upload-status', {
                headers: {
                    'X-CSRFToken': csrfToken
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.updateUI(data.tasks || []);

            // Stop polling if no active tasks
            const hasActiveTasks = (data.tasks || []).some(
                t => t.status === 'PENDING' || t.status === 'PROGRESS'
            );

            if (!hasActiveTasks && this.timer) {
                // Keep polling for a bit after completion to show final state
                setTimeout(() => {
                    if (!this.hasActiveTasks()) {
                        this.stopPolling();
                    }
                }, 10000); // Stop after 10 seconds of no activity
            }
        } catch (error) {
            console.error('[UploadStatus] Failed to fetch upload status:', error);
        }
    }

    hasActiveTasks() {
        const list = document.getElementById('upload-status-list');
        if (!list) return false;

        const items = list.querySelectorAll('[data-task-id]');
        return Array.from(items).some(item => {
            const status = item.dataset.status;
            return status === 'PENDING' || status === 'PROGRESS';
        });
    }

    updateUI(tasks) {
        const badge = document.getElementById('upload-count-badge');
        const list = document.getElementById('upload-status-list');

        if (!badge || !list) return;

        // Update badge
        const activeCount = tasks.filter(
            t => t.status === 'PENDING' || t.status === 'PROGRESS'
        ).length;

        if (activeCount > 0) {
            badge.textContent = activeCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }

        // Update list
        if (tasks.length === 0) {
            list.innerHTML = '<div class="list-group-item text-center text-muted small">No active uploads</div>';
            return;
        }

        list.innerHTML = tasks.map(task => this.renderTask(task)).join('');

        // Show completion toast for newly completed tasks
        tasks.forEach(task => {
            const previousStatus = this.activeTasks.get(task.task_id);

            // Show toast if task just completed
            if (task.status === 'SUCCESS' && previousStatus && previousStatus !== 'SUCCESS') {
                this.showCompletionToast(task);
                // Auto-dismiss successful uploads after 30 seconds
                setTimeout(() => this.autoDismissTask(task.task_id), 30000);
            } else if (task.status === 'FAILURE' && previousStatus && previousStatus !== 'FAILURE') {
                this.showFailureToast(task);
                // Auto-dismiss failed uploads after 15 seconds (shorter so user notices faster)
                setTimeout(() => this.autoDismissTask(task.task_id), 15000);
            }

            this.activeTasks.set(task.task_id, task.status);
        });
    }

    async autoDismissTask(taskId) {
        // Only dismiss if still in completed/failed state
        const item = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!item) return;

        const status = item.dataset.status;
        if (status === 'SUCCESS' || status === 'FAILURE') {
            await dismissTask(taskId);
        }
    }

    renderTask(task) {
        const statusIcons = {
            'PENDING': '<i class="bi bi-clock-fill text-warning"></i>',
            'PROGRESS': '<i class="bi bi-arrow-repeat text-primary spinner-icon"></i>',
            'SUCCESS': '<i class="bi bi-check-circle-fill text-success"></i>',
            'FAILURE': '<i class="bi bi-x-circle-fill text-danger"></i>'
        };

        const statusText = {
            'PENDING': 'Queued',
            'PROGRESS': task.info?.stage || 'Processing...',
            'SUCCESS': 'Completed',
            'FAILURE': 'Failed'
        };

        const progressBar = task.status === 'PROGRESS' && task.info?.progress !== undefined ? `
            <div class="progress mt-2" style="height: 4px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated"
                     role="progressbar"
                     style="width: ${task.info.progress}%"
                     aria-valuenow="${task.info.progress}"
                     aria-valuemin="0"
                     aria-valuemax="100"></div>
            </div>
        ` : '';

        const dismissBtn = task.status === 'SUCCESS' || task.status === 'FAILURE' ? `
            <button class="btn btn-sm btn-link text-muted p-0"
                    onclick="dismissTask('${task.task_id}')"
                    title="Dismiss">
                <i class="bi bi-x-lg"></i>
            </button>
        ` : '';

        return `
            <div class="list-group-item" data-task-id="${task.task_id}" data-status="${task.status}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1 me-2">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            ${statusIcons[task.status] || ''}
                            <span class="fw-medium text-truncate small"
                                  style="max-width: 200px;"
                                  title="${this.escapeHtml(task.filename)}">
                                ${this.escapeHtml(task.filename)}
                            </span>
                        </div>
                        <small class="text-muted">${statusText[task.status]}</small>
                        ${progressBar}
                    </div>
                    ${dismissBtn}
                </div>
                ${task.status === 'FAILURE' && task.info?.error ? `
                    <div class="alert alert-danger mt-2 mb-0 py-1 px-2 small">
                        ${this.escapeHtml(task.info.error)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showCompletionToast(task) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        // Dispatch event for other UI components to refresh (e.g., document selectors)
        document.dispatchEvent(new CustomEvent('upload-complete', {
            detail: { task_id: task.task_id, filename: task.filename }
        }));

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="toast-header bg-success text-white">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong class="me-auto">Upload Complete</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                <strong>${this.escapeHtml(task.filename)}</strong> has been processed successfully.<br>
                <small class="text-muted">📚 Indexing complete! You can start querying now.</small><br>
                <small class="text-muted opacity-75">Note: On Azure, it may take ~15-30 seconds for the index to sync.</small>
            </div>
        `;

        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
        bsToast.show();

        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    showFailureToast(task) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="toast-header bg-danger text-white">
                <i class="bi bi-x-circle-fill me-2"></i>
                <strong class="me-auto">Upload Failed</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                <strong>${this.escapeHtml(task.filename)}</strong> processing failed.
                ${task.info?.error ? `<br><small class="text-muted">${this.escapeHtml(task.info.error)}</small>` : ''}
            </div>
        `;

        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 8000 });
        bsToast.show();

        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    addTask(taskId, filename) {
        console.log('[UploadStatus] Adding task:', taskId, filename);
        this.activeTasks.set(taskId, 'PENDING');
        this.startPolling();
    }
}

// Global functions for inline onclick handlers
function refreshUploadStatus() {
    if (window.uploadTracker) {
        window.uploadTracker.refresh();
    }
}

async function dismissTask(taskId) {
    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        const response = await fetch(`/api/upload-status/${taskId}/dismiss`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken
            }
        });

        if (response.ok) {
            // Remove from UI immediately
            const item = document.querySelector(`[data-task-id="${taskId}"]`);
            if (item) {
                item.remove();
            }

            // Refresh to update badge count
            if (window.uploadTracker) {
                window.uploadTracker.refresh();
            }
        }
    } catch (error) {
        console.error('[UploadStatus] Failed to dismiss task:', error);
    }
}

// CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
    .spinner-icon {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[UploadStatus] Initializing tracker');
    window.uploadTracker = new UploadStatusTracker();
});
