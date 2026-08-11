"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleWorkspaceSection } from "@/components/workspace/collapsible-workspace-section";
import { DETAIL_FORM_INPUT_CLASS } from "@/features/campaigns/components/operational-detail-panel";
import { createClientIoAmendmentAction } from "@/features/io/actions";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import {
  formatClientIoAmendmentLabel,
  isClientIoAmendmentAllowed,
} from "@/lib/io/client-io-amendment";
import type { ClientIoRow, ClientIoVersionSummary } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  tip: ClientIoRow;
  versions: ClientIoVersionSummary[];
};

export function ClientIoAmendmentHistory({ tip, versions }: Props) {
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(
    createClientIoAmendmentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setReason("");
    } else {
      toast.error(state.message);
    }
  }, [state]);

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
              {tip.document_number ?? "Current tip"} ·{" "}
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
                      {version.document_number ?? "—"}
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
          <form action={action} className="space-y-2 rounded-md border border-border/70 p-3">
            <input type="hidden" name="id" value={tip.id} />
            <input type="hidden" name="campaign_header_id" value={tip.campaign_header_id} />
            <p className="text-xs font-medium text-foreground">Create amendment</p>
            <p className="text-[11px] text-muted-foreground">
              Freezes {tip.document_number ?? "this tip"} and creates the next{" "}
              <span className="font-mono">/A{Math.max(1, tip.revision_number + 1)}</span> tip.
            </p>
            <Input
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (optional)"
              className={DETAIL_FORM_INPUT_CLASS}
              disabled={pending}
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "Creating…" : "Create amendment"}
            </Button>
          </form>
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
