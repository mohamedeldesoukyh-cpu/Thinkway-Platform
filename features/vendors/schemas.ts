import { z } from "zod";

const influencerStatusSchema = z.enum([
  "prospect",
  "active",
  "inactive",
  "blacklisted",
]);

export const createVendorSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Creator name is required")
    .max(200, "Name is too long"),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || /^[A-Z]{2}$/.test(value),
      "Use a 2-letter country code"
    ),
  categories: z.string().trim().max(500).optional().or(z.literal("")),
  platform: z.string().trim().max(64).optional().or(z.literal("")),
  handle: z.string().trim().max(120).optional().or(z.literal("")),
  follower_count: z.coerce
    .number()
    .int("Followers must be a whole number")
    .min(0, "Followers cannot be negative")
    .default(0),
  pricing_amount: z.preprocess((value) => {
    if (value === "" || value == null) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, z.number().min(0, "Pricing cannot be negative").optional()),
  pricing_currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code")
    .default("USD"),
  status: influencerStatusSchema.default("prospect"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
