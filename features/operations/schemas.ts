import { z } from "zod";

export const movementTypeSchema = z.enum([
  "brand_to_brand",
  "client_to_client",
  "group_to_group",
]);

export const previewMovementSchema = z.object({
  movement_type: movementTypeSchema,
  source_group_id: z.string().uuid().optional().or(z.literal("")),
  source_client_id: z.string().uuid().optional().or(z.literal("")),
  source_brand_id: z.string().uuid().optional().or(z.literal("")),
  campaign_ids: z.string().min(1),
});

export const executeMovementSchema = z.object({
  movement_type: movementTypeSchema,
  source_group_id: z.string().uuid().optional().or(z.literal("")),
  source_client_id: z.string().uuid().optional().or(z.literal("")),
  source_brand_id: z.string().uuid().optional().or(z.literal("")),
  destination_group_id: z.string().uuid(),
  destination_client_id: z.string().uuid(),
  destination_brand_id: z.string().uuid(),
  campaign_ids: z.string().min(1),
  reason: z.string().trim().min(3).max(2000),
});

export const entityDependencySchema = z.object({
  entity_type: z.enum(["group", "client", "brand"]),
  entity_id: z.string().uuid(),
});

export const duplicateCampaignSchema = z.object({
  source_campaign_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  start_date: z.string().trim().min(1),
  end_date: z.string().trim().optional().or(z.literal("")),
  live_date: z.string().trim().optional().or(z.literal("")),
  budget_month: z.string().trim().optional().or(z.literal("")),
  po_number: z.string().trim().max(120).optional().or(z.literal("")),
  copy_influencers: z.coerce.boolean().default(true),
  copy_deliverables: z.coerce.boolean().default(true),
  copy_pricing: z.coerce.boolean().default(true),
  copy_notes: z.coerce.boolean().default(true),
  copy_workflow: z.coerce.boolean().default(true),
});

export const ungenerateInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

export const regenerateInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

export const updateFinancialPeriodSchema = z.object({
  period_id: z.string().uuid().optional().or(z.literal("")),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  status: z.enum(["open", "soft_locked", "fully_locked"]),
  reason: z.string().trim().min(3).max(2000),
});
