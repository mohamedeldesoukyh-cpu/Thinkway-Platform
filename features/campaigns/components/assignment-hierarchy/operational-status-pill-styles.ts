import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { OPERATIONAL_STATUS_TONE } from "@/components/shared/status/status-config";
import {
  buildToneClassMap,
  STATUS_PILL_BASE_CLASS,
} from "@/components/shared/status/status-utils";
import { normalizeOperationalStatusForOpsBadge } from "@/lib/campaigns/operational-status-utils";

/** Shared pill colors for Ops + Billing columns in assignment hierarchy. */
export const OPERATIONAL_PILL_CLASS: Record<CampaignLineOperationalStatus, string> =
  buildToneClassMap(OPERATIONAL_STATUS_TONE, "pill", STATUS_PILL_BASE_CLASS);

export const OPERATIONAL_STATUS_PILL_BASE = STATUS_PILL_BASE_CLASS;

export {
  normalizeOperationalStatus,
  normalizeOperationalStatusForOpsBadge,
} from "@/lib/campaigns/operational-status-utils";
