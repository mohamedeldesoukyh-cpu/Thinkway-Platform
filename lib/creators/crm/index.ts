/**
 * Commercial Creator CRM (L3) — independent of Identity (L1) and Discovery (L2).
 *
 * Only export CRM lifecycle helpers from this package.
 * Do not import Discovery promote / Apify identity helpers here.
 */

export { ensureCommercialCreator } from "@/lib/creators/crm/ensure-commercial-creator";
export { isCreatorCrmFilterEnabled } from "@/lib/creators/crm/feature-flag";
export {
  canConvertToCommercialCreator,
  isManualCrmActivationReason,
} from "@/lib/creators/crm/permissions";
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
