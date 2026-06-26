import {
  ONBOARDING_STATUS_TONE as ONBOARDING_STATUS_TONE_MAP,
  type SemanticStatusTone,
} from "@/components/shared/status/status-config";
import type { ClientStatus } from "@/types/database";

export const CLIENT_ONBOARDING_STATUSES = [
  "draft",
  "legal_pending",
  "finance_pending",
  "ready",
  "active",
] as const;

export type ClientOnboardingStatus = (typeof CLIENT_ONBOARDING_STATUSES)[number];

export const ONBOARDING_CHECKLIST_SECTIONS = [
  "legal",
  "finance",
  "contracts",
  "tax",
] as const;

export type OnboardingChecklistSection = (typeof ONBOARDING_CHECKLIST_SECTIONS)[number];

export type OnboardingCompletionFields = {
  legal_completed_at?: string | null;
  finance_completed_at?: string | null;
  contracts_completed_at?: string | null;
  tax_completed_at?: string | null;
};

export type OnboardingSectionProgress = {
  id: OnboardingChecklistSection;
  label: string;
  completed: boolean;
  completedAt: string | null;
};

export type OnboardingProgress = {
  sections: OnboardingSectionProgress[];
  completedCount: number;
  totalCount: number;
  percentage: number;
};

export const ONBOARDING_STATUS_LABELS: Record<ClientOnboardingStatus, string> = {
  draft: "Draft",
  legal_pending: "Legal pending",
  finance_pending: "Finance pending",
  ready: "Ready",
  active: "Active",
};

export const ONBOARDING_STATUS_TONE: Record<
  ClientOnboardingStatus,
  SemanticStatusTone
> = ONBOARDING_STATUS_TONE_MAP;

const SECTION_LABELS: Record<OnboardingChecklistSection, string> = {
  legal: "Legal",
  finance: "Finance",
  contracts: "Contracts",
  tax: "Tax",
};

const SECTION_TIMESTAMP_KEY: Record<
  OnboardingChecklistSection,
  keyof OnboardingCompletionFields
> = {
  legal: "legal_completed_at",
  finance: "finance_completed_at",
  contracts: "contracts_completed_at",
  tax: "tax_completed_at",
};

/** Default onboarding status after quotation promote-to-master-data. */
export const DEFAULT_PROMOTED_ONBOARDING_STATUS: ClientOnboardingStatus = "legal_pending";

export function isClientOnboardingStatus(value: string): value is ClientOnboardingStatus {
  return (CLIENT_ONBOARDING_STATUSES as readonly string[]).includes(value);
}

export function computeOnboardingProgress(
  input: OnboardingCompletionFields
): OnboardingProgress {
  const sections = ONBOARDING_CHECKLIST_SECTIONS.map((id) => {
    const key = SECTION_TIMESTAMP_KEY[id];
    const completedAt = input[key] ?? null;
    return {
      id,
      label: SECTION_LABELS[id],
      completed: Boolean(completedAt),
      completedAt,
    };
  });

  const completedCount = sections.filter((s) => s.completed).length;
  const totalCount = sections.length;
  const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return { sections, completedCount, totalCount, percentage };
}

const VALID_TRANSITIONS: Record<ClientOnboardingStatus, readonly ClientOnboardingStatus[]> = {
  draft: ["legal_pending", "finance_pending", "ready", "active"],
  legal_pending: ["finance_pending", "ready", "active"],
  finance_pending: ["ready", "active"],
  ready: ["active"],
  active: [],
};

export function canTransitionOnboardingStatus(
  from: ClientOnboardingStatus,
  to: ClientOnboardingStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

export function deriveOnboardingStatusFromCompletion(
  input: OnboardingCompletionFields,
  current: ClientOnboardingStatus = DEFAULT_PROMOTED_ONBOARDING_STATUS
): ClientOnboardingStatus {
  const progress = computeOnboardingProgress(input);

  // Rule 4: all sections complete → active
  if (progress.percentage >= 100) return "active";

  // Rule 3: finance complete → ready
  if (input.finance_completed_at) return "ready";

  // Rule 2: legal complete → finance_pending
  if (input.legal_completed_at) return "finance_pending";

  if (current === "draft") return "draft";
  if (current === "active") return "active";

  return "legal_pending";
}

export function onboardingStatusReviewLabel(status: ClientOnboardingStatus): string {
  return ONBOARDING_STATUS_LABELS[status];
}

const CLIENT_OPERATIONAL_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

export type ClientListStatusBadges = {
  operationalStatus: ClientStatus;
  /** When null, onboarding adds no extra badge (missing, invalid, or redundant with operational). */
  onboardingStatus: ClientOnboardingStatus | null;
};

/** List tables: one badge when labels match (e.g. Active + Active); both when they differ. */
export function resolveClientListStatusBadges(input: {
  status: ClientStatus;
  onboardingStatus: string | null | undefined;
}): ClientListStatusBadges {
  const operationalLabel =
    CLIENT_OPERATIONAL_STATUS_LABELS[input.status] ?? input.status;

  if (
    !input.onboardingStatus ||
    !isClientOnboardingStatus(input.onboardingStatus)
  ) {
    return {
      operationalStatus: input.status,
      onboardingStatus: null,
    };
  }

  const onboardingStatus = input.onboardingStatus;
  const onboardingLabel = ONBOARDING_STATUS_LABELS[onboardingStatus];

  if (operationalLabel === onboardingLabel) {
    return {
      operationalStatus: input.status,
      onboardingStatus: null,
    };
  }

  return {
    operationalStatus: input.status,
    onboardingStatus,
  };
}
