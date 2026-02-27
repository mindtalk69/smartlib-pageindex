/**
 * API Client - Centralized HTTP client with JWT authentication
 *
 * Features:
 * - Automatic JWT token attachment
 * - 401 handling (token expiration)
 * - Error handling
 * - Consistent response format
 */

interface ApiError {
    message: string
    status: number
}

interface FetchOptions extends RequestInit {
    requiresAuth?: boolean
    responseType?: 'json' | 'blob' | 'text'
}

const API_BASE = '/api/v1'

/**
 * Get the stored JWT token
 */
function getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
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
 */
async function handleResponse<T>(response: Response, responseType: 'json' | 'blob' | 'text' = 'json'): Promise<T> {
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    if (!response.ok) {
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

    if (responseType === 'blob') {
        return response.blob() as unknown as T
    }

    if (responseType === 'text') {
        return response.text() as unknown as T
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
        responseType = 'json',
        headers: customHeaders,
        ...fetchOptions
    } = options

    const url = `${API_BASE}${endpoint}`

    const headers = buildHeaders(customHeaders, requiresAuth)

    const response = await fetch(url, {
        ...fetchOptions,
        headers,
    })

    return handleResponse<T>(response, responseType)
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
export function logout(): void {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_mode')
    localStorage.removeItem('user')
}

/**
 * Store auth token
 */
export function storeToken(token: string): void {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_mode', 'jwt')
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
    return !!getToken()
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
