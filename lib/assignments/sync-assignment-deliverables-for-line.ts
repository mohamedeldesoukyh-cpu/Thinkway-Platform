import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResolvedLineCommercialInput } from "@/lib/assignments/resolve-line-commercial-input";
import {
  applyAssignmentUrAfToCommercialRows,
  applyAssignmentUrCostToCommercialRows,
} from "@/lib/assignments/commercial-calculations";
import { syncAssignmentCommercialRows } from "@/lib/assignments/sync-commercial-rows";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";
import { redistributePackageLineToDeliverables } from "@/lib/services/campaigns/campaign-deliverable-service";

export async function syncAssignmentDeliverablesForLine(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    campaignLineId: string;
    commercial: ResolvedLineCommercialInput;
    revenueBeforeVat: number;
    costBeforeVat: number;
    usageRightsAmount: number;
    usageRightsCost: number;
    agencyFeePercent: number;
    dueDate: string | null;
    revenueVatPercent: number;
    revenueVatExempt: boolean;
    costVatPercent: number;
    costVatExempt: boolean;
  }
): Promise<void> {
  if (input.commercial.pricing_mode === "package") {
    const { count } = await supabase
      .from("assignment_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("campaign_line_id", input.campaignLineId);
    if ((count ?? 0) > 0) {
      await redistributePackageLineToDeliverables(supabase, input.campaignLineId);
      return;
    }
  }

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
    rows = applyAssignmentUrAfToCommercialRows(
      rows,
      input.usageRightsAmount,
      input.agencyFeePercent
    );
    rows = applyAssignmentUrCostToCommercialRows(rows, input.usageRightsCost);
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

  if (input.commercial.pricing_mode === "package") {
    await redistributePackageLineToDeliverables(supabase, input.campaignLineId);
  }
}
