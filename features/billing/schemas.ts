import { z } from "zod";

const billingStatusSchema = z.enum([
  "draft",
  "approved",
  "moved_to_billing",
  "partially_invoiced",
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

const csvUuidList = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

export const bulkOperationalBillingSchema = z.object({
  campaign_id: z.string().uuid(),
  line_ids: csvUuidList,
  deliverable_ids: csvUuidList,
  post_ids: csvUuidList,
});

export const createInvoiceFromLinesSchema = z
  .object({
    campaign_id: z.string().uuid(),
    line_ids: z.string().optional().or(z.literal("")),
    deliverable_ids: z.string().optional().or(z.literal("")),
    post_ids: z.string().optional().or(z.literal("")),
    invoice_mode: z.preprocess(
      (val) => (val === "append" ? "append" : "new"),
      z.enum(["new", "append"])
    ),
    existing_invoice_id: z.string().uuid().optional().or(z.literal("")),
    due_date: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      const lines = (data.line_ids ?? "").split(",").filter(Boolean);
      const deliverables = (data.deliverable_ids ?? "").split(",").filter(Boolean);
      const posts = (data.post_ids ?? "").split(",").filter(Boolean);
      return lines.length > 0 || deliverables.length > 0 || posts.length > 0;
    },
    { message: "Select at least one operational row." }
  )
  .refine(
    (data) => data.invoice_mode !== "append" || Boolean(data.existing_invoice_id?.trim()),
    { message: "Select an invoice to append to.", path: ["existing_invoice_id"] }
  )
  .transform((data) => ({
    ...data,
    invoice_mode: data.invoice_mode === "append" ? ("append" as const) : ("new" as const),
    existing_invoice_id:
      data.invoice_mode === "append" ? data.existing_invoice_id?.trim() || undefined : undefined,
  }));

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

export const ungenerateInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

export const regenerateInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

export { billingStatusSchema };
