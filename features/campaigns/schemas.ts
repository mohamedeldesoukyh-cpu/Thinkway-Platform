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

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
