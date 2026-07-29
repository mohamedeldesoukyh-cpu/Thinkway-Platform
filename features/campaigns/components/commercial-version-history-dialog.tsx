"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  approveCommercialRevisionAction,
  listCommercialRevisionsAction,
  rejectCommercialRevisionAction,
} from "@/features/campaigns/actions/commercial-revision-actions";
import type {
  CommercialRevisionRecord,
  CommercialVersionHistoryEntry,
} from "@/lib/services/commercial/commercial-revision-types";

type CommercialVersionHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignHeaderId: string;
};

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function statusVariant(
  status: CommercialRevisionRecord["status"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "applied":
    case "approved":
      return "default";
    case "pending_approval":
      return "secondary";
    case "rejected":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function CommercialVersionHistoryDialog({
  open,
  onOpenChange,
  campaignHeaderId,
}: CommercialVersionHistoryDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState<CommercialRevisionRecord[]>([]);
  const [versions, setVersions] = useState<CommercialVersionHistoryEntry[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void listCommercialRevisionsAction({ campaignHeaderId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRevisions(result.data.revisions);
      setVersions(result.data.versions);
    });
    return () => {
      cancelled = true;
    };
  }, [open, campaignHeaderId]);

  function refresh() {
    startTransition(async () => {
      const result = await listCommercialRevisionsAction({ campaignHeaderId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRevisions(result.data.revisions);
      setVersions(result.data.versions);
      router.refresh();
    });
  }

  function decide(revisionId: string, decision: "approve" | "reject") {
    startTransition(async () => {
      const decisionNotes = notes[revisionId] ?? null;
      const result =
        decision === "approve"
          ? await approveCommercialRevisionAction({
              revisionId,
              decisionNotes,
            })
          : await rejectCommercialRevisionAction({
              revisionId,
              decisionNotes,
            });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Decision recorded");
      refresh();
    });
  }

  const pendingRevisions = revisions.filter(
    (revision) => revision.status === "pending_approval"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Commercial version history</DialogTitle>
          <DialogDescription>
            Append-only commercial versions. After Finance Lock, only approved
            Commercial Revisions may change Master values.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-6">
            {pendingRevisions.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Pending approval</h3>
                {pendingRevisions.map((revision) => (
                  <div
                    key={revision.id}
                    className="space-y-3 rounded-md border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        Revision R{revision.revisionNumber}
                      </span>
                      <Badge variant={statusVariant(revision.status)}>
                        {revision.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p>
                      <span className="text-muted-foreground">Reason:</span>{" "}
                      {revision.reason}
                    </p>
                    {revision.comments ? (
                      <p>
                        <span className="text-muted-foreground">Comments:</span>{" "}
                        {revision.comments}
                      </p>
                    ) : null}
                    <ul className="space-y-1">
                      {revision.lines.flatMap((line) =>
                        (line.fieldChanges ?? []).map((change, index) => (
                          <li
                            key={`${line.commercialLineId}-${change.field}-${index}`}
                          >
                            {change.label}: {formatValue(change.oldValue)} →{" "}
                            {formatValue(change.newValue)}
                          </li>
                        ))
                      )}
                    </ul>
                    <Textarea
                      placeholder="Decision notes (optional)"
                      value={notes[revision.id] ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({
                          ...prev,
                          [revision.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      disabled={pending}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => decide(revision.id, "approve")}
                        disabled={pending}
                      >
                        Approve & apply
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => decide(revision.id, "reject")}
                        disabled={pending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-medium">Versions</h3>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No commercial versions recorded yet.
                </p>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.snapshotId}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        Version {version.versionNumber}
                      </span>
                      {version.revisionNumber != null ? (
                        <Badge variant="outline">
                          Revision R{version.revisionNumber}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {new Date(version.date).toLocaleString()}
                      {version.reason ? ` · ${version.reason}` : ""}
                    </p>
                    {version.fieldChangeSummary.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {version.fieldChangeSummary.map((change, index) => (
                          <li key={`${version.snapshotId}-${change.field}-${index}`}>
                            {change.label}: {formatValue(change.oldValue)} →{" "}
                            {formatValue(change.newValue)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
