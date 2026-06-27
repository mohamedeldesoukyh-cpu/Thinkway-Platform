import { z } from "zod";

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
