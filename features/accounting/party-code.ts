/** Accounting presentation only: retain the shared identifier in storage. */
export function partyCode(value: string | null | undefined): string {
  return (value ?? '').replace(/^(?:CLT|CLI|INF|VND|VEN)-(?=\d+(?:$| · ))/i, '').replace(/^0+(?=\d)/, '');
}
