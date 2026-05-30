import type { ID } from './common'

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'account_manager'
  | 'finance'
  | 'viewer'

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
  status: UserStatus
  organizationId: ID
  lastLoginAt?: string
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
