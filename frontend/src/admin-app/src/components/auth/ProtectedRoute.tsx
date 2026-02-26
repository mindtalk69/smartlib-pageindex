import { useEffect, ReactNode } from 'react'
import { useAdminAuth } from '../../hooks/useAdminAuth'

/**
 * ProtectedRoute - Route wrapper that checks admin access before rendering
 *
 * Behavior:
 * - Shows loading state while validating authentication
 * - Redirects unauthenticated users to /app/login
 * - Redirects non-admin users to /app with error message
 * - Renders children only for authenticated admin users
 */
export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
    const { admin, isLoading, isAuthenticated, isAdmin } = useAdminAuth()

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                // Not logged in - redirect to main app login
                console.log('Unauthenticated user accessing protected route, redirecting to login')
                window.location.href = '/app/login'
            } else if (!isAdmin) {
                // Not admin - redirect to main app with error
                console.log('Non-admin user accessing admin route, redirecting to main app')
                window.location.href = '/app?error=admin_required'
            }
        }
    }, [isLoading, isAuthenticated, isAdmin])

    // Show loading state while validating auth
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        )
    }

    // Not authenticated or not admin - return null (redirect will happen via useEffect)
    if (!isAuthenticated || !admin?.is_admin) {
        return null
    }

    // Authenticated admin - render children
    return <>{children}</>
}
