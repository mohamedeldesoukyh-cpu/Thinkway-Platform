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

export const createCampaignSchema = z
  .object({
    client_id: z.string().uuid("Select a client"),
    name: z
      .string()
      .trim()
      .min(1, "Campaign name is required")
      .max(200, "Name is too long"),
    platform: z.string().trim().max(64).optional().or(z.literal("")),
    budget: z.coerce
      .number({ error: "Budget must be a number" })
      .min(0, "Budget cannot be negative"),
    currency: z
      .string()
      .trim()
      .length(3, "Currency must be a 3-letter code"),
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
