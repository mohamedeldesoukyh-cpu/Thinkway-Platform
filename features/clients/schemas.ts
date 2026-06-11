import { z } from "zod";

import { currencyCodeSchema } from "@/lib/master-data/currency-schema";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

const clientStatusSchema = z.enum([
  "prospect",
  "active",
  "inactive",
  "archived",
]);

const paymentTermsSchema = z.enum([
  "due_on_receipt",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "net_90",
  "custom",
]);

const agencyOrDirectSchema = z.enum(["agency", "direct", "hybrid"]);

const clientCategorySchema = z.enum([
  "fmcg",
  "beauty",
  "automotive",
  "technology",
  "finance",
  "retail",
  "government",
  "entertainment",
  "other",
]);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}, z.number().min(0).nullable().optional());

export const createClientSchema = z.object({
  group_id: z.string().uuid("Select a group"),
  name: z
    .string()
    .trim()
    .min(1, "Legal entity name is required")
    .max(200, "Name is too long"),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  agency_or_direct: agencyOrDirectSchema,
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
      "Enter a valid URL"
    ),
  status: clientStatusSchema.default("prospect"),
  billing_email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  currency: currencyCodeSchema.default(DEFAULT_PLATFORM_CURRENCY),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateClientOverviewSchema = z.object({
  client_id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  agency_or_direct: agencyOrDirectSchema,
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
      "Enter a valid URL"
    ),
  status: clientStatusSchema,
  billing_email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  billing_phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateClientLegalSchema = z.object({
  client_id: z.string().uuid(),
  trade_license_number: z.string().trim().max(120).optional().or(z.literal("")),
  trade_license_expiry: optionalDate,
  vat_number: z.string().trim().max(120).optional().or(z.literal("")),
  tax_id: z.string().trim().max(120).optional().or(z.literal("")),
  legal_address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  legal_address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  legal_address_city: z.string().trim().max(120).optional().or(z.literal("")),
  legal_address_country: z.string().trim().max(2).optional().or(z.literal("")),
  legal_address_postal: z.string().trim().max(32).optional().or(z.literal("")),
});

export const updateClientFinanceSchema = z.object({
  client_id: z.string().uuid(),
  currency: currencyCodeSchema,
  payment_terms: paymentTermsSchema.optional().or(z.literal("")),
  credit_limit: optionalNumber,
  billing_email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  billing_phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const uploadClientDocumentSchema = z.object({
  client_id: z.string().uuid(),
  document_type: z.enum([
    "trade_license",
    "vat_certificate",
    "tax_certificate",
    "nda",
    "msa_contract",
    "sow",
  ]),
  expires_at: optionalDate,
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
