import { z } from 'zod'

const PAYMENT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'] as const
const CURRENCIES       = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD'] as const
const PAYMENT_METHODS  = ['bank_transfer', 'paypal', 'stripe', 'wise', 'other'] as const

export const createPaymentSchema = z.object({
  vendor_id:      z.string().uuid('Invalid vendor'),
  campaign_id:    z.string().uuid().nullable().optional(),
  deliverable_id: z.string().uuid().nullable().optional(),
  amount:         z.number().positive('Amount must be positive'),
  currency:       z.enum(CURRENCIES).default('USD'),
  payment_method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  reference:      z.string().max(200).nullable().optional(),
  notes:          z.string().max(5000).nullable().optional(),
  due_date:       z.string().nullable().optional(),
  status:         z.enum(PAYMENT_STATUSES).default('pending'),
})

export const updatePaymentSchema = createPaymentSchema.partial().omit({ vendor_id: true })

export const markPaymentPaidSchema = z.object({
  paid_at:   z.string().datetime({ offset: true }).optional(),
  reference: z.string().max(200).nullable().optional(),
})

export type CreatePaymentInput      = z.infer<typeof createPaymentSchema>
export type UpdatePaymentInput      = z.infer<typeof updatePaymentSchema>
export type MarkPaymentPaidInput    = z.infer<typeof markPaymentPaidSchema>
