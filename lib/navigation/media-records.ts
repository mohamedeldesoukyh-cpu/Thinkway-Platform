import { formatDocumentNumberForDisplay } from '@/lib/documents/format-document-number';
import { campaignDetailPath, quotationDetailPath, shortlistDetailPath } from '@/lib/routing/entity-paths';

export type MediaRecordKind = 'campaigns' | 'quotations' | 'shortlists';
export type MediaRecord = { id: string; number: string; client: string; name: string };

/** Campaign summaries derive their canonical slug from the name. Avoid an ID redirect. */
export function mediaRecordHref(kind: MediaRecordKind, row: MediaRecord, activeTab?: string) {
  const path = kind === 'campaigns'
    ? campaignDetailPath({id:row.id, name:row.name, document_number:row.number})
    : kind === 'quotations' ? quotationDetailPath(row.id) : shortlistDetailPath(row.id);
  return kind === 'campaigns' && activeTab ? `${path}?tab=${encodeURIComponent(activeTab)}` : path;
}

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
