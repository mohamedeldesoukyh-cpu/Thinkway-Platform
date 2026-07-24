import { z } from "zod";

/** Shared primitives for APIs and Server Actions (P2 validation foundation). */

export const uuidSchema = z.string().uuid();

/** Query-param friendly UUID (empty string → undefined). */
export const optionalUuidQuerySchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  uuidSchema.optional()
);

export const emailSchema = z.string().trim().email().max(320);

export const nonEmptyStringSchema = z.string().trim().min(1);

export const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Authenticator code must be 6 digits");

export const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.toLowerCase().startsWith("https://"), {
    message: "URL must use https",
  });

export const pageSchema = z.coerce.number().int().min(1).default(1);

export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);

export const vendorIoStatusSchema = z.enum([
  "draft",
  "generated",
  "sent",
  "approved",
  "rejected",
]);

export const invitePortalTypeSchema = z.enum(["internal", "client", "creator"]);

export const inviteAccessRoleSchema = z.enum(["view", "approve"]);

export const inviteUserSchema = z
  .object({
    full_name: z.string().trim().max(200).optional().or(z.literal("")),
    email: emailSchema,
    role_id: uuidSchema,
    portal_type: invitePortalTypeSchema.default("internal"),
    department: z.string().trim().max(200).optional().or(z.literal("")),
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z]{2})?$/, "Country code must be ISO-2")
      .optional()
      .or(z.literal("")),
    business_function: z.enum(["ops", "sales"]).nullable().optional(),
    client_id: z.string().uuid().optional().or(z.literal("")),
    access_role: inviteAccessRoleSchema.default("view"),
    is_primary: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.portal_type === "client" && !value.client_id) {
      ctx.addIssue({
        code: "custom",
        message: "Legal entity is required for client portal invites.",
        path: ["client_id"],
      });
    }
  });

export const updateVendorIoSchema = z.object({
  id: uuidSchema,
  campaign_header_id: uuidSchema,
  terms_text: z.string().max(50_000).optional().or(z.literal("")),
  terms_html: z.string().max(100_000).optional().or(z.literal("")),
  usage_rights: z.string().max(2_000).optional().or(z.literal("")),
  exclusivity: z.string().max(2_000).optional().or(z.literal("")),
  attachment_url: z
    .union([httpsUrlSchema, z.literal("")])
    .optional()
    .nullable(),
  status: vendorIoStatusSchema.default("draft"),
  amount: z.preprocess((value) => {
    if (value == null || value === "") return undefined;
    return value;
  }, z.coerce.number().nonnegative().optional()),
});

export const mfaVerifyEnrollmentSchema = z.object({
  factor_id: nonEmptyStringSchema.max(200),
  code: totpCodeSchema,
  next: z.string().max(2_000).optional(),
});

export const mfaVerifyChallengeSchema = z.object({
  code: totpCodeSchema,
  next: z.string().max(2_000).optional(),
});

export const aiChatBodySchema = z.object({
  message: z.string().trim().min(1).max(20_000),
  conversationId: uuidSchema.optional(),
  rerunUserMessageId: uuidSchema.optional(),
  intent: z.string().trim().max(64).optional(),
  workspace: z
    .object({
      workspace: z.string().max(64).optional(),
      id: z.string().max(128).optional(),
      campaignId: uuidSchema.optional(),
      clientId: uuidSchema.optional(),
      shortlistId: uuidSchema.optional(),
      brandId: uuidSchema.optional(),
      groupId: uuidSchema.optional(),
    })
    .optional(),
  studioFocus: z
    .object({
      sectionId: z.string().max(128).optional(),
      elementIndex: z.number().int().nonnegative().optional(),
      elementKind: z.string().max(64).optional(),
    })
    .optional(),
});

export const aiConversationPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    isPinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.isPinned !== undefined ||
      value.archived !== undefined,
    { message: "At least one of title, isPinned, or archived is required." }
  );

export const createCreditNoteSchema = z.object({
  invoice_id: uuidSchema,
  issue_date: z.string().trim().min(1).max(32),
  reason: z.string().trim().min(1).max(2_000),
  amount_before_vat: z.coerce.number().positive(),
  vat_affected: z.boolean(),
  notes: z.string().trim().max(5_000).nullable().optional(),
});

export const mediaProxyQuerySchema = z
  .object({
    src: z.string().url().optional(),
    profileUrl: z.string().url().optional(),
    postUrl: z.string().url().optional(),
  })
  .refine((value) => Boolean(value.src || value.profileUrl || value.postUrl), {
    message: "At least one of src, profileUrl, or postUrl is required.",
  });

const optionalNonNegNumber = z.preprocess((value) => {
  if (value === "" || value == null) return undefined;
  return value;
}, z.coerce.number().nonnegative().optional());

/** Discovery search API query (P3). */
export const discoverySearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  platform: z.string().trim().max(64).optional(),
  country: z.string().trim().max(64).optional(),
  city: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  language: z.string().trim().max(64).optional(),
  minFollowers: optionalNonNegNumber,
  maxFollowers: optionalNonNegNumber,
  minEngagement: optionalNonNegNumber,
  minViews: optionalNonNegNumber,
  page: pageSchema,
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export const operationsMovementTypeSchema = z.enum([
  "brand_to_brand",
  "client_to_client",
  "group_to_group",
  "vendor_to_vendor",
]);

/** Operations campaign movement list query (P3). */
export const operationsCampaignsQuerySchema = z.object({
  movementType: operationsMovementTypeSchema.default("brand_to_brand"),
  groupId: optionalUuidQuerySchema,
  clientId: optionalUuidQuerySchema,
  brandId: optionalUuidQuerySchema,
  search: z.string().trim().max(200).optional(),
  page: pageSchema,
});

/** Finance posting preview (shared foundation; mirrors posting-center). */
export const financePostingPreviewSchema = z.object({
  transaction_type: z.string().trim().min(1).max(64),
  period_from: z.string().trim().min(1).max(32),
  period_to: z.string().trim().min(1).max(32),
  legal_entity_id: uuidSchema.optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .optional(),
});

export const financeBatchIdSchema = z.object({
  batch_id: uuidSchema,
  reason: z.string().trim().max(2_000).optional(),
});

export const operationsVendorIdParamSchema = z.object({
  id: uuidSchema,
});
