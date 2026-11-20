/** Reuse the group's occupied positions; never renumber options or move a line to another creator. */
export function moveQuotationService(
  lines: readonly { id: string; sort_order: number }[], fromId: string, toId: string,
): { id: string; sort_order: number }[] {
  const from = lines.findIndex(line => line.id === fromId);
  const to = lines.findIndex(line => line.id === toId);
  if (from < 0 || to < 0 || from === to) return [];
  const positions = lines.map(line => line.sort_order).sort((a, b) => a - b);
  const next = [...lines];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next.map((line, index) => ({ id: line.id, sort_order: positions[index] }));
}
