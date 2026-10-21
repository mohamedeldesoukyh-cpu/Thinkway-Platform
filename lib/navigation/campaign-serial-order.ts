/** Campaign navigation follows document serials, independently of list sorting. */
export function sortCampaignsBySerial<T extends { id: string; document_number: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = a.document_number?.trim();
    const right = b.document_number?.trim();
    if (!left || !right) return left ? -1 : right ? 1 : a.id.localeCompare(b.id);
    return left.localeCompare(right, "en", { numeric: true }) || a.id.localeCompare(b.id);
  });
}
