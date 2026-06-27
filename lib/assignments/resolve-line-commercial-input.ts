import type { CommercialDeliverableRow } from "@/lib/assignments/commercial-calculations";
import {
  commercialRowsToPlatformSelections,
  summarizeCommercialRows,
} from "@/lib/assignments/commercial-calculations";
import {
  countLineDeliverables,
  type LinePlatformSelection,
} from "@/lib/campaigns/line-assignment";
import type { AssignmentPricingMode } from "@/lib/campaigns/line-assignment";

type PlatformAccount = {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  audience_country: string | null;
};

export type ResolvedLineCommercialInput = {
  pricing_mode: AssignmentPricingMode;
  platforms: LinePlatformSelection[];
  commercial_rows: CommercialDeliverableRow[];
  revenue_before_vat: number;
  cost_before_vat: number;
  deliverable_count: number;
};

export function resolveLineCommercialInput(input: {
  pricing_mode: AssignmentPricingMode;
  assignment_json: string;
  commercial_json?: string;
  platformAccounts: PlatformAccount[];
  parseAssignmentJson: (
    raw: string
  ) =>
    | { ok: true; platforms: LinePlatformSelection[] }
    | { ok: false; message: string };
}):
  | { ok: true; value: ResolvedLineCommercialInput }
  | { ok: false; message: string } {
  const pricingMode = input.pricing_mode ?? "package";

  if (pricingMode === "per_deliverable") {
    let commercialRows: CommercialDeliverableRow[] = [];
    try {
      commercialRows = JSON.parse(input.commercial_json || "[]") as CommercialDeliverableRow[];
    } catch {
      return { ok: false, message: "Invalid deliverable commercial rows." };
    }

    if (!Array.isArray(commercialRows) || commercialRows.length === 0) {
      return { ok: false, message: "Add at least one deliverable commercial row." };
    }

    const accountLookup = new Map(
      input.platformAccounts.map((a) => [
        a.platform,
        {
          account_id: a.id,
          handle: a.handle,
          profile_url: a.profile_url,
          follower_count: a.follower_count,
          engagement_rate: a.engagement_rate,
          audience_country: a.audience_country,
        },
      ])
    );

    const platforms = commercialRowsToPlatformSelections(commercialRows, accountLookup);
    const summary = summarizeCommercialRows(commercialRows);

    return {
      ok: true,
      value: {
        pricing_mode: pricingMode,
        platforms,
        commercial_rows: commercialRows,
        revenue_before_vat: summary.total_revenue_before_vat,
        cost_before_vat: summary.total_cost_before_vat,
        deliverable_count: summary.deliverable_units,
      },
    };
  }

  const assignmentResult = input.parseAssignmentJson(input.assignment_json);
  if (!assignmentResult.ok) {
    return { ok: false, message: assignmentResult.message };
  }

  return {
    ok: true,
    value: {
      pricing_mode: "package",
      platforms: assignmentResult.platforms,
      commercial_rows: [],
      revenue_before_vat: 0,
      cost_before_vat: 0,
      deliverable_count: countLineDeliverables(assignmentResult.platforms),
    },
  };
}
