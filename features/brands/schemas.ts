import { z } from "zod";

export const createBrandSchema = z.object({
  client_id: z.string().uuid("Select a legal entity"),
  name: z.string().trim().min(1, "Brand name is required").max(200),
  category_id: z.string().uuid().optional().or(z.literal("")),
  subcategory_id: z.string().uuid().optional().or(z.literal("")),
  vr_rate_id: z.string().uuid().optional().or(z.literal("")),
  currency_code: z.enum(["USD", "AED", "SAR", "EGP", "EUR"]).default("USD"),
  country_code: z.string().trim().max(2).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateBrandSchema = createBrandSchema.extend({
  brand_id: z.string().uuid(),
  status: z.enum(["prospect", "active", "inactive", "archived"]).default("active"),
});

export const archiveBrandSchema = z.object({
  brand_id: z.string().uuid(),
  client_id: z.string().uuid(),
});

export const updateBrandStatusSchema = z.object({
  brand_id: z.string().uuid(),
  client_id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
