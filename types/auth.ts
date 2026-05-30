import type { ID } from './common'

// 6 confirmed roles per §6.1 of the system reference
export type UserRole =
  | 'admin'
  | 'director'
  | 'manager'
  | 'account_manager'
  | 'finance'
  | 'data_entry'

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended'

export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise'

export interface User {
  id: ID
  email: string
  fullName: string
  firstName: string
  lastName: string
  avatar?: string
  role: UserRole
  team: string | null
  reportsToId: string | null
  status: UserStatus
  organizationId: ID | null
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: ID
  name: string
  slug: string
  logo?: string
  plan: SubscriptionPlan
  status: 'active' | 'suspended' | 'trial'
  trialEndsAt?: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  user: User
  organization: Organization
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface InviteToken {
  token: string
  email: string
  role: UserRole
  organizationId: ID
  invitedBy: ID
  expiresAt: string
  usedAt?: string
}
