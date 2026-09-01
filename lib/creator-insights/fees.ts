import type { SupabaseClient } from "@supabase/supabase-js";

export type CreatorAssignmentFeeShare = {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  contractedSlots: number;
  agreedFee: number | null;
  currency: string | null;
};

export type CreatorAssignmentFeeFacts = {
  shares: CreatorAssignmentFeeShare[];
  stamp: string | null;
};

export function allocateCreatorPostFee(
  agreedFee: number | null,
  contractedSlots: number
): number | null {
  if (agreedFee == null || !Number.isFinite(agreedFee) || agreedFee <= 0) return null;
  const slots = Math.max(1, Math.floor(contractedSlots) || 1);
  return agreedFee / slots;
}

export function feeFactsStamp(shares: readonly CreatorAssignmentFeeShare[]): string | null {
  if (shares.length === 0) return null;
  return shares
    .map(
      (row) =>
        `${row.assignmentDeliverableId}:${row.agreedFee ?? ""}:${row.contractedSlots}:${row.currency ?? ""}`
    )
    .sort()
    .join(",");
}

export async function loadCreatorAssignmentFeeFacts(
  supabase: SupabaseClient,
  influencerId: string
): Promise<CreatorAssignmentFeeFacts> {
  const assignments = await supabase
    .from("campaign_influencers")
    .select("id, campaign_header_id, campaign_line_id, agreed_fee, currency")
    .eq("influencer_id", influencerId);

  const assignmentRows = (assignments.data ?? []) as Array<{
    id: string;
    campaign_header_id: string | null;
    campaign_line_id: string | null;
    agreed_fee: number | string | null;
    currency: string | null;
  }>;

  const headerIds = [
    ...new Set(assignmentRows.map((row) => row.campaign_header_id).filter(Boolean)),
  ] as string[];
  const lineIds = [
    ...new Set(assignmentRows.map((row) => row.campaign_line_id).filter(Boolean)),
  ] as string[];

  const deliverables =
    headerIds.length === 0
      ? { data: [] }
      : await supabase
          .from("assignment_deliverables")
          .select("id, campaign_header_id, campaign_line_id, quantity")
          .in("campaign_header_id", headerIds);

  const deliverableRows = (deliverables.data ?? []) as Array<{
    id: string;
    campaign_header_id: string | null;
    campaign_line_id: string | null;
    quantity: number | string | null;
  }>;

  const lineKey = (headerId: string | null, lineId: string | null) =>
    `${headerId ?? ""}:${lineId ?? ""}`;

  const feeByLine = new Map<
    string,
    { agreedFee: number | null; currency: string | null; campaignHeaderId: string }
  >();
  for (const row of assignmentRows) {
    if (!row.campaign_header_id) continue;
    const agreed = row.agreed_fee == null ? null : Number(row.agreed_fee);
    feeByLine.set(lineKey(row.campaign_header_id, row.campaign_line_id), {
      agreedFee: agreed != null && Number.isFinite(agreed) ? agreed : null,
      currency: row.currency,
      campaignHeaderId: row.campaign_header_id,
    });
  }

  const slotsByLine = new Map<string, number>();
  for (const row of deliverableRows) {
    const key = lineKey(row.campaign_header_id, row.campaign_line_id);
    if (!feeByLine.has(key)) continue;
    if (lineIds.length > 0 && row.campaign_line_id && !lineIds.includes(row.campaign_line_id)) {
      continue;
    }
    const qty = Math.max(1, Math.floor(Number(row.quantity ?? 1)) || 1);
    slotsByLine.set(key, (slotsByLine.get(key) ?? 0) + qty);
  }

  const shares: CreatorAssignmentFeeShare[] = [];
  for (const row of deliverableRows) {
    const key = lineKey(row.campaign_header_id, row.campaign_line_id);
    const fee = feeByLine.get(key);
    if (!fee || !row.id) continue;
    shares.push({
      campaignHeaderId: fee.campaignHeaderId,
      assignmentDeliverableId: row.id,
      contractedSlots: slotsByLine.get(key) ?? Math.max(1, Math.floor(Number(row.quantity ?? 1)) || 1),
      agreedFee: fee.agreedFee,
      currency: fee.currency,
    });
  }

  return { shares, stamp: feeFactsStamp(shares) };
}
