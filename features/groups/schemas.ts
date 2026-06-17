import { z } from "zod";

import { currencyCodeSchema } from "@/lib/master-data/currency-schema";

const agencyOrDirectSchema = z.enum(["agency", "direct", "hybrid"]);

export const groupInlineNewClientSchema = z.object({
  name: z.string().trim().min(1, "Client legal name is required").max(200),
  agency_or_direct: agencyOrDirectSchema.default("agency"),
});

export type GroupInlineNewClientInput = z.infer<typeof groupInlineNewClientSchema>;

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Group name is required").max(200),
    region: z.string().trim().max(120).optional().or(z.literal("")),
    status: z.enum(["prospect", "active", "inactive", "archived"]).default("active"),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    client_setup: z
      .enum(["none", "link_existing", "create_new"])
      .default("none"),
    linked_client_ids: z.array(z.string().uuid()).default([]),
    new_clients_json: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.client_setup === "link_existing" && data.linked_client_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one client to link.",
        path: ["linked_client_ids"],
      });
    }

    if (data.client_setup === "create_new") {
      const raw = data.new_clients_json?.trim();
      if (!raw) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one client.",
          path: ["new_clients_json"],
        });
        return;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        const result = z.array(groupInlineNewClientSchema).min(1).safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid client name for each row.",
            path: ["new_clients_json"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid client data.",
          path: ["new_clients_json"],
        });
      }
    }
  });

export function parseGroupInlineNewClients(
  json: string | undefined
): GroupInlineNewClientInput[] {
  const raw = json?.trim();
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  return z.array(groupInlineNewClientSchema).min(1).parse(parsed);
}

export function parseCreateGroupFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    region: String(formData.get("region") ?? ""),
    status: String(formData.get("status") ?? "active"),
    notes: String(formData.get("notes") ?? ""),
    client_setup: String(formData.get("client_setup") ?? "none"),
    linked_client_ids: formData
      .getAll("linked_client_ids")
      .map((value) => String(value)),
    new_clients_json: String(formData.get("new_clients_json") ?? ""),
  };
}

export const updateGroupSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(["prospect", "active", "inactive", "archived"]),
  account_director_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const uploadGroupDocumentSchema = z.object({
  group_id: z.string().uuid(),
  document_type: z.enum(["nda", "agreement", "tax_document", "group_contract"]),
  expires_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export const archiveLegalEntitySchema = z.object({
  client_id: z.string().uuid(),
  group_id: z.string().uuid(),
});

export const linkClientToGroupSchema = z.object({
  client_id: z.string().uuid("Select a client"),
  group_id: z.string().uuid(),
});

export const updateGroupLegalEntitySchema = z.object({
  client_id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  agency_or_direct: z.enum(["agency", "direct", "hybrid"]),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  currency: currencyCodeSchema,
  payment_terms: z
    .enum([
      "due_on_receipt",
      "net_15",
      "net_30",
      "net_45",
      "net_60",
      "net_90",
      "custom",
    ])
    .optional()
    .or(z.literal("")),
  status: z.enum(["prospect", "active", "inactive", "archived"]),
});
