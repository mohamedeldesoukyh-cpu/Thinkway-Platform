import { z } from 'zod'

const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void'] as const
const CURRENCIES       = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD'] as const
const LEGAL_ENTITIES   = ['uae', 'ksa', 'kwt'] as const

const lineItemSchema = z.object({
  description:    z.string().min(1, 'Description is required'),
  campaign_id:    z.string().uuid().nullable().optional(),
  vendor_id:      z.string().uuid().nullable().optional(),
  deliverable_id: z.string().uuid().nullable().optional(),
  quantity:       z.number().positive('Quantity must be positive').default(1),
  unit_price:     z.number().min(0).default(0),
  discount_pct:   z.number().min(0).max(100).default(0),
  sort_order:     z.number().int().default(0),
})

export const createInvoiceSchema = z.object({
  client_id:    z.string().uuid('Invalid client'),
  campaign_id:  z.string().uuid().nullable().optional(),
  status:       z.enum(INVOICE_STATUSES).default('draft'),
  issue_date:   z.string().min(1, 'Issue date is required'),
  due_date:     z.string().min(1, 'Due date is required'),
  currency:     z.enum(CURRENCIES).default('USD'),
  tax_rate:     z.number().min(0).max(1).default(0),
  notes:        z.string().max(5000).nullable().optional(),
  terms:        z.string().max(2000).nullable().optional(),
  po_number:    z.string().max(100).nullable().optional(),
  legal_entity: z.enum(LEGAL_ENTITIES).nullable().optional(),
  line_items:   z.array(lineItemSchema).min(1, 'At least one line item is required'),
}).refine(
  (d) => d.due_date >= d.issue_date,
  { message: 'Due date must be on or after issue date', path: ['due_date'] }
)

export const updateInvoiceSchema = createInvoiceSchema.partial()

export const voidInvoiceSchema = z.object({
  void_reason: z.string().min(1, 'Reason is required').max(500),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type InvoiceLineItemInput = z.infer<typeof lineItemSchema>
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>
