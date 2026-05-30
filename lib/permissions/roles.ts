import type { UserRole } from '@/types/auth'
import type { Permission, PermissionAction, PermissionResource, RolePermissionMap } from '@/types/permissions'

export function p(resource: PermissionResource, action: PermissionAction): Permission {
  return `${resource}:${action}`
}

function read(resource: PermissionResource): Permission[] {
  return [p(resource, 'read')]
}

function crud(resource: PermissionResource): Permission[] {
  return [
    p(resource, 'create'),
    p(resource, 'read'),
    p(resource, 'update'),
    p(resource, 'delete'),
  ]
}

function full(resource: PermissionResource): Permission[] {
  return [
    p(resource, 'create'),
    p(resource, 'read'),
    p(resource, 'update'),
    p(resource, 'delete'),
    p(resource, 'export'),
    p(resource, 'manage'),
    p(resource, 'approve'),
    p(resource, 'publish'),
  ]
}

const ALL_RESOURCES: PermissionResource[] = [
  'campaigns', 'clients', 'vendors', 'billing', 'finance',
  'invoices', 'payments', 'analytics', 'workflows', 'settings',
  'users', 'organization', 'approvals', 'deliverables',
]

// Permission matrix per §6.2 of the system reference
export const ROLE_PERMISSIONS: RolePermissionMap = {
  admin: ALL_RESOURCES.flatMap(full),

  director: [
    ...full('campaigns'),
    ...full('clients'),
    ...full('vendors'),
    ...full('billing'),
    ...full('approvals'),
    ...full('deliverables'),
    ...crud('finance'),
    ...crud('invoices'),
    ...read('payments'),
    ...full('analytics'),
    ...crud('workflows'),
    ...read('settings'),
    ...read('users'),
    p('clients', 'approve'),
  ],

  manager: [
    ...crud('campaigns'),
    ...crud('clients'),
    ...crud('vendors'),
    ...read('billing'),
    p('billing', 'update'),
    ...read('finance'),
    ...read('invoices'),
    ...read('analytics'),
    ...read('workflows'),
    ...crud('approvals'),
    ...crud('deliverables'),
    p('reports', 'read') as Permission,
    p('reports', 'export') as Permission,
  ],

  account_manager: [
    ...crud('campaigns'),
    ...read('clients'),
    ...read('vendors'),
    ...read('finance'),
    ...read('analytics'),
    ...crud('approvals'),
    ...crud('deliverables'),
  ],

  finance: [
    ...read('campaigns'),
    ...read('clients'),
    ...read('vendors'),
    ...full('billing'),
    ...full('finance'),
    ...full('invoices'),
    ...full('payments'),
    ...read('analytics'),
    p('clients', 'approve'),
    p('reports', 'read') as Permission,
    p('reports', 'export') as Permission,
  ],

  data_entry: [
    p('campaigns', 'create'),
    p('campaigns', 'read'),
    p('campaigns', 'update'),
    p('deliverables', 'create'),
    p('deliverables', 'read'),
    p('deliverables', 'update'),
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm))
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm))
}

export function canViewFinancials(role: UserRole): boolean {
  // Per §6.3: Data Entry cannot see Revenue, Profit, Cost, or Billing columns
  return role !== 'data_entry'
}

export function canViewDashboard(role: UserRole): boolean {
  // Per §6.2 permission matrix: Data Entry has no dashboard access
  return role !== 'data_entry'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  director: 'Director',
  manager: 'Manager',
  account_manager: 'Account Manager',
  finance: 'Finance',
  data_entry: 'Data Entry',
}

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  director: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  account_manager: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  finance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  data_entry: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
