import { z } from "zod";

import {
  CLIENT_CATEGORY_SLUGS,
  CLIENT_SUBCATEGORY_SLUGS,
  isValidClientCategoryPair,
} from "@/lib/clients/client-category-taxonomy";
import { CLIENT_INDUSTRY_OPTIONS } from "@/lib/master-data/constants";
import { currencyCodeSchema } from "@/lib/master-data/currency-schema";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

const clientStatusSchema = z.enum([
  "prospect",
  "active",
  "inactive",
  "archived",
]);

const paymentTermsSchema = z.enum([
  "due_on_receipt",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "net_90",
  "custom",
]);

const agencyOrDirectSchema = z.enum(["agency", "direct", "hybrid"]);

const clientIndustrySchema = z.enum(
  CLIENT_INDUSTRY_OPTIONS.map((option) => option.value) as [string, ...string[]]
);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}, z.number().min(0).nullable().optional());

const optionalGroupId = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .union([z.literal(""), z.string().uuid("Select a valid group")])
    .transform((value) => (value === "" ? null : value))
);

const optionalTrimmedString = (max: number, message?: string) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    },
    message
      ? z.string().max(max, message)
      : z.string().max(max)
  );

const optionalUrl = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .string()
    .max(500)
    .refine(
      (val) => !val || z.string().url().safeParse(val).success,
      "Enter a valid URL"
    )
);

const optionalEmail = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .string()
    .max(320)
    .refine(
      (val) => !val || z.string().email().safeParse(val).success,
      "Enter a valid email"
    )
);

const optionalIndustry = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z.union([z.literal(""), clientIndustrySchema, z.string().max(120)])
);

const optionalClientCategorySlug = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .union([z.literal(""), z.enum(CLIENT_CATEGORY_SLUGS)])
    .transform((value) => (value === "" ? null : value))
);

const optionalClientSubcategorySlug = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .union([z.literal(""), z.enum(CLIENT_SUBCATEGORY_SLUGS)])
    .transform((value) => (value === "" ? null : value))
);

const optionalClassificationSource = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .union([
      z.literal(""),
      z.enum(["approved", "rule", "historical", "ai_search", "fallback"]),
    ])
    .transform((value) => (value === "" ? null : value))
);

const optionalClassificationConfidence = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  },
  z.number().min(0).max(100).nullable()
);

const optionalClassificationReason = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  },
  z
    .string()
    .max(2000)
    .transform((value) => (value === "" ? null : value))
);

const optionalBooleanFlag = z.preprocess(
  (value) => value === true || value === "true" || value === "1",
  z.boolean()
);

function validateClientCategoryPair(
  data: {
    client_category: string | null;
    client_subcategory: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.client_category && !data.client_subcategory) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a subcategory for the chosen category",
      path: ["client_subcategory"],
    });
  }

  if (data.client_subcategory && !data.client_category) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a category before choosing a subcategory",
      path: ["client_category"],
    });
  }

  if (
    data.client_category &&
    data.client_subcategory &&
    !isValidClientCategoryPair(data.client_category, data.client_subcategory)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Subcategory does not belong to the selected category",
      path: ["client_subcategory"],
    });
  }
}

export const createClientSchema = z
  .object({
  group_id: optionalGroupId,
  name: z
    .string()
    .trim()
    .min(1, "Client legal name is required")
    .max(200, "Name is too long"),
  name_ar: optionalTrimmedString(200, "Arabic name is too long"),
  legal_name: optionalTrimmedString(200),
  agency_or_direct: agencyOrDirectSchema,
  industry: optionalIndustry,
  client_category: optionalClientCategorySlug,
  client_subcategory: optionalClientSubcategorySlug,
  classification_source: optionalClassificationSource,
  classification_confidence: optionalClassificationConfidence,
  classification_reason: optionalClassificationReason,
  suggestion_accepted: optionalBooleanFlag.default(false),
  category_manually_set: optionalBooleanFlag.default(false),
  vr_rate_id: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    },
    z.union([z.literal(""), z.string().uuid()])
  ).transform((value) => (value === "" ? null : value)),
  website: optionalUrl,
  status: clientStatusSchema.default("prospect"),
  billing_email: optionalEmail,
  currency: currencyCodeSchema.default(DEFAULT_PLATFORM_CURRENCY),
  country: optionalTrimmedString(2),
  city: optionalTrimmedString(120),
  notes: optionalTrimmedString(2000),
  client_io_terms_text: optionalTrimmedString(50000),
  client_workspace_enabled: optionalBooleanFlag.default(false),
  client_workspace_package: z.preprocess(
    (value) => (value == null ? "" : String(value).trim()),
    z.union([z.literal(""), z.enum(["planning", "commercial", "live"])])
  ),
  client_workspace_tab_overrides: optionalTrimmedString(2000),
})
  .superRefine(validateClientCategoryPair);

