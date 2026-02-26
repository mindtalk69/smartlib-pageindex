/**
 * useAdminAuth - Convenience hook for admin auth operations
 *
 * Re-exports useAdminAuth from AdminAuthContext for cleaner imports.
 * Usage:
 *   import { useAdminAuth } from '@/hooks/useAdminAuth'
 */

import { useAdminAuth as useAdminAuthHook } from '../contexts/AdminAuthContext'

export const useAdminAuth = useAdminAuthHook
export default useAdminAuth
