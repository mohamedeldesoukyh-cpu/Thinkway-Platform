import type { SupabaseClient } from "@supabase/supabase-js";

import {
  relockInvoiceOperationalScope,
  unlockInvoiceOperationalScope,
} from "@/lib/billing/invoice-lifecycle-operational";
import { ensureInvoiceFinanceDocument } from "@/lib/finance/finance-document-registry";
import type { InvoiceStatus } from "@/lib/finance/status/invoice-status";

/** Invoice statuses that trigger operational + billing locks. */
export const INVOICE_LOCK_STATUSES: readonly InvoiceStatus[] = [
  "sent",
  "partial",
  "paid",
] as const;

const LOCK_STATUS_SET = new Set<string>([...INVOICE_LOCK_STATUSES, "draft"]);

export function shouldLockInvoiceOperationalState(status: string): boolean {
  return INVOICE_LOCK_STATUSES.includes(status as InvoiceStatus);
}

/** Lock assignments, deliverables, posts, and IO editing for an invoiced state. */
export async function lockInvoiceAssignments(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { billingStatus?: string }
): Promise<{ lineIds: string[]; error?: string }> {
  return relockInvoiceOperationalScope(supabase, invoiceId, options);
}

/** Unlock assignments after unpost or void. */
export async function unlockInvoiceAssignments(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: { financeOverrideHours?: number }
): Promise<{ lineIds: string[]; error?: string }> {
  const result = await unlockInvoiceOperationalScope(supabase, invoiceId, {
    mode: "void",
    financeOverrideHours: options?.financeOverrideHours,
    preserveLineItems: false,
  });
  return { lineIds: result.lineIds, error: result.error };
}

/** Sync OPS + billing when invoice status changes. */
export async function syncInvoiceOperationalStates(
  supabase: SupabaseClient,
  invoiceId: string,
  status: string,
  actorId?: string | null
): Promise<void> {
  await ensureInvoiceFinanceDocument(supabase, invoiceId, actorId);

  if (shouldLockInvoiceOperationalState(status) || LOCK_STATUS_SET.has(status)) {
    const billingStatus =
      status === "paid"
        ? "paid"
        : status === "partial"
          ? "partially_paid"
          : "invoiced";
    await lockInvoiceAssignments(supabase, invoiceId, { billingStatus });
    return;
  }

  if (status === "void" || status === "draft") {
    await unlockInvoiceAssignments(supabase, invoiceId);
  }
}
