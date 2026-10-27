import { z } from "zod";

export const lineAssignmentPayloadSchema = z.object({
  platforms: z
    .array(
      z.object({
        account_id: z.string().uuid().or(z.literal("")),
        platform: z.string().min(1),
        handle: z.string().min(1),
        profile_url: z.string().nullable().optional(),
        follower_count: z.coerce.number().min(0).default(0),
        engagement_rate: z.coerce.number().nullable().optional(),
        audience_country: z.string().nullable().optional(),
        deliverables: z.array(z.string()).default([]),
      }).refine(p => p.account_id !== "" || (p.platform === "other" && p.deliverables.length > 0 && p.deliverables.every(type => type === "other_service")), {
        message: "Social deliverables require a platform account.", path: ["account_id"],
      })
    )
    .default([]),
});
