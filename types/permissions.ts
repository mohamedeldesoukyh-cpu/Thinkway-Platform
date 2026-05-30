import type { UserRole } from './auth'

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export'
  | 'manage'
  | 'approve'
  | 'publish'

export type PermissionResource =
  | 'campaigns'
  | 'clients'
  | 'vendors'
  | 'billing'
  | 'finance'
  | 'invoices'
  | 'payments'
  | 'analytics'
  | 'workflows'
  | 'settings'
  | 'users'
  | 'organization'
  | 'approvals'
  | 'deliverables'
  | 'reports'
  | 'budget'
  | 'team'

export type Permission = `${PermissionResource}:${PermissionAction}`

export type RolePermissionMap = Record<UserRole, Permission[]>

export interface PermissionGuardProps {
  role: UserRole
  permission: Permission | Permission[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}
