import { z } from "zod";

import {
  DEFAULT_PROMOTED_ONBOARDING_STATUS,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";

export const PROMOTE_WIZARD_STEPS = [
  "client",
  "brand",
  "ownership",
  "checklist",
  "review",
] as const;

export type PromoteWizardStep = (typeof PROMOTE_WIZARD_STEPS)[number];

const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const optionalTrimmed = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const promoteMasterDataSchema = z
  .object({
    quotationId: z.string().uuid(),
    clientMode: z.enum(["create", "link"]),
    clientName: optionalTrimmed(200),
    legalName: optionalTrimmed(200),
    agencyOrDirect: z.enum(["agency", "direct", "hybrid"]).default("agency"),
    industry: optionalTrimmed(120),
    country: optionalTrimmed(2),
    website: optionalTrimmed(500),
    existingClientId: optionalUuid,
    brandMode: z.enum(["create", "link", "skip"]),
    brandName: optionalTrimmed(200),
    categoryId: optionalUuid,
    subcategoryId: optionalUuid,
    existingBrandId: optionalUuid,
    groupId: optionalUuid,
    clientOwnerId: optionalUuid,
    countryManagerId: optionalUuid,
    commercialOwnerId: optionalUuid,
    clientDuplicateOverride: z.boolean().optional().default(false),
    brandDuplicateOverride: z.boolean().optional().default(false),
    acknowledged: z
      .boolean()
      .refine((val) => val === true, "You must acknowledge onboarding responsibilities."),
  })
  .superRefine((data, ctx) => {
    if (data.clientMode === "create") {
      if (!data.clientName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client name is required.",
          path: ["clientName"],
        });
      }
    } else if (!data.existingClientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an existing legal entity.",
        path: ["existingClientId"],
      });
    }

    if (data.brandMode === "create") {
      if (!data.brandName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Brand name is required.",
          path: ["brandName"],
        });
      }
    } else if (data.brandMode === "link" && !data.existingBrandId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an existing brand.",
        path: ["existingBrandId"],
      });
    }
  });

export type PromoteMasterDataInput = z.infer<typeof promoteMasterDataSchema>;

export type PromoteMasterDataCase =
  | "new_client_new_brand"
  | "new_client_no_brand"
  | "existing_client_existing_brand"
  | "existing_client_new_brand";

export function resolvePromoteCase(
  input: Pick<PromoteMasterDataInput, "clientMode" | "brandMode">
): PromoteMasterDataCase {
  if (input.clientMode === "create") {
    return input.brandMode === "create" ? "new_client_new_brand" : "new_client_no_brand";
  }
  return input.brandMode === "create" ? "existing_client_new_brand" : "existing_client_existing_brand";
}

export function canAdvancePromoteStep(
  step: PromoteWizardStep,
  draft: Partial<Omit<PromoteMasterDataInput, "acknowledged" | "quotationId">> & {
    acknowledged?: boolean;
  }
): { ok: true } | { ok: false; message: string } {
  switch (step) {
    case "client":
      if (draft.clientMode === "link") {
        return draft.existingClientId
          ? { ok: true }
          : { ok: false, message: "Select an existing legal entity." };
      }
      return draft.clientName?.trim()
        ? { ok: true }
        : { ok: false, message: "Client name is required." };
    case "brand":
      if (draft.brandMode === "skip") return { ok: true };
      if (draft.brandMode === "link") {
        return draft.existingBrandId
          ? { ok: true }
          : { ok: false, message: "Select an existing brand." };
      }
      return draft.brandName?.trim()
        ? { ok: true }
        : { ok: false, message: "Brand name is required." };
    case "ownership":
      return { ok: true };
    case "checklist":
      return draft.acknowledged
        ? { ok: true }
        : { ok: false, message: "Acknowledge onboarding responsibilities to continue." };
    case "review":
      return { ok: true };
    default:
      return { ok: false, message: "Unknown step." };
  }
}

export function buildPromoteReviewSummary(
  input: Pick<
    PromoteMasterDataInput,
    | "clientMode"
    | "clientName"
    | "brandMode"
    | "brandName"
    | "groupId"
    | "clientOwnerId"
    | "countryManagerId"
    | "commercialOwnerId"
  >
): {
  clientLabel: string;
  brandLabel: string;
  groupLabel: string;
  ownersLabel: string;
  statusLabel: string;
  onboardingStatusLabel: string;
  caseLabel: string;
} {
  const promoteCase = resolvePromoteCase(input);
  const onboardingStatus: ClientOnboardingStatus = DEFAULT_PROMOTED_ONBOARDING_STATUS;
  const caseLabels: Record<PromoteMasterDataCase, string> = {
    new_client_new_brand: "New legal entity + new brand",
    new_client_no_brand: "New legal entity only",
    existing_client_existing_brand: "Link existing legal entity + brand",
    existing_client_new_brand: "Existing legal entity + new brand",
  };

  return {
    clientLabel:
      input.clientMode === "create"
        ? input.clientName ?? "—"
        : "Existing legal entity (selected)",
    brandLabel:
      input.brandMode === "skip"
        ? "Skipped for now"
        : input.brandMode === "create"
          ? input.brandName ?? "—"
          : "Existing brand (selected)",
    groupLabel: input.groupId ? "Selected group" : "No group",
    ownersLabel: [
      input.clientOwnerId ? "Client owner" : null,
      input.countryManagerId ? "Country manager" : null,
      input.commercialOwnerId ? "Commercial owner" : null,
    ]
      .filter(Boolean)
      .join(", ") || "None assigned",
    statusLabel: "Draft (prospect)",
    onboardingStatusLabel: ONBOARDING_STATUS_LABELS[onboardingStatus],
    caseLabel: caseLabels[promoteCase],
  };
}
