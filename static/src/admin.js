// Vite entrypoint for admin pages. This mirrors the legacy script order
// so that shared helpers and utilities register their globals before any
// page-specific inline scripts run.

import '../js/darkmode.js';
import '../js/csrf-utils.js';
import '../js/admin/admin-form-utils.js';
import '../js/admin/admin-datatables.js';
