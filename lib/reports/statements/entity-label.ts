export function formatGroupClientLabel(
  groupName: string | null | undefined,
  clientName: string | null | undefined
): string | null {
  const group = groupName?.trim();
  const client = clientName?.trim();
  if (group && client) return `${group} — ${client}`;
  return client ?? group ?? null;
}

export function formatEntityScopeLine(
  code: string | null | undefined,
  groupName: string | null | undefined,
  entityName: string | null | undefined
): string {
  const label = formatGroupClientLabel(groupName, entityName) ?? entityName?.trim() ?? "Not selected";
  const trimmedCode = code?.trim();
  if (trimmedCode) return `${trimmedCode} — ${label}`;
  return label;
}
