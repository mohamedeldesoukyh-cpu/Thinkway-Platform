import type { SupabaseClient } from "@supabase/supabase-js";
import { isClientIoAssignmentSnapshotV1 } from "@/lib/io/client-io-assignment-snapshot";

type ClientAcceptance = { campaign_header_id: string; status: string; is_superseded?: boolean; assignment_snapshot?: unknown };
/** Current client acceptance is sufficient for advance billing; vendor paperwork is independent. */
export function clientIoCoversLine(io: ClientAcceptance | undefined, lineId: string): boolean {
  if (!io || io.is_superseded || io.status !== "approved") return false;
  if (isClientIoAssignmentSnapshotV1(io.assignment_snapshot)) {
    return io.assignment_snapshot.selectedCampaignLineIds.includes(lineId);
  }
  // Older accepted IOs predate assignment snapshots and cover their campaign.
  return io.assignment_snapshot == null;
}

export async function loadClientAcceptedLineIds(db: SupabaseClient, lines: Array<{ id: string; campaign_header_id: string }>): Promise<Set<string>> {
  if (!lines.length) return new Set();
  const { data, error } = await db.from("client_ios")
    .select("campaign_header_id, status, is_superseded, assignment_snapshot, revision_number")
    .in("campaign_header_id", [...new Set(lines.map(line => line.campaign_header_id))])
    .eq("is_superseded", false).order("revision_number", { ascending: false });
  if (error) throw new Error(error.message);
  const current = new Map<string, ClientAcceptance>();
  for (const io of (data ?? []) as ClientAcceptance[]) {
    if (!current.has(io.campaign_header_id)) current.set(io.campaign_header_id, io);
  }
  return new Set(lines.filter(line => clientIoCoversLine(current.get(line.campaign_header_id), line.id)).map(line => line.id));
}
