import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
    id: number
    username: string
    is_admin: boolean
}

interface AuthContextType {
    user: User | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/me', {
                credentials: 'include',
            })
            if (response.ok) {
                const data = await response.json()
                setUser(data.user)
            } else {
                setUser(null)
            }
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
            const response = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setUser(data.user)
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
            await fetch('/logout', {
                method: 'GET',
                credentials: 'include',
            })
        } catch (err) {
            console.error('Logout error:', err)
        } finally {
            setUser(null)
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
