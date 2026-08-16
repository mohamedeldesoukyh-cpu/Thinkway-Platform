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

export type AddedValueCreatorRef = {
  id: string;
  name: string;
};

function addPlatform(target: Map<string, Set<string>>, lineId: string, platform: string | null | undefined) {
  const key = canonicalPlatformKey(platform);
  if (!key || key === "multi") return;
  const set = target.get(lineId) ?? new Set<string>();
  set.add(key);
  target.set(lineId, set);
}

/**
 * Creators whose Assignments have no deliverables — full added-value creators for the campaign.
 * Used for report “added value by creator” count, %, and name callouts.
 */
export async function loadAddedValueCreatorsWithoutDeliverables(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  nameByInfluencerId?: ReadonlyMap<string, string>
): Promise<{
  assignedCreatorCount: number;
  addedValueCreators: AddedValueCreatorRef[];
}> {
  try {
    const { data: lines, error: linesError } = await supabase
      .from("campaign_lines")
      .select("id, metadata")
      .eq("campaign_header_id", campaignHeaderId);

    if (linesError) {
      console.warn("[performance] added-value creators: lines query failed", {
        campaignHeaderId,
        message: linesError.message,
      });
      return { assignedCreatorCount: 0, addedValueCreators: [] };
    }

    const lineRows = (lines ?? []) as LineRow[];
    const influencerByLineId = new Map<string, string>();
    const allInfluencerIds = new Set<string>();

    for (const line of lineRows) {
      const assignment = parseLineAssignment(line.metadata);
      const influencerId = assignment?.influencer_id?.trim() || null;
      if (!influencerId) continue;
      influencerByLineId.set(line.id, influencerId);
      allInfluencerIds.add(influencerId);
    }

    const lineIds = lineRows.map((line) => line.id);
    const linesWithDeliverables = new Set<string>();

    if (lineIds.length > 0) {
      const { data: deliverables, error: deliverablesError } = await supabase
        .from("assignment_deliverables")
        .select("campaign_line_id, platform")
        .in("campaign_line_id", lineIds);

      if (deliverablesError) {
        console.warn("[performance] added-value creators: deliverables query failed", {
          campaignHeaderId,
          message: deliverablesError.message,
        });
        return {
          assignedCreatorCount: allInfluencerIds.size,
          addedValueCreators: [],
        };
      }

      for (const row of (deliverables ?? []) as DeliverableRow[]) {
        if (!row.campaign_line_id) continue;
        const platform = canonicalPlatformKey(row.platform);
        if (!platform || platform === "multi") continue;
        linesWithDeliverables.add(row.campaign_line_id);
      }
    }

    /** Influencer is added-value only if every one of their lines has zero deliverables. */
    const influencerHasDeliverable = new Map<string, boolean>();
    for (const [lineId, influencerId] of influencerByLineId) {
      const has = linesWithDeliverables.has(lineId);
      influencerHasDeliverable.set(
        influencerId,
        (influencerHasDeliverable.get(influencerId) ?? false) || has
      );
    }

    const addedIds = [...allInfluencerIds].filter(
      (id) => !(influencerHasDeliverable.get(id) ?? false)
    );

    const missingNameIds = addedIds.filter((id) => !nameByInfluencerId?.get(id)?.trim());
    const nameFromDb = new Map<string, string>();
    if (missingNameIds.length > 0) {
      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, display_name")
        .in("id", missingNameIds);
      for (const row of influencers ?? []) {
        const typed = row as { id: string; display_name?: string | null };
        const label = typed.display_name?.trim();
        if (label) nameFromDb.set(typed.id, label);
      }
    }

    const addedValueCreators = addedIds
      .map((id) => ({
        id,
        name:
          nameByInfluencerId?.get(id)?.trim() ||
          nameFromDb.get(id) ||
          "Unknown creator",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    return {
      assignedCreatorCount: allInfluencerIds.size,
      addedValueCreators,
    };
  } catch (error) {
    console.warn("[performance] added-value creators: load failed", {
      campaignHeaderId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { assignedCreatorCount: 0, addedValueCreators: [] };
  }
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
