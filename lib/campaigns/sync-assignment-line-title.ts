import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildAssignmentDisplayName,
  sanitizeAssignmentCreatorName,
} from "@/lib/campaigns/assignment-line-naming";
import { parseLineAssignment } from "@/lib/campaigns/line-assignment";

/** Recomputes campaign line display name from deliverables when not user-edited. */
export async function syncAssignmentLineTitleFromDeliverables(
  supabase: SupabaseClient,
  lineId: string
): Promise<void> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select("id, name, metadata")
    .eq("id", lineId)
    .maybeSingle();

  if (lineError || !line) return;

  const assignment = parseLineAssignment(line.metadata as Record<string, unknown>);
  if (assignment?.title_user_edited) return;

  const influencerName = sanitizeAssignmentCreatorName(
    assignment?.influencer_name ?? line.name.split(" — ")[0] ?? line.name
  );

  const { data: deliverableRows } = await supabase
    .from("assignment_deliverables")
    .select("id, platform, deliverable_type, quantity")
    .eq("campaign_line_id", lineId)
    .order("sort_order");

  if (!deliverableRows || deliverableRows.length === 0) return;

  const deliverableIds = deliverableRows.map((d) => d.id);
  const { data: postRows } = await supabase
    .from("assignment_post_schedule")
    .select("assignment_deliverable_id")
    .in("assignment_deliverable_id", deliverableIds);

  const postsByDeliverable = new Map<string, number>();
  for (const row of postRows ?? []) {
    postsByDeliverable.set(
      row.assignment_deliverable_id,
      (postsByDeliverable.get(row.assignment_deliverable_id) ?? 0) + 1
    );
  }

  const namingInputs = deliverableRows.map((d) => ({
    platform: d.platform,
    deliverable_type: d.deliverable_type,
    posts_count: postsByDeliverable.get(d.id) ?? (Number(d.quantity) || 1),
  }));

  const nextName = buildAssignmentDisplayName(influencerName, namingInputs);
  if (nextName === line.name) return;

  await supabase.from("campaign_lines").update({ name: nextName }).eq("id", lineId);
}
