import type { SupabaseClient } from "@supabase/supabase-js";

import { assessClientFinanceReadiness } from "@/lib/clients/finance-readiness";
import { logClientOnboardingEvent } from "@/lib/clients/onboarding-audit";
import { updateClientWithOptionalColumnRetry } from "@/lib/clients/classification-audit-columns";
import {
  isClientOnboardingStatus,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import {
  buildOnboardingUpdatePayload,
  computeOnboardingTransition,
} from "@/lib/clients/onboarding-transitions";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type TryCompleteFinanceOnboardingResult = {
  completed: boolean;
  onboardingStatus?: ClientOnboardingStatus;
};

export async function tryCompleteFinanceOnboarding(params: {
  supabase: Supabase;
  clientId: string;
  userId: string;
}): Promise<TryCompleteFinanceOnboardingResult> {
  const { data: client, error: fetchError } = await params.supabase
    .from("clients")
    .select(
      "id, onboarding_status, legal_completed_at, finance_completed_at, contracts_completed_at, tax_completed_at, credit_limit_active"
    )
    .eq("id", params.clientId)
    .maybeSingle();

  if (fetchError || !client) {
    return { completed: false };
  }

  if (!client.legal_completed_at) {
    return { completed: false };
  }

  const creditLimitActive = client.credit_limit_active ?? false;
  const readiness = assessClientFinanceReadiness({
    credit_limit_active: creditLimitActive,
    finance_completed_at: client.finance_completed_at,
  });

  if (readiness.required) {
    const status = isClientOnboardingStatus(client.onboarding_status)
      ? client.onboarding_status
      : undefined;
    return { completed: false, onboardingStatus: status };
  }

  const currentStatus = isClientOnboardingStatus(client.onboarding_status)
    ? client.onboarding_status
    : "legal_pending";

  if (client.finance_completed_at && currentStatus !== "finance_pending") {
    return { completed: false, onboardingStatus: currentStatus };
  }

  const now = new Date().toISOString();
  const transition = computeOnboardingTransition({
    currentStatus,
    currentCompletion: {
      legal_completed_at: client.legal_completed_at,
      finance_completed_at: client.finance_completed_at,
      contracts_completed_at: client.contracts_completed_at,
      tax_completed_at: client.tax_completed_at,
    },
    checklist: {
      legal: true,
      finance: true,
      contracts: Boolean(client.contracts_completed_at),
      tax: Boolean(client.tax_completed_at),
    },
    now,
    credit_limit_active: creditLimitActive,
  });

  const payload = buildOnboardingUpdatePayload({
    completion: transition.completion,
    nextStatus: transition.nextStatus,
    userId: params.userId,
    now,
    activated: transition.activated,
  });

  const { error: updateError } = await updateClientWithOptionalColumnRetry(
    params.supabase,
    params.clientId,
    payload
  );

  if (updateError) {
    return { completed: false };
  }

  if (transition.statusChanged) {
    await logClientOnboardingEvent(params.supabase, {
      clientId: params.clientId,
      actorId: params.userId,
      event: "client.onboarding_status_changed",
      summary: `Onboarding status changed to ${ONBOARDING_STATUS_LABELS[transition.nextStatus]}.`,
      previousStatus: currentStatus,
      newStatus: transition.nextStatus,
      oldData: { onboarding_status: currentStatus },
      newData: { onboarding_status: transition.nextStatus },
      metadata: {
        trigger: "finance_not_required",
        credit_limit_active: creditLimitActive,
      },
    });
  }

  return {
    completed: true,
    onboardingStatus: transition.nextStatus,
  };
}
