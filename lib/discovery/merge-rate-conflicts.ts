export type MergeRateRow = {
  id: string; influencer_id: string; version_id: string; platform: string;
  deliverable: string; price_type: string; package_key: string | null;
  amount: number; currency: string; notes: string;
  [key: string]: unknown;
};
export type MergeRateConflict = {
  target: MergeRateRow; source: MergeRateRow; title: string;
};

export function findMergeRateConflicts(rows: MergeRateRow[], targetId: string, sourceId: string): MergeRateConflict[] {
  const key = (row: MergeRateRow) => JSON.stringify([row.version_id, row.platform, row.deliverable, row.price_type, row.package_key ?? ""]);
  const targets = new Map(rows.filter(row => row.influencer_id === targetId).map(row => [key(row), row]));
  return rows.filter(row => row.influencer_id === sourceId).flatMap(source => {
    const target = targets.get(key(source));
    return target ? [{ target, source, title: "Rate card" }] : [];
  });
}
