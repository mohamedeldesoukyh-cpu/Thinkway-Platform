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
  if (!key) return;
  const set = target.get(lineId) ?? new Set<string>();
  set.add(key);
  target.set(lineId, set);
}

/**
 * Live assignment platform index for a campaign.
 * Prefers assignment_deliverables (the Assignments grid) when the line has rows,
 * otherwise falls back to line metadata platforms. Adding or removing a platform
 * in Assignments therefore reclassifies publications on the next Performance load.
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
        addPlatform(metadataPlatformsByLine, line.id, platform.platform);
      }
      for (const row of assignment?.commercial_rows ?? []) {
        addPlatform(metadataPlatformsByLine, line.id, row.platform);
      }
    }

    const lineIds = lineRows.map((line) => line.id);
    const deliverablePlatformsByLine = new Map<string, Set<string>>();

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
        for (const row of (deliverables ?? []) as DeliverableRow[]) {
          addPlatform(deliverablePlatformsByLine, row.campaign_line_id, row.platform);
        }
      }
    }

    for (const line of lineRows) {
      const deliverablePlatforms = deliverablePlatformsByLine.get(line.id);
      const platforms =
        deliverablePlatforms && deliverablePlatforms.size > 0
          ? deliverablePlatforms
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
