import { formatDocumentNumberForDisplay } from '@/lib/documents/format-document-number';

export type MediaRecordKind = 'campaigns' | 'quotations' | 'shortlists';
export type MediaRecord = { id: string; number: string; client: string; name: string };

export function filterMediaRecords(rows: MediaRecord[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    const text = `${row.number} ${formatDocumentNumberForDisplay(row.number)} ${row.client} ${row.name}`.toLocaleLowerCase();
    const serial = row.number.match(/^(?:TW|QT|SL)-\d{2,4}-(\d+)/i)?.[1];
    return terms.every(term => /^\d+$/.test(term) && serial
      ? Number(serial) === Number(term)
      : text.includes(term));
  });
}
