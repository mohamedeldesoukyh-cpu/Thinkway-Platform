import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(200),
  status: z.enum(["prospect", "active", "inactive", "archived"]).default("active"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createBrandSchema = z.object({
  client_id: z.string().uuid("Select a legal entity"),
  name: z.string().trim().min(1, "Brand name is required").max(200),
  category_id: z.string().uuid().optional().or(z.literal("")),
  subcategory_id: z.string().uuid().optional().or(z.literal("")),
  agency_or_direct: z.enum(["agency", "direct", "hybrid"]).optional().or(z.literal("")),
  vr_rate_id: z.string().uuid().optional().or(z.literal("")),
  currency_code: z.enum(["USD", "AED", "SAR", "EGP", "EUR"]).default("USD"),
  country_code: z.string().trim().max(2).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
