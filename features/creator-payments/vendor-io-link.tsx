import { DocumentWindowLink } from "@/components/navigation/document-window-link";
import { ExternalLink } from 'lucide-react';

export function VendorIoLink({ id, number }: { id?: string; number: string }) {
  if (!id) return <span>{number || '—'}</span>;
  return <DocumentWindowLink className="cp-vendor-io-link" href={`/ios/vendor/${encodeURIComponent(id)}/preview`} target="_blank" rel="noopener noreferrer" aria-label={`View Vendor IO ${number}`}>
    {number || 'View Vendor IO'}<ExternalLink size={13} aria-hidden="true"/>
  </DocumentWindowLink>;
}
