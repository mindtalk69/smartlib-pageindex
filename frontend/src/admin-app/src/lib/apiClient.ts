/**
 * API Client - Centralized HTTP client with JWT authentication for Admin App
 *
 * Features:
 * - Automatic JWT token attachment (shared with main app)
 * - 401 handling (token expiration) - redirects to /app/login
 * - 403 handling (non-admin access) - redirects to /app with error
 * - Error handling
 * - Consistent response format
 */

interface ApiError {
    message: string
    status: number
}

interface FetchOptions extends RequestInit {
    requiresAuth?: boolean
}

const API_BASE = ''

/**
 * Get the stored JWT token (shared with main app)
 */
function getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
    return !!getToken()
}

/**
 * Build headers with authentication
 */
function buildHeaders(customHeaders?: HeadersInit, requiresAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    if (customHeaders) {
        Object.assign(headers, customHeaders)
    }

    if (requiresAuth) {
        const token = getToken()
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
    }

    return headers
}

/**
 * Handle API response - check for errors and parse JSON
 * Handles 401 (unauthorized) and 403 (forbidden) responses
 */
async function handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    if (!response.ok) {
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
            console.error('Token expired or invalid, redirecting to login')
            localStorage.removeItem('auth_token')
            window.location.href = '/app/login'
            throw { message: 'Unauthorized', status: 401 } as ApiError
        }

        // Handle 403 Forbidden - non-admin user accessing admin endpoint
        if (response.status === 403) {
            console.error('Access denied. Admin privileges required.')
            window.location.href = '/app?error=admin_required'
            throw { message: 'Access denied. Admin privileges required.', status: 403 } as ApiError
        }

        if (isJson) {
            const errorData = await response.json()
            const error: ApiError = {
                message: errorData.detail || errorData.error || errorData.message || 'Request failed',
                status: response.status,
            }
            throw error
        } else {
            const error: ApiError = {
                message: `HTTP ${response.status}: ${response.statusText}`,
                status: response.status,
            }
            throw error
        }
    }

    if (isJson) {
        return response.json()
    }

    return {} as T
}

/**
 * Generic fetch wrapper with authentication
 */
async function apiFetch<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const {
        requiresAuth = true,
        headers: customHeaders,
        ...fetchOptions
    } = options

    const url = `${API_BASE}${endpoint}`

    const headers = buildHeaders(customHeaders, requiresAuth)

    const response = await fetch(url, {
        ...fetchOptions,
        headers,
    })

    return handleResponse<T>(response)
}

/**
 * GET request
 */
export async function get<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    return apiFetch<T>(endpoint, { ...options, method: 'GET' })
}

/**
 * POST request
 */
export async function post<T, B = unknown>(
    endpoint: string,
    body?: B,
    options: FetchOptions = {}
): Promise<T> {
    return apiFetch<T>(endpoint, {
        ...options,
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    })
}

/**
 * PUT request
 */
export async function put<T, B = unknown>(
    endpoint: string,
    body?: B,
    options: FetchOptions = {}
): Promise<T> {
    return apiFetch<T>(endpoint, {
        ...options,
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
    })
}

/**
 * DELETE request
 */
export async function del<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    return apiFetch<T>(endpoint, { ...options, method: 'DELETE' })
}

/**
 * Logout and clear auth data
 */
export async function logout(): Promise<void> {
    try {
        // Call logout endpoint to invalidate session
        await post('/api/v1/auth/logout', null)
    } catch (err) {
        console.error('Logout error:', err)
    } finally {
        // Clear local auth data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_mode')
        localStorage.removeItem('user')
        // Redirect to login
        window.location.href = '/app/login'
    }
}

/**
 * Store auth token (shared with main app)
 */
export function storeToken(token: string): void {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_mode', 'jwt')
}

/**
 * API client object for convenient imports
 */
export const api = {
    get,
    post,
    put,
    delete: del,
    logout,
    storeToken,
    isAuthenticated,
    getToken,
}

export default api
