import { ExternalLink } from 'lucide-react';

export function VendorIoLink({ id, number }: { id?: string; number: string }) {
  if (!id) return <span>{number || '—'}</span>;
  return <a className="cp-vendor-io-link" href={`/ios/vendor/${encodeURIComponent(id)}/preview`} target="_blank" rel="noopener noreferrer" aria-label={`View Vendor IO ${number} (opens in a new tab)`}>
    {number || 'View Vendor IO'}<ExternalLink size={13} aria-hidden="true"/>
  </a>;
}
