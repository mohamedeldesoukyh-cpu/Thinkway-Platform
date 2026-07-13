"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logClientOnboardingEvent } from "@/lib/clients/onboarding-audit";
import { updateClientWithOptionalColumnRetry } from "@/lib/clients/classification-audit-columns";
import {
  requireOnboardingChecklistAccess,
  requireOnboardingOverrideAccess,
} from "@/lib/clients/onboarding-permissions";
import {
  isClientOnboardingStatus,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { isFinanceOnboardingRequired } from "@/lib/clients/finance-readiness";
import { assessClientTaxReadiness } from "@/lib/clients/tax-readiness";
import {
  applyChecklistToCompletion,
  buildOnboardingUpdatePayload,
  computeOnboardingTransition,
  validateManualStatusOverride,
  type OnboardingChecklistInput,
} from "@/lib/clients/onboarding-transitions";

export type OnboardingActionState = {
  ok: boolean;
  message?: string;
  onboardingStatus?: ClientOnboardingStatus;
};

const checklistBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "1",
  z.boolean()
);

const updateOnboardingChecklistSchema = z.object({
  client_id: z.string().uuid(),
  legal: checklistBoolean,
  finance: checklistBoolean,
  contracts: checklistBoolean,
  tax: checklistBoolean,
});

const overrideOnboardingStatusSchema = z.object({
  client_id: z.string().uuid(),
  status: z.string().refine(isClientOnboardingStatus, "Invalid onboarding status"),
});

function parseChecklistFromRecord(
  data: z.infer<typeof updateOnboardingChecklistSchema>
): OnboardingChecklistInput {
  return {
    legal: data.legal,
    finance: data.finance,
    contracts: data.contracts,
    tax: data.tax,
  };
}

export async function updateClientOnboardingChecklistAction(
  input: z.infer<typeof updateOnboardingChecklistSchema>
): Promise<OnboardingActionState> {
  const parsed = updateOnboardingChecklistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid onboarding checklist payload." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireOnboardingChecklistAccess(supabase);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select(
      "id, onboarding_status, legal_completed_at, finance_completed_at, contracts_completed_at, tax_completed_at, tax_id, credit_limit_active"
    )
    .eq("id", parsed.data.client_id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, message: fetchError.message };
  }

  if (!client) {
    return { ok: false, message: "Client not found." };
  }

  const currentStatus = isClientOnboardingStatus(client.onboarding_status)
    ? client.onboarding_status
    : "legal_pending";

  const now = new Date().toISOString();
  const creditLimitActive = client.credit_limit_active ?? false;
  const checklist = parseChecklistFromRecord(parsed.data);
  const effectiveChecklist: OnboardingChecklistInput = {
    ...checklist,
    finance:
      checklist.finance ||
      !isFinanceOnboardingRequired(creditLimitActive),
  };

  if (effectiveChecklist.tax && !client.tax_completed_at) {
    const { data: documents, error: documentsError } = await supabase
      .from("client_documents")
      .select("document_type")
      .eq("client_id", parsed.data.client_id);

    if (documentsError) {
      return { ok: false, message: documentsError.message };
    }

    const taxReadiness = assessClientTaxReadiness({
      tax_id: client.tax_id,
      documentTypes: (documents ?? []).map((doc) => doc.document_type),
    });

    if (!taxReadiness.complete) {
      return {
        ok: false,
        message: `Tax cannot be marked complete until ${taxReadiness.missing.join(", ")} ${taxReadiness.missing.length === 1 ? "is" : "are"} provided on the Legal tab.`,
      };
    }
  }

  const transition = computeOnboardingTransition({
    currentStatus,
    currentCompletion: {
      legal_completed_at: client.legal_completed_at,
      finance_completed_at: client.finance_completed_at,
      contracts_completed_at: client.contracts_completed_at,
      tax_completed_at: client.tax_completed_at,
    },
    checklist: effectiveChecklist,
    now,
    credit_limit_active: creditLimitActive,
  });

  const payload = buildOnboardingUpdatePayload({
    completion: transition.completion,
    nextStatus: transition.nextStatus,
    userId: auth.userId,
    now,
    activated: transition.activated,
  });

  const { error: updateError } = await updateClientWithOptionalColumnRetry(
    supabase,
    parsed.data.client_id,
    payload
  );

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (transition.statusChanged) {
    await logClientOnboardingEvent(supabase, {
      clientId: parsed.data.client_id,
      actorId: auth.userId,
      event: "client.onboarding_status_changed",
      summary: `Onboarding status changed to ${ONBOARDING_STATUS_LABELS[transition.nextStatus]}.`,
      previousStatus: currentStatus,
      newStatus: transition.nextStatus,
      oldData: { onboarding_status: currentStatus },
      newData: { onboarding_status: transition.nextStatus },
      metadata: {
        trigger: "checklist",
        checklist: parseChecklistFromRecord(parsed.data),
      },
    });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.client_id}`);

  return {
    ok: true,
    message: "Onboarding checklist saved.",
    onboardingStatus: transition.nextStatus,
  };
}

export async function overrideClientOnboardingStatusAction(
  input: z.infer<typeof overrideOnboardingStatusSchema>
): Promise<OnboardingActionState> {
  const parsed = overrideOnboardingStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid onboarding status override." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireOnboardingOverrideAccess(supabase);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select("id, onboarding_status")
    .eq("id", parsed.data.client_id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, message: fetchError.message };
  }

  if (!client) {
    return { ok: false, message: "Client not found." };
  }

  const currentStatus = isClientOnboardingStatus(client.onboarding_status)
    ? client.onboarding_status
    : "legal_pending";
  const nextStatus = parsed.data.status;

  const validation = validateManualStatusOverride(currentStatus, nextStatus);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (currentStatus === nextStatus) {
    return { ok: true, message: "No change.", onboardingStatus: nextStatus };
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    onboarding_status: nextStatus,
    onboarding_updated_by: auth.userId,
  };

  if (nextStatus === "active") {
    payload.activated_at = now;
    payload.onboarding_completed_by = auth.userId;
    payload.status = "active";
  }

  const { error: updateError } = await updateClientWithOptionalColumnRetry(
    supabase,
    parsed.data.client_id,
    payload
  );

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await logClientOnboardingEvent(supabase, {
    clientId: parsed.data.client_id,
    actorId: auth.userId,
    event: "client.onboarding_status_changed",
    summary: `Onboarding status manually set to ${ONBOARDING_STATUS_LABELS[nextStatus]}.`,
    previousStatus: currentStatus,
    newStatus: nextStatus,
    oldData: { onboarding_status: currentStatus },
    newData: { onboarding_status: nextStatus },
    metadata: { trigger: "manual_override" },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.client_id}`);

  return {
    ok: true,
    message: `Status updated to ${ONBOARDING_STATUS_LABELS[nextStatus]}.`,
    onboardingStatus: nextStatus,
  };
}
