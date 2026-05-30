import { z } from 'zod'

const USER_ROLES = ['admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry'] as const
const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending_invitation'] as const

export const updateProfileSchema = z.object({
  full_name:  z.string().min(1, 'Full name is required').max(100),
  first_name: z.string().max(50).nullable().optional(),
  last_name:  z.string().max(50).nullable().optional(),
  avatar_url: z.string().url('Invalid URL').nullable().optional(),
  team:       z.string().max(50).nullable().optional(),
})

export const updateProfileRoleSchema = z.object({
  role:   z.enum(USER_ROLES, { error: 'Invalid role' }),
  status: z.enum(USER_STATUSES).optional(),
})

export type UpdateProfileInput     = z.infer<typeof updateProfileSchema>
export type UpdateProfileRoleInput = z.infer<typeof updateProfileRoleSchema>