export const updateClientOverviewSchema = z
  .object({
  client_id: z.string().uuid(),
  group_id: optionalGroupId,
  name: z.string().trim().min(1).max(200),
  name_ar: optionalTrimmedString(200, "Arabic name is too long"),
  legal_name: optionalTrimmedString(200),
  agency_or_direct: agencyOrDirectSchema,
  industry: optionalIndustry,
  client_category: optionalClientCategorySlug,
  client_subcategory: optionalClientSubcategorySlug,
  classification_source: optionalClassificationSource,
  classification_confidence: optionalClassificationConfidence,
  classification_reason: optionalClassificationReason,
  suggestion_accepted: optionalBooleanFlag.default(false),
  category_manually_set: optionalBooleanFlag.default(false),
  vr_rate_id: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    },
    z.union([z.literal(""), z.string().uuid()])
  ).transform((value) => (value === "" ? null : value)),
  website: optionalUrl,
  status: clientStatusSchema,
  billing_email: optionalEmail,
  billing_phone: optionalTrimmedString(40),
  country: optionalTrimmedString(2),
  city: optionalTrimmedString(120),
  notes: optionalTrimmedString(2000),
  client_io_terms_text: optionalTrimmedString(50000),
  client_workspace_enabled: optionalBooleanFlag.default(false),
  client_workspace_package: z.preprocess(
    (value) => (value == null ? "" : String(value).trim()),
    z.union([z.literal(""), z.enum(["planning", "commercial", "live"])])
  ),
  client_workspace_tab_overrides: optionalTrimmedString(2000),
})
  .superRefine(validateClientCategoryPair);

export const updateClientLegalSchema = z.object({
  client_id: z.string().uuid(),
  trade_license_number: optionalTrimmedString(120),
  trade_license_expiry: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    },
    z
      .string()
      .optional()
      .transform((val) => (val ? val : null))
  ),
  vat_number: optionalTrimmedString(120),
  tax_id: optionalTrimmedString(120),
  legal_address_line1: optionalTrimmedString(200),
  legal_address_line2: optionalTrimmedString(200),
  legal_address_city: optionalTrimmedString(120),
  legal_address_country: optionalTrimmedString(2),
  legal_address_postal: optionalTrimmedString(32),
});

const formBooleanSchema = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((value) => value === true || value === "true");

export const updateClientFinanceSchema = z.object({
  client_id: z.string().uuid(),
  currency: currencyCodeSchema,
  payment_terms: paymentTermsSchema.optional().or(z.literal("")),
  credit_limit: optionalNumber,
  credit_limit_active: formBooleanSchema,
  accept_credit_risk: formBooleanSchema,
  billing_email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  billing_phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const updateClientCreditLimitSchema = z.object({
  client_id: z.string().uuid(),
  credit_limit: optionalNumber,
  credit_limit_active: formBooleanSchema,
  accept_credit_risk: formBooleanSchema,
});

export const uploadClientDocumentSchema = z.object({
  client_id: z.string().uuid(),
  document_type: z.enum([
    "trade_license",
    "vat_certificate",
    "tax_certificate",
    "nda",
    "msa_contract",
    "sow",
  ]),
  expires_at: optionalDate,
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
