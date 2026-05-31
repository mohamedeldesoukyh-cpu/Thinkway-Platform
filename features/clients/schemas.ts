import { z } from "zod";

const clientStatusSchema = z.enum([
  "prospect",
  "active",
  "inactive",
  "archived",
]);

export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name is required")
    .max(200, "Name is too long"),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
      "Enter a valid URL"
    ),
  status: clientStatusSchema.default("prospect"),
  billing_email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code")
    .default("USD"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
