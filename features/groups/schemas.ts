import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(200),
  status: z.enum(["prospect", "active", "inactive", "archived"]).default("active"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
