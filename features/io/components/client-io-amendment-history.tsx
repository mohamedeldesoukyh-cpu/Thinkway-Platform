"use client";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";


import { CollapsibleWorkspaceSection } from "@/components/workspace/collapsible-workspace-section";
import { ClientIoCreateAmendment } from "./client-io-create-amendment";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import {
  formatClientIoAmendmentLabel,
  isClientIoAmendmentAllowed,
} from "@/lib/io/client-io-amendment";
import type { ClientIoRow, ClientIoVersionSummary } from "@/features/io/types";

type Props = {
  tip: ClientIoRow;
  versions: ClientIoVersionSummary[];
};

export function ClientIoAmendmentHistory({ tip, versions }: Props) {
  const canAmend = isClientIoAmendmentAllowed(tip.status, tip.is_superseded);
  const ordered = [...versions].sort((a, b) => a.revision_number - b.revision_number);

  return (
    <CollapsibleWorkspaceSection
      title="Version history"
      summary={`${ordered.length} version${ordered.length === 1 ? "" : "s"} · append-only amendments`}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Client IO versions are append-only. Creating an amendment freezes the current tip and
          opens a new document number with an <span className="font-mono">/A1</span> suffix.
        </p>

        <ul className="divide-y divide-border/60 rounded-md border border-border/70">
          {ordered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              {formatDocumentNumberForDisplay(tip.document_number ?? "Current tip")} ·{" "}
              {formatClientIoAmendmentLabel(tip.revision_number)}
              {!tip.is_superseded ? " (current)" : null}
            </li>
          ) : (
            ordered.map((version) => {
              const current = version.id === tip.id && !version.is_superseded;
              return (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {formatDocumentNumberForDisplay(version.document_number ?? "—")}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatClientIoAmendmentLabel(version.revision_number)}
                        {current ? " · current" : version.is_superseded ? " · superseded" : null}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Created {new Date(version.created_at).toLocaleString()}
                      {version.approved_at
                        ? ` · Approved ${new Date(version.approved_at).toLocaleDateString()}`
                        : null}
                    </p>
                  </div>
                  <IoStatusBadge status={version.status} />
                </li>
              );
            })
          )}
        </ul>

        {canAmend ? (
          <ClientIoCreateAmendment clientIoId={tip.id} campaignHeaderId={tip.campaign_header_id} />
        ) : tip.is_superseded ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            This version is superseded and immutable. Open the current tip to amend.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Amendments become available after the Client IO is sent (or approved).
          </p>
        )}
      </div>
    </CollapsibleWorkspaceSection>
  );
}
