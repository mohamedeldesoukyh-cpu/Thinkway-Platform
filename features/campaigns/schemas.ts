import { z } from "zod";

import { currencyCodeSchema } from "@/lib/master-data/currency-schema";

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
    currency_code: currencyCodeSchema,
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
    currency_code: currencyCodeSchema,
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

export const lineAssignmentPayloadSchema = z.object({
  platforms: z
    .array(
      z.object({
        account_id: z.string().uuid(),
        platform: z.string().min(1),
        handle: z.string().min(1),
        profile_url: z.string().nullable().optional(),
        follower_count: z.coerce.number().min(0).default(0),
        engagement_rate: z.coerce.number().nullable().optional(),
        audience_country: z.string().nullable().optional(),
        deliverables: z.array(z.string()).min(1),
      })
    )
    .min(1, "Select at least one platform with deliverables"),
});

const assignmentStatusSchema = z.enum([
  "draft",
  "assigned",
  "awaiting_content",
  "submitted",
  "approved",
  "scheduled",
  "posted",
  "verified",
  "invoiced",
  "paid",
  "closed",
]);

export const createCampaignLineSchema = z.object({
  campaign_id: z.string().uuid(),
  influencer_id: z.string().uuid("Select an influencer"),
  name: z.string().trim().max(200).optional().or(z.literal("")),
  title_user_edited: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  assignment_json: z.string().min(2, "Select at least one platform"),
  assignment_status: assignmentStatusSchema.default("assigned"),
  platform: z.string().trim().max(64).optional().or(z.literal("")),
  po_amount: z.coerce.number().min(0),
  revenue: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  revenue_before_vat: z.coerce.number().min(0).optional(),
  revenue_vat_percent: z.coerce.number().min(0).max(100).default(0),
  revenue_vat_exempt: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  cost_before_vat: z.coerce.number().min(0).optional(),
  cost_vat_percent: z.coerce.number().min(0).max(100).default(0),
  cost_vat_exempt: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  currency_code: currencyCodeSchema.default("USD"),
  start_date: optionalDate,
  end_date: optionalDate,
});

export const updateCampaignLineSchema = createCampaignLineSchema.extend({
  line_id: z.string().uuid(),
});

/** @deprecated Use createCampaignLineSchema — manual vendor linking is no longer supported. */
export const assignCampaignVendorSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_line_id: z.string().uuid().optional().or(z.literal("")),
  influencer_id: z.string().uuid(),
  agreed_fee: z.coerce.number().min(0).default(0),
  currency: currencyCodeSchema.default("USD"),
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

export const duplicateCampaignSchema = z.object({
  source_campaign_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  start_date: z.string().trim().min(1),
  end_date: optionalDate,
  live_date: optionalDate,
  budget_month: z.string().trim().max(20).optional().or(z.literal("")),
  po_number: z.string().trim().max(120).optional().or(z.literal("")),
  copy_influencers: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  copy_deliverables: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  copy_pricing: z
    .string()
    .optional()
    .transform((v) => v !== "off" && v !== "false"),
  copy_notes: z
    .string()
    .optional()
    .transform((v) => v !== "off" && v !== "false"),
  copy_workflow: z
    .string()
    .optional()
    .transform((v) => v !== "off" && v !== "false"),
});
