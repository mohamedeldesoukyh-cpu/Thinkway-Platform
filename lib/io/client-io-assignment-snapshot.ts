export type ClientIoAssignmentSnapshotLine = {
  id: string;
  document_number: string | null;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  revenue_before_vat: number | null;
  revenue: number | null;
  usage_rights_amount: number | null;
  agency_fee_amount: number | null;
  agency_fee_percent: number | null;
  revenue_vat_percent: number | null;
  revenue_vat_exempt: boolean | null;
  currency_code: string;
  sort_order: number | null;
};

export type ClientIoAssignmentSnapshotDeliverable = {
  platform: string;
  deliverable_type: string;
  quantity: number;
  live_date: string | null;
  campaign_line_id: string;
  sort_order: number | null;
};

export type ClientIoAssignmentSnapshotV1 = {
  version: 1;
  capturedAt: string;
  selectedCampaignLineIds: string[];
  lines: ClientIoAssignmentSnapshotLine[];
  deliverables: ClientIoAssignmentSnapshotDeliverable[];
};

export function isClientIoAssignmentSnapshotV1(
  value: unknown
): value is ClientIoAssignmentSnapshotV1 {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === 1 &&
    typeof row.capturedAt === "string" &&
    Array.isArray(row.selectedCampaignLineIds) &&
    Array.isArray(row.lines) &&
    Array.isArray(row.deliverables)
  );
}

export function buildClientIoAssignmentSnapshot(input: {
  capturedAt?: string;
  selectedCampaignLineIds: string[];
  lines: ClientIoAssignmentSnapshotLine[];
  deliverables: ClientIoAssignmentSnapshotDeliverable[];
}): ClientIoAssignmentSnapshotV1 {
  const selected = [...new Set(input.selectedCampaignLineIds)];
  const selectedSet = new Set(selected);
  return {
    version: 1,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    selectedCampaignLineIds: selected,
    lines: input.lines.filter((line) => selectedSet.has(line.id)),
    deliverables: input.deliverables.filter((row) =>
      selectedSet.has(row.campaign_line_id)
    ),
  };
}

/** Pure helper for tests + generate gate. */
export function filterLinesBySelectedIds<T extends { id: string }>(
  lines: T[],
  selectedIds: string[]
): T[] {
  if (selectedIds.length === 0) return [];
  const selected = new Set(selectedIds);
  return lines.filter((line) => selected.has(line.id));
}
