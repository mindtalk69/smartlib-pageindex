import { create } from 'zustand'
import { authApi, type User } from '@/lib/api-client'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  reset: () => {
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true })
    try {
      // Login sets session cookie
      await authApi.login({ username, password })
      console.log('Login successful, fetching user data...')

      // Give Flask a moment to set the session cookie
      await new Promise(resolve => setTimeout(resolve, 100))

      // Fetch current user after successful login
      await get().checkAuth()
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },

  checkAuth: async () => {
    try {
      const response = await authApi.getCurrentUser()
      if (response.success && response.data) {
        console.log('User authenticated:', response.data)
        set({
          user: response.data,
          isAuthenticated: true,
        })
      } else {
        console.log('No authenticated user')
        set({ user: null, isAuthenticated: false })
      }
    } catch (error) {
      console.log('Auth check failed (not logged in):', error)
      set({ user: null, isAuthenticated: false })
    }
  },
}))
