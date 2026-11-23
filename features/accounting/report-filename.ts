import { safeDownloadBasename } from '@/lib/documents/download-filename';

export function accountingDownloadName(type: string, identity: string, date: string) {
  const title = type === 'Profit & Loss' ? 'P&L' : type;
  return safeDownloadBasename([[title, identity].filter(Boolean).join(' - ').slice(0, 165), date].filter(Boolean).join(' - '));
}
export function reportFilename(report: { title: string; caption: string; downloadName?: string }) {
  if (report.downloadName) return safeDownloadBasename(report.downloadName);
  const dates = report.caption.match(/\d{4}-\d{2}-\d{2}/g);
  const date = dates?.at(-1) ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return accountingDownloadName(report.title, '', date);
}
