import { z } from "zod";

const currencyCodeSchema = z.string().trim().length(3).toUpperCase();
const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const upsertCurrencySchema = z.object({
  code: currencyCodeSchema,
  name: z.string().trim().min(1).max(80),
  symbol: z.string().trim().max(8).optional().or(z.literal("")),
  country_code: z.string().trim().length(2).optional().or(z.literal("")),
  decimal_places: z.coerce.number().int().min(0).max(6).default(2),
  is_active: z.coerce.boolean().optional(),
});

export const upsertExchangeRateSchema = z.object({
  id: z.string().uuid().optional(),
  from_currency: currencyCodeSchema,
  to_currency: currencyCodeSchema,
  exchange_rate: z.coerce.number().positive("Rate must be positive"),
  effective_start_date: z.string().trim().min(1),
  effective_end_date: optionalDate,
  source: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  apply_mode: z.enum(["future", "override_historical"]).default("future"),
  override_reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateCampaignPoSchema = z.object({
  campaign_id: z.string().uuid(),
  po_number: z.string().trim().max(120).optional().or(z.literal("")),
  po_currency: currencyCodeSchema,
  po_amount_original: z.coerce.number().min(0),
  po_exchange_rate: z.coerce.number().positive(),
  po_expiry_date: optionalDate,
  override_reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const confirmPoOverrideSchema = z.object({
  campaign_id: z.string().uuid(),
  line_id: z.string().uuid().optional(),
  override_reason: z.string().trim().min(1, "Override reason is required"),
});
