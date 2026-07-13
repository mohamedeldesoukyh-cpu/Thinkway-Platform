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

/** Optional client flags that affect onboarding derivation. */
export type OnboardingDerivationInput = OnboardingCompletionFields & {
  credit_limit_active?: boolean;
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

export function getIncompleteOnboardingSectionLabels(
  progress: OnboardingProgress,
  input?: OnboardingDerivationInput
): string[] {
  return progress.sections
    .filter((section) => (input ? isOnboardingSectionApplicable(section.id, input) : true))
    .filter((section) => !section.completed)
    .map((section) => section.label);
}

/** Human-readable step count, e.g. "1 of 3 steps complete" or "Complete". */
export function formatOnboardingStepProgress(progress: OnboardingProgress): string {
  if (progress.percentage >= 100) {
    return "Complete";
  }
  return `${progress.completedCount} of ${progress.totalCount} steps complete`;
}

/** Step count plus remaining section names when incomplete. */
export function formatOnboardingProgressDetail(
  progress: OnboardingProgress,
  input?: OnboardingDerivationInput
): string {
  const stepProgress = formatOnboardingStepProgress(progress);
  if (progress.percentage >= 100) {
    return stepProgress;
  }
  const remaining = getIncompleteOnboardingSectionLabels(progress, input);
  if (remaining.length === 0) {
    return stepProgress;
  }
  return `${stepProgress} (${remaining.join(", ")} remaining)`;
}

/** Status badge copy for workspace headers — replaces opaque percentage-only labels. */
export function formatOnboardingStatusProgressBadge(
  status: ClientOnboardingStatus,
  progress: OnboardingProgress
): string {
  const statusLabel = ONBOARDING_STATUS_LABELS[status];
  if (progress.percentage >= 100) {
    return `${statusLabel} · Complete`;
  }
  return `${statusLabel} · ${formatOnboardingStepProgress(progress)}`;
}

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

export function isFinanceOnboardingSatisfied(input: OnboardingDerivationInput): boolean {
  if (input.credit_limit_active === false) return true;
  return Boolean(input.finance_completed_at);
}

/** Contracts are tracked on the checklist but excluded from progress (like VR% on overview). */
export function isContractsOnboardingApplicable(): boolean {
  return false;
}

export function isOnboardingSectionApplicable(
  sectionId: OnboardingChecklistSection,
  input: OnboardingDerivationInput
): boolean {
  if (sectionId === "finance" && input.credit_limit_active === false) {
    return false;
  }
  if (sectionId === "contracts" && !isContractsOnboardingApplicable()) {
    return false;
  }
  return true;
}

export function computeOnboardingProgress(
  input: OnboardingDerivationInput
): OnboardingProgress {
  const sections = ONBOARDING_CHECKLIST_SECTIONS.map((id) => {
    const key = SECTION_TIMESTAMP_KEY[id];
    const completedAt = input[key] ?? null;
    const financeNotRequired =
      id === "finance" && input.credit_limit_active === false;
    return {
      id,
      label: SECTION_LABELS[id],
      completed: financeNotRequired || Boolean(completedAt),
      completedAt: financeNotRequired ? null : completedAt,
    };
  });

  const applicableSections = sections.filter((section) =>
    isOnboardingSectionApplicable(section.id, input)
  );
  const completedCount = applicableSections.filter((section) => section.completed).length;
  const totalCount = applicableSections.length;
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
  input: OnboardingDerivationInput,
  current: ClientOnboardingStatus = DEFAULT_PROMOTED_ONBOARDING_STATUS
): ClientOnboardingStatus {
  const progress = computeOnboardingProgress(input);

  // Rule 4: all sections complete → active
  if (progress.percentage >= 100) return "active";

  // Rule 3: finance satisfied (approved or credit limit not active) → ready
  if (isFinanceOnboardingSatisfied(input)) return "ready";

  // Rule 2: legal complete, finance required but incomplete → finance_pending
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
