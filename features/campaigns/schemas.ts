import { z } from "zod";

const campaignStatusSchema = z.enum([
  "draft",
  "planning",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null));

const currencySchema = z.enum(["USD", "AED", "SAR", "EGP", "EUR"]);

export const createCampaignSchema = z
  .object({
    brand_id: z.string().uuid("Select a brand"),
    name: z
      .string()
      .trim()
      .min(1, "Campaign name is required")
      .max(200, "Name is too long"),
    line_name: z.string().trim().max(200).optional().or(z.literal("")),
    platform: z.string().trim().max(64).optional().or(z.literal("")),
    po_amount: z.coerce
      .number({ error: "PO amount must be a number" })
      .min(0, "PO amount cannot be negative"),
    revenue: z.coerce.number().min(0).optional(),
    cost: z.coerce.number().min(0).optional(),
    fx_rate: z.coerce.number().positive("FX rate must be positive").default(1),
    currency_code: currencySchema,
    start_date: optionalDate,
    end_date: optionalDate,
    status: campaignStatusSchema.default("draft"),
    account_manager_id: z
      .string()
      .uuid("Invalid account manager")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.end_date) {
        return true;
      }
      return data.start_date <= data.end_date;
    },
    {
      message: "End date must be on or after the start date",
      path: ["end_date"],
    }
  );

export const updateCampaignHeaderSchema = z
  .object({
    campaign_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    brief: z.string().trim().max(5000).optional().or(z.literal("")),
    status: campaignStatusSchema,
    platform: z.string().trim().max(64).optional().or(z.literal("")),
    currency_code: currencySchema,
    start_date: optionalDate,
    end_date: optionalDate,
    account_manager_id: z.string().uuid().optional().or(z.literal("")),
    team_id: z.string().uuid().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.end_date) {
        return true;
      }
      return data.start_date <= data.end_date;
    },
    { message: "End date must be on or after start date", path: ["end_date"] }
  );

export const createCampaignLineSchema = z.object({
  campaign_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  platform: z.string().trim().max(64).optional().or(z.literal("")),
  po_amount: z.coerce.number().min(0),
  revenue: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  currency_code: currencySchema.default("USD"),
  status: campaignStatusSchema.default("draft"),
});

export const updateCampaignLineSchema = createCampaignLineSchema.extend({
  line_id: z.string().uuid(),
});

export const assignCampaignVendorSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_line_id: z.string().uuid().optional().or(z.literal("")),
  influencer_id: z.string().uuid(),
  agreed_fee: z.coerce.number().min(0).default(0),
  currency: currencySchema.default("USD"),
  status: z
    .enum([
      "invited",
      "negotiating",
      "confirmed",
      "declined",
      "completed",
      "cancelled",
    ])
    .default("invited"),
  deliverable_count: z.coerce.number().int().min(0).default(0),
});

export const updateCampaignVendorSchema = assignCampaignVendorSchema.extend({
  assignment_id: z.string().uuid(),
});

export const createDeliverableSchema = z.object({
  campaign_id: z.string().uuid(),
  influencer_id: z.string().uuid(),
  campaign_influencer_id: z.string().uuid().optional().or(z.literal("")),
  deliverable_type: z.enum([
    "instagram_post",
    "instagram_story",
    "instagram_reel",
    "tiktok_video",
    "youtube_video",
    "youtube_short",
    "other",
  ]),
  title: z.string().trim().min(1).max(200),
  platform: z.string().trim().max(64).optional().or(z.literal("")),
  due_date: optionalDate,
});

export const updateDeliverableStatusSchema = z.object({
  deliverable_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  status: z.enum([
    "pending",
    "in_progress",
    "submitted",
    "revision_requested",
    "approved",
    "rejected",
    "published",
    "cancelled",
  ]),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
