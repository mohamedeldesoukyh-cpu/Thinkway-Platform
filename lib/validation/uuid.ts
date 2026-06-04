const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  return UUID_RE.test(value.trim());
}

export function filterUuids(values: Iterable<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (isUuid(value)) out.push(value.trim());
  }
  return [...new Set(out)];
}
