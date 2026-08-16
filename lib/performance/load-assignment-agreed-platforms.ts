import type { SupabaseClient } from "@supabase/supabase-js";

import { parseLineAssignment } from "@/lib/campaigns/line-assignment";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  addAgreedPlatform,
  createEmptyAssignmentAgreedPlatformIndex,
  type AssignmentAgreedPlatformIndex,
} from "@/lib/performance/publication-value-scope";

type LineRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type DeliverableRow = {
  campaign_line_id: string;
  platform: string | null;
};

function addPlatform(target: Map<string, Set<string>>, lineId: string, platform: string | null | undefined) {
  const key = canonicalPlatformKey(platform);
  if (!key || key === "multi") return;
  const set = target.get(lineId) ?? new Set<string>();
  set.add(key);
  target.set(lineId, set);
}

/**
 * Live assignment platform index for a campaign.
 * `assignment_deliverables` is the Assignments-grid SSOT when the query succeeds:
 * removing all deliverables for a creator clears their agreed platforms (Added value).
 * Metadata platforms are only used if the deliverables query fails.
 */
export async function loadAssignmentAgreedPlatformIndex(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<AssignmentAgreedPlatformIndex> {
  const index = createEmptyAssignmentAgreedPlatformIndex();

  try {
    const { data: lines, error: linesError } = await supabase
      .from("campaign_lines")
      .select("id, metadata")
      .eq("campaign_header_id", campaignHeaderId);

    if (linesError) {
      console.warn("[performance] assignment platforms: lines query failed", {
        campaignHeaderId,
        message: linesError.message,
      });
      return index;
    }

    const lineRows = (lines ?? []) as LineRow[];
    const influencerByLineId = new Map<string, string>();
    const metadataPlatformsByLine = new Map<string, Set<string>>();

    for (const line of lineRows) {
      const assignment = parseLineAssignment(line.metadata);
      const influencerId = assignment?.influencer_id ?? null;
      if (influencerId) influencerByLineId.set(line.id, influencerId);

      for (const platform of assignment?.platforms ?? []) {
        if ((platform.deliverables?.length ?? 0) === 0) continue;
        addPlatform(metadataPlatformsByLine, line.id, platform.platform);
      }
      // commercial_rows are pricing only — never treat them as agreed scope.
    }

    const lineIds = lineRows.map((line) => line.id);
    const deliverablePlatformsByLine = new Map<string, Set<string>>();
    let deliverablesQueryOk = false;

    if (lineIds.length > 0) {
      const { data: deliverables, error: deliverablesError } = await supabase
        .from("assignment_deliverables")
        .select("campaign_line_id, platform")
        .in("campaign_line_id", lineIds);

      if (deliverablesError) {
        console.warn("[performance] assignment platforms: deliverables query failed", {
          campaignHeaderId,
          message: deliverablesError.message,
        });
      } else {
        deliverablesQueryOk = true;
        for (const row of (deliverables ?? []) as DeliverableRow[]) {
          addPlatform(deliverablePlatformsByLine, row.campaign_line_id, row.platform);
        }
      }
    }

    for (const line of lineRows) {
      // assignment_deliverables is SSOT when the query succeeds: empty rows for a
      // line mean no agreed platforms (do not fall back to stale metadata after deletes).
      // Metadata is only used when the deliverables query fails (legacy / outage).
      const platforms = deliverablesQueryOk
        ? (deliverablePlatformsByLine.get(line.id) ?? new Set<string>())
        : (metadataPlatformsByLine.get(line.id) ?? new Set<string>());
      const influencerId = influencerByLineId.get(line.id) ?? null;

      for (const platform of platforms) {
        addAgreedPlatform(index, {
          campaignLineId: line.id,
          influencerId,
          platform,
        });
      }
    }

    return index;
  } catch (error) {
    console.warn("[performance] assignment platforms: load failed", {
      campaignHeaderId,
      message: error instanceof Error ? error.message : String(error),
    });
    return index;
  }
}
