export const ROUTES = {
  ROOT: '/',

  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
  },

  DASHBOARD: '/dashboard',

  CAMPAIGNS: {
    ROOT: '/campaigns',
    NEW: '/campaigns/new',
    DETAIL: (id: string) => `/campaigns/${id}`,
    LINES: (id: string) => `/campaigns/${id}/lines`,
    NEW_LINE: (id: string) => `/campaigns/${id}/lines/new`,
  },

  CLIENTS: {
    ROOT: '/clients',
    NEW: '/clients/new',
    GROUPS: '/clients/groups',
    DETAIL: (id: string) => `/clients/${id}`,
    BRANDS: (id: string) => `/clients/${id}/brands`,
    ONBOARDING: (id: string) => `/clients/${id}/onboarding`,
  },

  VENDORS: {
    ROOT: '/vendors',
    NEW: '/vendors/new',
    DETAIL: (id: string) => `/vendors/${id}`,
  },

  BILLING: {
    ROOT: '/billing',
    CAMPAIGN: (id: string) => `/billing/${id}`,
  },

  BUDGET: {
    ROOT: '/budget',
    VERSION: (version: string) => `/budget/${version}`,
  },

  REPORTS: {
    ROOT: '/reports',
    SLUG: (slug: string) => `/reports/${slug}`,
  },

  TEAM: {
    ROOT: '/team',
    TARGETS: '/team/targets',
    SCORECARDS: '/team/scorecards',
    BONUS: '/team/bonus',
    BONUS_RUN: (id: string) => `/team/bonus/${id}`,
  },

  WORKFLOWS: '/workflows',

  TASKS: '/tasks',

  DISCOVERY: '/discovery',

  ADMIN: {
    ROOT: '/admin',
    USERS: '/admin/users',
    ROLES: '/admin/roles',
    SETTINGS: '/admin/settings',
    AUDIT: '/admin/audit',
  },

  API: {
    V1: '/api/v1',
    CAMPAIGNS: '/api/v1/campaigns',
    CLIENTS: '/api/v1/clients',
    VENDORS: '/api/v1/vendors',
    BILLING: '/api/v1/billing',
    REPORTS: '/api/v1/reports',
    WEBHOOKS: '/api/webhooks',
  },
} as const

export const PLATFORM_ROUTE_PREFIXES = [
  '/dashboard',
  '/campaigns',
  '/clients',
  '/vendors',
  '/billing',
  '/budget',
  '/reports',
  '/team',
  '/workflows',
  '/tasks',
  '/discovery',
  '/admin',
]

export const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]
