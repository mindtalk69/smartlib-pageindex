/**
 * CSRF Utility for Flask apps (global for user and admin)
 * Usage:
 *   - Call getNewCsrfToken() to fetch and update the CSRF token in hidden input and meta tag.
 *   - Optionally, use fetchWithCsrfRetry() to automatically retry requests on CSRF error.
 */

/**
 * Reads the current CSRF token from the DOM (meta tag or hidden input).
 * This does NOT fetch a new token.
 * @returns {string} The current CSRF token or an empty string if not found.
 */
function readCurrentCsrfToken() {
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta && csrfMeta.getAttribute('content')) {
        return csrfMeta.getAttribute('content');
    }
    const csrfInput = document.querySelector('input[name="csrf_token"]');
    if (csrfInput && csrfInput.value) {
        return csrfInput.value;
    }
    console.warn('CSRF token not found in meta tag or hidden input.');
    return '';
}


function getNewCsrfToken() {
    return fetch('/api/csrf-token')
    .then(response => {
        if (!response.ok) {
            console.error('[CSRF] Failed to fetch new CSRF token, status:', response.status);
            throw new Error(`CSRF token fetch failed: ${response.status}`);
        }
        return response.json();
    })
        .then(data => {
            if (!data || !data.csrf_token) {
                console.error('[CSRF] Invalid CSRF token data received:', data);
                throw new Error('Invalid CSRF token data from server');
            }
            console.log('[CSRF] New CSRF token received.');
            // Update hidden input
            const csrfInput = document.querySelector('input[name="csrf_token"]');
            if (csrfInput) {
                console.log('[CSRF] Updating hidden input csrf_token.');
                csrfInput.value = data.csrf_token;
            }
            // Update meta tag
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            if (csrfMeta) {
                console.log('[CSRF] Updating meta tag csrf-token.');
                csrfMeta.setAttribute('content', data.csrf_token);
            }
            return data.csrf_token;
        })
        .catch(error => {
            console.error('[CSRF] Error in getNewCsrfToken:', error);
            throw error; // Re-throw to ensure calling code knows about the failure
        });
}

// Optional: fetch wrapper that retries once on CSRF error (status 400 or 403)
function fetchWithCsrfRetry(url, options) {
    const originalOptions = { ...(options || {}) }; // Ensure options is an object and clone it

    // Ensure X-CSRFToken is present in the initial request if not already set by caller
    if (!originalOptions.headers || !originalOptions.headers['X-CSRFToken']) {
        const currentToken = readCurrentCsrfToken();
        if (currentToken) {
            originalOptions.headers = {
                ...(originalOptions.headers || {}),
                'X-CSRFToken': currentToken
            };
        } else {
            // If no token found, it might be a public endpoint or an initial page load scenario
            // where the token is expected to be in a form.
            // For AJAX, it's usually required.
            console.warn(`[CSRF] Token not found by readCurrentCsrfToken() for initial request to ${url}. Proceeding, but this might fail if CSRF is required.`);
        }
    }
    
    console.log(`[CSRF] fetchWithCsrfRetry: Initial attempt to ${url}`);

    return fetch(url, originalOptions).then(response => {
            if (!response.ok && (response.status === 400 || response.status === 403)) {                
                console.warn(`[CSRF] Request to ${url} failed with status ${response.status}. Assuming CSRF error, attempting token refresh and retry.`);
                return getNewCsrfToken().then(newToken => {                   
                    console.log(`[CSRF] Retrying request to ${url} with new CSRF token.`);
                    const retryOptions = { ...originalOptions };
                    retryOptions.headers = {
                        ...(originalOptions.headers || {}),
                        'X-CSRFToken': newToken
                    };
    
                    if (originalOptions.body instanceof FormData && typeof originalOptions.body.entries === 'function') {
                        console.warn("[CSRF] Retrying a request with FormData body. If the body was consumed, this retry might fail or send an empty body.");
                    }                    
                    return fetch(url, retryOptions);
                }).catch(tokenRefreshError => {
                    console.error(`[CSRF] Failed to refresh CSRF token or retry request to ${url}:`, tokenRefreshError);
                    return response; // Return original error response if token refresh fails
                });
            }
            return response;
    });
}

// Expose globally
window.readCurrentCsrfToken = readCurrentCsrfToken;
window.getNewCsrfToken = getNewCsrfToken;
window.fetchWithCsrfRetry = fetchWithCsrfRetry;
