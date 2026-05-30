import type { UserRole } from '@/types/auth'
import type { Permission } from '@/types/permissions'
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/permissions/roles'

interface RoleGuardProps {
  role: UserRole
  permission?: Permission | Permission[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RoleGuard({
  role,
  permission,
  requireAll = false,
  fallback = null,
  children,
}: RoleGuardProps) {
  if (!permission) return <>{children}</>

  const permissions = Array.isArray(permission) ? permission : [permission]

  const allowed = requireAll
    ? hasAllPermissions(role, permissions)
    : hasAnyPermission(role, permissions)

  if (!allowed) return <>{fallback}</>

  return <>{children}</>
}
