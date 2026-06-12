import type { SupabaseClient } from "@supabase/supabase-js";

type DeliverableLineRef = {
  campaign_line_id?: string;
  campaign_line?: { id: string } | null;
};

/**
 * Parent assignment lines that should participate in IO / eligibility checks.
 * Ignores raw request line_ids when granular deliverable/post rows are selected
 * (prevents stale assignment ids from bulk queue selection).
 */
export async function resolveScopedInvoiceLineIds(
  supabase: SupabaseClient,
  input: {
    requestedLineIds: string[];
    resolvedDeliverableIds: string[];
    resolvedPostIds: string[];
    deliverables: DeliverableLineRef[];
  }
): Promise<string[]> {
  const lineIds = new Set<string>();

  for (const row of input.deliverables) {
    const lineId = row.campaign_line?.id ?? row.campaign_line_id;
    if (lineId) lineIds.add(lineId);
  }

  if (input.resolvedPostIds.length > 0) {
    const { data: posts, error } = await supabase
      .from("assignment_post_schedule")
      .select("campaign_line_id")
      .in("id", input.resolvedPostIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const post of posts ?? []) {
      const lineId = (post as { campaign_line_id: string | null }).campaign_line_id;
      if (lineId) lineIds.add(lineId);
    }
  }

  for (const lineId of input.requestedLineIds) {
    lineIds.add(lineId);
  }

  return [...lineIds];
}
