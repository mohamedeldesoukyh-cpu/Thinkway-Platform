export type FinanceReadinessResult = {
  /** When false, finance approval is not required for onboarding. */
  required: boolean;
  complete: boolean;
  missing: string[];
};

/** Finance onboarding applies only when credit limit enforcement is active. */
export function isFinanceOnboardingRequired(creditLimitActive: boolean): boolean {
  return creditLimitActive;
}

export function assessClientFinanceReadiness(input: {
  credit_limit_active: boolean;
  finance_completed_at: string | null | undefined;
}): FinanceReadinessResult {
  if (!isFinanceOnboardingRequired(input.credit_limit_active)) {
    return { required: false, complete: true, missing: [] };
  }

  const complete = Boolean(input.finance_completed_at);
  return {
    required: true,
    complete,
    missing: complete ? [] : ["Finance approval"],
  };
}
