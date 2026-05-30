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
  | 'influencers'
  | 'clients'
  | 'deliverables'
  | 'approvals'
  | 'finance'
  | 'invoices'
  | 'payments'
  | 'analytics'
  | 'workflows'
  | 'settings'
  | 'users'
  | 'organization'

export type Permission = `${PermissionResource}:${PermissionAction}`

export type RolePermissionMap = Record<UserRole, Permission[]>

export interface PermissionGuardProps {
  permission: Permission | Permission[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}
