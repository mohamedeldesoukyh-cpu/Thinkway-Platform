import { z } from "zod";

const influencerStatusSchema = z.enum([
  "prospect",
  "active",
  "inactive",
  "blacklisted",
  "archived",
]);

const currencySchema = z.enum(["USD", "AED", "SAR", "EGP", "EUR"]);

const paymentTermsSchema = z.enum([
  "due_on_receipt",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "net_90",
  "custom",
]);

const contractStatusSchema = z.enum([
  "none",
  "draft",
  "sent",
  "signed",
  "expired",
  "terminated",
]);

const exclusivitySchema = z.enum(["none", "category", "brand", "full"]);

const genderSchema = z.enum([
  "female",
  "male",
  "non_binary",
  "prefer_not_to_say",
  "other",
]);

const platformSchema = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
  "twitter",
  "linkedin",
  "facebook",
]);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

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
  platform: platformSchema.optional().or(z.literal("")),
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
  pricing_currency: currencySchema.default("USD"),
  status: influencerStatusSchema.default("prospect"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateVendorOverviewSchema = z.object({
  influencer_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(200),
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
  status: influencerStatusSchema,
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  nationality: z.string().trim().max(2).optional().or(z.literal("")),
  gender: genderSchema.optional().or(z.literal("")),
  categories: z.string().trim().max(500).optional().or(z.literal("")),
  languages: z.string().trim().max(500).optional().or(z.literal("")),
  influencer_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
      "Enter a valid URL"
    ),
  management_agency: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateVendorLegalSchema = z.object({
  influencer_id: z.string().uuid(),
  contract_status: contractStatusSchema,
  contract_expiry: optionalDate,
  exclusivity: exclusivitySchema.optional().or(z.literal("")),
});

export const updateVendorFinanceSchema = z.object({
  influencer_id: z.string().uuid(),
  payment_terms: paymentTermsSchema.optional().or(z.literal("")),
  pricing_amount: z.preprocess((value) => {
    if (value === "" || value == null) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, z.number().min(0).optional()),
  pricing_currency: currencySchema.default("USD"),
});

export const platformAccountInputSchema = z.object({
  id: z.string().uuid().optional(),
  platform: platformSchema,
  username: z.string().trim().min(1, "Username is required").max(120),
  profile_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
      "Enter a valid URL"
    )
    .optional()
    .or(z.literal("")),
  follower_count: z.coerce.number().int().min(0).default(0),
  engagement_rate: z.preprocess((value) => {
    if (value === "" || value == null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }, z.number().min(0).max(100).nullable().optional()),
  avg_views: z.coerce.number().int().min(0).default(0),
  audience_country: z.string().trim().max(2).optional().or(z.literal("")),
  audience_male_pct: z.preprocess((value) => {
    if (value === "" || value == null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }, z.number().min(0).max(100).nullable().optional()),
  audience_female_pct: z.preprocess((value) => {
    if (value === "" || value == null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }, z.number().min(0).max(100).nullable().optional()),
  is_primary: z.coerce.boolean().optional(),
});

export const savePlatformAccountsSchema = z.object({
  influencer_id: z.string().uuid(),
  accounts_json: z.string().min(2),
});

export const uploadInfluencerDocumentSchema = z.object({
  influencer_id: z.string().uuid(),
  document_type: z.enum([
    "passport",
    "national_id",
    "signed_contract",
    "media_kit",
    "tax_document",
    "rate_card",
  ]),
  expires_at: optionalDate,
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const archiveVendorSchema = z.object({
  vendor_id: z.string().uuid(),
});

export const updateVendorStatusSchema = z.object({
  vendor_id: z.string().uuid(),
  status: influencerStatusSchema,
});

export const vendorDependencySchema = z.object({
  vendor_id: z.string().uuid(),
});
