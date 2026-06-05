import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResolvedLineCommercialInput } from "@/lib/assignments/resolve-line-commercial-input";
import { syncAssignmentCommercialRows } from "@/lib/assignments/sync-commercial-rows";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";

export async function syncAssignmentDeliverablesForLine(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    campaignLineId: string;
    commercial: ResolvedLineCommercialInput;
    revenueBeforeVat: number;
    costBeforeVat: number;
    dueDate: string | null;
    revenueVatPercent: number;
    revenueVatExempt: boolean;
    costVatPercent: number;
    costVatExempt: boolean;
  }
): Promise<void> {
  let rows = input.commercial.commercial_rows;

  if (
    input.commercial.pricing_mode === "package" &&
    input.commercial.platforms.length > 0
  ) {
    rows = packagePlatformsToCommercialRows(input.commercial.platforms, {
      totalRevenueBeforeVat: input.revenueBeforeVat,
      totalCostBeforeVat: input.costBeforeVat,
      dueDate: input.dueDate,
    });
  }

  if (rows.length === 0) return;

  await syncAssignmentCommercialRows(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    campaignLineId: input.campaignLineId,
    rows,
    revenueVatPercent: input.revenueVatPercent,
    revenueVatExempt: input.revenueVatExempt,
    costVatPercent: input.costVatPercent,
    costVatExempt: input.costVatExempt,
  });
}
