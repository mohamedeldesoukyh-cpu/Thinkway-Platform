import type { SupabaseClient } from "@supabase/supabase-js";

import { logClientOnboardingEvent } from "@/lib/clients/onboarding-audit";
import { updateClientWithOptionalColumnRetry } from "@/lib/clients/classification-audit-columns";
import { assessClientLegalReadiness } from "@/lib/clients/legal-readiness";
import { isFinanceOnboardingRequired } from "@/lib/clients/finance-readiness";
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

export type TryCompleteLegalOnboardingResult = {
  completed: boolean;
  onboardingStatus?: ClientOnboardingStatus;
};

export async function tryCompleteLegalOnboarding(params: {
  supabase: Supabase;
  clientId: string;
  userId: string;
}): Promise<TryCompleteLegalOnboardingResult> {
  const { data: client, error: fetchError } = await params.supabase
    .from("clients")
    .select(
      "id, onboarding_status, legal_completed_at, finance_completed_at, contracts_completed_at, tax_completed_at, trade_license_number, trade_license_expiry, vat_number, legal_address, credit_limit_active"
    )
    .eq("id", params.clientId)
    .maybeSingle();

  if (fetchError || !client) {
    return { completed: false };
  }

  if (client.legal_completed_at) {
    const status = isClientOnboardingStatus(client.onboarding_status)
      ? client.onboarding_status
      : undefined;
    return { completed: false, onboardingStatus: status };
  }

  const { data: documents, error: documentsError } = await params.supabase
    .from("client_documents")
    .select("document_type")
    .eq("client_id", params.clientId);

  if (documentsError) {
    return { completed: false };
  }

  const readiness = assessClientLegalReadiness({
    trade_license_number: client.trade_license_number,
    trade_license_expiry: client.trade_license_expiry,
    vat_number: client.vat_number,
    legal_address:
      client.legal_address && typeof client.legal_address === "object"
        ? (client.legal_address as Record<string, unknown>)
        : null,
    documentTypes: (documents ?? []).map((doc) => doc.document_type),
  });

  if (!readiness.complete) {
    return { completed: false };
  }

  const currentStatus = isClientOnboardingStatus(client.onboarding_status)
    ? client.onboarding_status
    : "legal_pending";
  const now = new Date().toISOString();

  const creditLimitActive = client.credit_limit_active ?? false;
  const financeChecklistComplete =
    Boolean(client.finance_completed_at) || !isFinanceOnboardingRequired(creditLimitActive);

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
      finance: financeChecklistComplete,
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
        trigger: "legal_requirements_met",
      },
    });
  }

  return {
    completed: true,
    onboardingStatus: transition.nextStatus,
  };
}
