import type { UserRole } from '@/types/auth'
import type { Permission } from '@/types/permissions'

export interface NavItem {
  label: string
  href: string
  iconName: string
  permission?: Permission
  allowedRoles?: UserRole[]
  badge?: 'pending_approvals' | 'unread_notifications'
  isExternal?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

// Navigation configuration per §1.3 module list and §6.2 permission matrix
export const PLATFORM_NAV: NavSection[] = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        iconName: 'LayoutDashboard',
        // Data Entry has no dashboard access per §6.2
        allowedRoles: ['admin', 'director', 'manager', 'account_manager', 'finance'],
      },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        label: 'Campaigns',
        href: '/campaigns',
        iconName: 'Megaphone',
        permission: 'campaigns:read',
      },
      {
        label: 'Clients',
        href: '/clients',
        iconName: 'Building2',
        permission: 'clients:read',
      },
      {
        label: 'Vendors',
        href: '/vendors',
        iconName: 'Users',
        permission: 'vendors:read',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Billing',
        href: '/billing',
        iconName: 'Receipt',
        permission: 'billing:read',
      },
      {
        label: 'Budget',
        href: '/budget',
        iconName: 'Wallet',
        allowedRoles: ['admin', 'director', 'manager', 'finance'],
      },
    ],
  },
  {
    title: 'Reporting',
    items: [
      {
        label: 'Reports',
        href: '/reports',
        iconName: 'BarChart3',
        allowedRoles: ['admin', 'director', 'manager', 'finance'],
      },
      {
        label: 'Team & Targets',
        href: '/team',
        iconName: 'Target',
        allowedRoles: ['admin', 'director', 'manager'],
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Workflows',
        href: '/workflows',
        iconName: 'GitBranch',
        permission: 'workflows:read',
      },
      {
        label: 'Discovery',
        href: '/discovery',
        iconName: 'Search',
        allowedRoles: ['admin', 'director', 'manager', 'account_manager'],
      },
    ],
  },
]

export const ADMIN_NAV: NavSection[] = [
  {
    title: 'Administration',
    items: [
      {
        label: 'Users',
        href: '/admin/users',
        iconName: 'UserCog',
        permission: 'users:manage',
      },
      {
        label: 'Roles',
        href: '/admin/roles',
        iconName: 'ShieldCheck',
        permission: 'users:manage',
      },
      {
        label: 'Settings',
        href: '/admin/settings',
        iconName: 'Settings',
        permission: 'settings:manage',
      },
      {
        label: 'Audit Log',
        href: '/admin/audit',
        iconName: 'ClipboardList',
        permission: 'settings:manage',
      },
    ],
  },
]

export function filterNavForRole(
  sections: NavSection[],
  role: UserRole
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.allowedRoles) {
          return item.allowedRoles.includes(role)
        }
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}
