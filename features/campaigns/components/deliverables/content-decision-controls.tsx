"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideDeliverableContentAction } from "@/features/campaigns/actions/deliverable-documentation-actions";
import type { DeliverableAssetVersionView } from "@/lib/services/deliverables/documentation-types";

export function ContentDecisionControls({ campaignHeaderId, version, onSaved }: {
  campaignHeaderId: string; version: DeliverableAssetVersionView; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(version.contentDecision);
  const decision = saved ?? version.contentDecision;
  if (!version.releasedToClientAt) return null;
  function decide(value: "approved" | "changes_requested") {
    startTransition(async () => {
      try {
        const result = await decideDeliverableContentAction({ campaignHeaderId, versionId: version.id, decision: value, comment });
        if (!result.ok) { toast.error(result.message); return; }
        setSaved({ decision: value, decidedAt: result.decidedAt ?? "", actorKind: "internal", comment });
        toast.success(result.message);
        onSaved();
      } catch { toast.error("Could not save the decision. Please try again."); }
    });
  }
  return <section className="mt-3 space-y-2 rounded-md border p-3" aria-label="Content approval">
    <p className="text-sm font-medium">{decision?.decision === "approved" ? "Approved content" : decision?.decision === "changes_requested" ? "Changes requested" : "Awaiting content approval"}</p>
    {decision?.decidedAt ? <p className="text-xs text-muted-foreground">{new Date(decision.decidedAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo", timeZoneName: "short" })} · {decision.actorKind === "internal" ? "Thinkway team" : "Client"}</p> : null}
    {decision?.comment ? <p className="whitespace-pre-wrap text-xs">{decision.comment}</p> : null}
    <Textarea aria-label="Content decision notes" placeholder="Notes (optional)" value={comment} onChange={e => setComment(e.target.value)} disabled={pending} rows={2} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={pending || decision?.decision === "approved"} onClick={() => decide("approved")}>{pending ? "Saving…" : "Approve content"}</Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => decide("changes_requested")}>Request changes</Button>
    </div>
    <p className="text-xs text-muted-foreground">Shared with the client portal. Team decisions are recorded as Thinkway team.</p>
  </section>;
}
