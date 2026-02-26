import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, logout as clearAuth } from '../lib/apiClient'

interface AdminUser {
    id: string
    username: string
    email?: string
    is_admin: boolean
}

interface AdminAuthContextType {
    admin: AdminUser | null
    isLoading: boolean
    isAuthenticated: boolean
    isAdmin: boolean
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const [admin, setAdmin] = useState<AdminUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const checkAuth = async () => {
        setIsLoading(true)
        try {
            const token = localStorage.getItem('auth_token')
            if (!token) {
                // No token - redirect to main app login
                console.log('No auth token found, redirecting to login')
                window.location.href = '/app/login'
                return
            }

            const response = await fetch('/api/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) {
                if (response.status === 401) {
                    // Token invalid - redirect to login
                    console.error('Token expired or invalid, redirecting to login')
                    localStorage.removeItem('auth_token')
                    window.location.href = '/app/login'
                    return
                }
                throw new Error('Auth check failed')
            }

            const data = await response.json()

            if (!data.user) {
                // No user data - redirect to login
                console.error('No user data in auth response')
                window.location.href = '/app/login'
                return
            }

            if (!data.user.is_admin) {
                // Not admin - redirect to main app with error
                console.error('Non-admin user attempted to access admin app')
                window.location.href = '/app?error=admin_required'
                return
            }

            // Valid admin user
            setAdmin({
                id: data.user.id,
                username: data.user.username,
                email: data.user.email,
                is_admin: data.user.is_admin,
            })
        } catch (err) {
            console.error('Auth check failed:', err)
            window.location.href = '/app/login'
        } finally {
            setIsLoading(false)
        }
    }

    const logout = async () => {
        try {
            // Call logout endpoint to invalidate session
            await api.post('/api/v1/auth/logout', null)
        } catch (err) {
            console.error('Logout error:', err)
        } finally {
            // Clear local auth data
            clearAuth()
            setAdmin(null)
            // Redirect to login
            window.location.href = '/app/login'
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    return (
        <AdminAuthContext.Provider
            value={{
                admin,
                isLoading,
                isAuthenticated: !!admin,
                isAdmin: admin?.is_admin ?? false,
                logout,
                checkAuth,
            }}
        >
            {children}
        </AdminAuthContext.Provider>
    )
}

export function useAdminAuth() {
    const context = useContext(AdminAuthContext)
    if (!context) {
        throw new Error('useAdminAuth must be used within an AdminAuthProvider')
    }
    return context
}
