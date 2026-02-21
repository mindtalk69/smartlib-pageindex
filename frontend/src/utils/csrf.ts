/**
 * CSRF Token Utility for React
 * 
 * Gets CSRF token from:
 * 1. Meta tag in document head (set by Flask base.html)
 * 2. API endpoint /api/csrf-token (fallback)
 */

let cachedToken: string | null = null

/**
 * Get CSRF token from meta tag or fetch from API
 */
export async function getCsrfToken(): Promise<string> {
    // Try to get from meta tag first (fastest)
    const metaTag = document.querySelector('meta[name="csrf-token"]')
    if (metaTag) {
        return metaTag.getAttribute('content') || ''
    }

    // If cached, return cached token
    if (cachedToken) {
        return cachedToken
    }

    // Fetch from API endpoint
    try {
        const res = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include',
        })
        if (res.ok) {
            const data = await res.json()
            cachedToken = data.csrf_token
            return cachedToken || ''
        }
    } catch (err) {
        console.error('Failed to fetch CSRF token:', err)
    }

    return ''
}

/**
 * Synchronous version - returns cached token or empty string
 */
export function getCsrfTokenSync(): string {
    // Try meta tag first
    const metaTag = document.querySelector('meta[name="csrf-token"]')
    if (metaTag) {
        return metaTag.getAttribute('content') || ''
    }
    return cachedToken || ''
}

/**
 * Clear cached token (call after logout or session change)
 */
export function clearCsrfCache(): void {
    cachedToken = null
}
