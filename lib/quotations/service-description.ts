/** The creator row description is authoritative; legacy rows may only have child descriptions. */
export function quotationServiceDescription(item: {
  service_description?: string | null;
  deliverables?: Array<{ service_description?: string | null }> | null;
}): string | undefined {
  const description = item.service_description?.trim();
  if (description) return description;
  const children = (item.deliverables ?? [])
    .map(line => line.service_description?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(children)].join(' · ') || undefined;
}
