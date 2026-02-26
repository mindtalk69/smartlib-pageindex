import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, storeToken, logout as clearAuth } from '@/utils/apiClient'

interface User {
    id: string
    username: string
    is_admin: boolean
    email?: string
}

interface AuthContextType {
    user: User | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
    register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
    changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/me', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
                    'Content-Type': 'application/json',
                },
            })
            if (response.ok) {
                const data = await response.json()
                if (data.authenticated && data.user) {
                    setUser({
                        id: data.user.id,
                        username: data.user.username,
                        is_admin: data.user.is_admin,
                        email: data.user.email,
                    })
                    return
                }
            }
            setUser(null)
        } catch (err) {
            console.error('Auth check failed:', err)
            setUser(null)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    const login = async (username: string, password: string) => {
        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            })

            const data = await response.json()

            if (response.ok && data.success && data.access_token) {
                // Store JWT token
                storeToken(data.access_token)
                // Store user info
                if (data.user) {
                    setUser({
                        id: data.user.id,
                        username: data.user.username,
                        is_admin: data.user.is_admin,
                        email: data.user.email,
                    })
                    localStorage.setItem('user', JSON.stringify(data.user))
                }
                return { success: true }
            } else {
                return { success: false, error: data.error || 'Login failed' }
            }
        } catch (err) {
            console.error('Login error:', err)
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    const logout = async () => {
        try {
            // Call logout endpoint to invalidate session
            await api.post('/api/v1/auth/logout', null, { requiresAuth: true })
        } catch (err) {
            console.error('Logout error:', err)
        } finally {
            // Clear local auth data
            clearAuth()
            setUser(null)
        }
    }

    const register = async (username: string, email: string, password: string) => {
        try {
            const response = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            })

            const data = await response.json()

            if (response.ok) {
                return { success: true }
            } else {
                return { success: false, error: data.detail || 'Registration failed' }
            }
        } catch (err) {
            console.error('Register error:', err)
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    const changePassword = async (currentPassword: string, newPassword: string) => {
        try {
            const data = await api.post<{ success: boolean; message?: string }>(
                '/api/v1/auth/change-password',
                { current_password: currentPassword, new_password: newPassword },
                { requiresAuth: true }
            )
            return { success: true }
        } catch (err: any) {
            console.error('Password change error:', err)
            return {
                success: false,
                error: err.message || 'Password change failed'
            }
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
                checkAuth,
                register,
                changePassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
