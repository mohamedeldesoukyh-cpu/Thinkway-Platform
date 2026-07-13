import {
  canTransitionOnboardingStatus,
  deriveOnboardingStatusFromCompletion,
  type ClientOnboardingStatus,
  type OnboardingChecklistSection,
  type OnboardingCompletionFields,
} from "@/lib/clients/onboarding-status";

export type OnboardingChecklistInput = Record<OnboardingChecklistSection, boolean>;

export type OnboardingTransitionResult = {
  completion: OnboardingCompletionFields;
  nextStatus: ClientOnboardingStatus;
  statusChanged: boolean;
  activated: boolean;
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

export function applyChecklistToCompletion(
  current: OnboardingCompletionFields,
  checklist: OnboardingChecklistInput,
  now: string
): OnboardingCompletionFields {
  const next: OnboardingCompletionFields = { ...current };

  for (const section of Object.keys(checklist) as OnboardingChecklistSection[]) {
    const key = SECTION_TIMESTAMP_KEY[section];
    const checked = checklist[section];
    const existing = current[key] ?? null;

    if (checked) {
      next[key] = existing ?? now;
    } else {
      next[key] = null;
    }
  }

  return next;
}

export function computeOnboardingTransition(input: {
  currentStatus: ClientOnboardingStatus;
  currentCompletion: OnboardingCompletionFields;
  checklist: OnboardingChecklistInput;
  now: string;
  credit_limit_active?: boolean;
}): OnboardingTransitionResult {
  const completion = applyChecklistToCompletion(
    input.currentCompletion,
    input.checklist,
    input.now
  );
  const nextStatus = deriveOnboardingStatusFromCompletion(
    { ...completion, credit_limit_active: input.credit_limit_active },
    input.currentStatus
  );

  return {
    completion,
    nextStatus,
    statusChanged: nextStatus !== input.currentStatus,
    activated: nextStatus === "active" && input.currentStatus !== "active",
  };
}

export function buildOnboardingUpdatePayload(input: {
  completion: OnboardingCompletionFields;
  nextStatus: ClientOnboardingStatus;
  userId: string;
  now: string;
  activated: boolean;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    legal_completed_at: input.completion.legal_completed_at ?? null,
    finance_completed_at: input.completion.finance_completed_at ?? null,
    contracts_completed_at: input.completion.contracts_completed_at ?? null,
    tax_completed_at: input.completion.tax_completed_at ?? null,
    onboarding_status: input.nextStatus,
    onboarding_updated_by: input.userId,
  };

  if (input.activated) {
    payload.activated_at = input.now;
    payload.onboarding_completed_by = input.userId;
    payload.status = "active";
  }

  return payload;
}

export function validateManualStatusOverride(
  from: ClientOnboardingStatus,
  to: ClientOnboardingStatus
): { ok: true } | { ok: false; message: string } {
  if (from === to) {
    return { ok: true };
  }

  if (!canTransitionOnboardingStatus(from, to)) {
    return {
      ok: false,
      message: `Cannot change onboarding status from ${from} to ${to}.`,
    };
  }

  return { ok: true };
}
