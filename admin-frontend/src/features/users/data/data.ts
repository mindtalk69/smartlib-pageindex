import { Shield, UserCheck } from 'lucide-react'
import { type User } from './schema'

export const callTypes = new Map<string, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
])

export const roles = [
  {
    label: 'Admin',
    value: 'admin',
    icon: UserCheck,
  },
  {
    label: 'Superadmin',
    value: 'superadmin',
    icon: Shield,
  },
] as const

/**
 * Convert API user to table user format
 */
export function convertApiUserToTableUser(apiUser: User) {
  return {
    ...apiUser,
    status: apiUser.is_disabled ? 'inactive' as const : 'active' as const,
    role: apiUser.is_admin ? 'superadmin' as const : 'admin' as const,
  }
}
