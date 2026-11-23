export function postingDocumentNumber(value: string, type: string) {
  if (type === 'supplier_invoice') return value;
  return value.replace(/^(INV|CCN|VCN|CDN|VDN)-(\d{4})-0+(\d+)$/, '$1-$2-$3');
}

export function postingDocumentDate(value: string) {
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' }).format(date);
}
