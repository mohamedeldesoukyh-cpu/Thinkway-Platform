import { normalizeOperationalStatus } from "@/lib/campaigns/operational-status-utils";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";

/**
 * Derive UI/eligibility status when DB operational_status is stale (e.g. prod not backfilled).
 * Canonical values still come from syncLineOperationalStatus after billing/IO actions.
 */
export function effectiveLineOperationalStatus(input: {
  operational_status: string | null | undefined;
  vendor_io_id: string | null | undefined;
  billing_status?: string | null | undefined;
  invoice_id?: string | null | undefined;
  finance_override_until?: string | null | undefined;
}): CampaignLineOperationalStatus {
  const raw = (input.operational_status ?? "draft") as CampaignLineOperationalStatus;

  if (raw === "io_generated" && !input.vendor_io_id) {
    return "draft";
  }

  // Legacy rows stored moved_to_billing on operational_status — billing column owns that state.
  if (raw === "moved_to_billing" && input.vendor_io_id) {
    return "io_generated";
  }

  if (raw !== "draft") return normalizeOperationalStatus(raw);

  const billing = input.billing_status ?? "draft";
  if (billing === "closed") return "closed";
  if (billing === "partially_invoiced") return "partially_invoiced";
  if (["invoiced", "paid", "closed"].includes(billing)) return "invoiced";

  if (input.invoice_id) {
    return billing === "partially_invoiced" ? "partially_invoiced" : "invoiced";
  }

  if (input.finance_override_until) {
    const until = new Date(input.finance_override_until).getTime();
    if (Number.isFinite(until) && until > Date.now()) {
      if (["moved_to_billing", "approved", "partially_invoiced", "invoiced"].includes(billing)) {
        return "reopened";
      }
    }
  }

  if (input.vendor_io_id) return "io_generated";

  return "draft";
}

/** Safe status for UI maps (row classes, badges) — unknown DB values become `draft`. */
export function effectiveLineOperationalStatusForUi(
  input: Parameters<typeof effectiveLineOperationalStatus>[0]
): CampaignLineOperationalStatus {
  return normalizeOperationalStatus(effectiveLineOperationalStatus(input));
}
