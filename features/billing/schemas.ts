import { z } from "zod";

const billingStatusSchema = z.enum([
  "draft",
  "approved",
  "moved_to_billing",
  "invoiced",
  "partially_paid",
  "paid",
  "closed",
]);

export const approveLineForBillingSchema = z.object({
  line_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export const moveLineToBillingSchema = z.object({
  line_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export const createInvoiceFromLinesSchema = z.object({
  campaign_id: z.string().uuid(),
  line_ids: z.string().min(1),
  due_date: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const recordCollectionPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  payment_method: z
    .enum([
      "bank_transfer",
      "credit_card",
      "debit_card",
      "paypal",
      "wire",
      "check",
      "other",
    ])
    .default("bank_transfer"),
  reference_number: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const recordVendorPaymentSchema = z.object({
  assignment_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  batch_name: z.string().trim().min(1).max(200),
  amount: z.coerce.number().min(0),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const decideFinancialApprovalSchema = z.object({
  approval_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  decision_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const requestFinanceOverrideSchema = z.object({
  line_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
  override_hours: z.coerce.number().int().min(1).max(72).default(24),
});

export const closeBillingLineSchema = z.object({
  line_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

export { billingStatusSchema };
