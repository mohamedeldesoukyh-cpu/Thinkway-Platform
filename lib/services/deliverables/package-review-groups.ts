/** Content review groups only. Never changes publication or financial records. */
export type ReviewGroup = { reviewGroupKey?: string; reviewGroupLabel?: string };
type Unit = { key: string; lineId: string; type: string; label: string; quantity: number; sequence: number | null; package: boolean };
function priority(type: string) {
  if (/mirror|boost|usage|exclusiv/i.test(type)) return 4;
  if (/reel|video/i.test(type)) return 0;
  if (/post|carousel/i.test(type)) return 1;
  if (/story/i.test(type)) return 2;
  return 3;
}
export function packageReviewGroups(units: Unit[]): Map<string, ReviewGroup> {
  const result = new Map<string, ReviewGroup>();
  const lines = new Map<string, Unit[]>();
  for (const unit of units) if (unit.package) lines.set(unit.lineId, [...(lines.get(unit.lineId) ?? []), unit]);
  for (const [lineId, members] of lines) {
    const types = [...new Map(members.map(unit => [unit.type, unit])).values()];
    if (types.length < 2) continue;
    const primary = [...types].sort((a,b) => priority(a.type)-priority(b.type))[0];
    const count = Math.max(1, primary.quantity);
    const label = types.map(unit => `${Math.max(1, Math.ceil(unit.quantity / count))}× ${unit.label.replace(/ \(#\d+\)$/, '')}`).join(' + ');
    for (const unit of members) {
      // Multiple stories/ancillary services belong to the matching original package.
      const sequence = Math.min(count, Math.max(1, Math.ceil((unit.sequence ?? 1) / Math.max(1, unit.quantity / count))));
      result.set(unit.key, { reviewGroupKey: `package:${lineId}:${sequence}`, reviewGroupLabel: `Package${count > 1 ? ` ${sequence}` : ''} · ${label}` });
    }
  }
  return result;
}
