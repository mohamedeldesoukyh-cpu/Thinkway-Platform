/**
 * Commercial Creator CRM (L3) — independent of Identity (L1) and Discovery (L2).
 *
 * Only export CRM lifecycle helpers from this package.
 * Do not import Discovery promote / Apify identity helpers here.
 *
 * Activation helpers are for future approved workflow wiring only.
 */

export { ensureCommercialCreator } from "@/lib/creators/crm/ensure-commercial-creator";
export {
  ensureCommercialCreatorFromAssignment,
  ensureCommercialCreatorFromOperationalQuotation,
  ensureCommercialCreatorFromQuoteToCampaign,
  ensureCommercialCreatorFromVendorIo,
} from "@/lib/creators/crm/activation-helpers";
export {
  isCreatorCrmFilterEnabled,
  isCreatorCrmWritersEnabled,
} from "@/lib/creators/crm/feature-flag";
export {
  canConvertToCommercialCreator,
  isManualCrmActivationReason,
} from "@/lib/creators/crm/permissions";
export {
  computeCompletenessBreakdown,
  refreshCommercialCreatorCompleteness,
} from "@/lib/creators/crm/completeness";
export {
  composeCreatorAgreementTerms,
  saveCreatorAgreementTemplate,
} from "@/lib/creators/crm/agreement-compose";
export {
  computePaymentReadiness,
  resolvePaymentBankAccount,
  BANK_RELATIONSHIP_OPTIONS,
} from "@/lib/creators/crm/payment-readiness";
export type {
  PaymentReadinessResult,
  PaymentReadinessMissingItem,
  BankRelationshipType,
} from "@/lib/creators/crm/payment-readiness";
export { logVendorPaymentTimelineEvent } from "@/lib/creators/crm/payment-timeline";
export type {
  CompletenessBreakdown,
  CompletenessDimension,
  CompletenessMissingItem,
} from "@/lib/creators/crm/completeness";
export type {
  CreatorCrmActivationEventRow,
  CreatorCrmActivationReason,
  CreatorCrmProfileRow,
  CreatorCrmStatus,
  EnsureCommercialCreatorFailure,
  EnsureCommercialCreatorInput,
  EnsureCommercialCreatorOutcome,
  EnsureCommercialCreatorResult,
} from "@/lib/creators/crm/types";
export type { CrmActivationActor } from "@/lib/creators/crm/activation-helpers";
export type { ComposedAgreement } from "@/lib/creators/crm/agreement-compose";
