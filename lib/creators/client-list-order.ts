/** Shared presentation order for client reports and the client workspace. */
export function compareClientListCreators(
  a: { tier?: string; followers?: number },
  b: { tier?: string; followers?: number },
): number {
  const ranks: Record<string, number> = { Celebrity: 0, Mega: 0, Macro: 1, Mid: 2, Micro: 3, Nano: 4 };
  return (ranks[a.tier ?? ""] ?? 5) - (ranks[b.tier ?? ""] ?? 5)
    || (b.followers ?? 0) - (a.followers ?? 0);
}
