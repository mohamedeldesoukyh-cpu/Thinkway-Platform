import { z } from "zod";
export const deleteEntitySchema = z.object({
  kind: z.enum(["brand", "client"]),
  id: z.string().uuid(),
  confirmation: z.string().min(1).max(200),
});
export const moveBrandSchema = z.object({
  id: z.string().uuid(),
  previousClientId: z.string().uuid(),
  clientId: z.string().uuid("Select a client"),
}).refine((v) => v.clientId !== v.previousClientId, "Choose a different client");
