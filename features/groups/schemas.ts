import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(200),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(["prospect", "active", "inactive", "archived"]).default("active"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateGroupSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(["prospect", "active", "inactive", "archived"]),
  account_director_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const uploadGroupDocumentSchema = z.object({
  group_id: z.string().uuid(),
  document_type: z.enum(["nda", "agreement", "tax_document", "group_contract"]),
  expires_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export const archiveLegalEntitySchema = z.object({
  client_id: z.string().uuid(),
  group_id: z.string().uuid(),
});

export const updateGroupLegalEntitySchema = z.object({
  client_id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  agency_or_direct: z.enum(["agency", "direct", "hybrid"]),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  currency: z.enum(["USD", "AED", "SAR", "EGP", "EUR"]),
  payment_terms: z
    .enum([
      "due_on_receipt",
      "net_15",
      "net_30",
      "net_45",
      "net_60",
      "net_90",
      "custom",
    ])
    .optional()
    .or(z.literal("")),
  status: z.enum(["prospect", "active", "inactive", "archived"]),
});
