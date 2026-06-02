"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { creatorUploadDeliverableAction } from "@/features/portals/actions";

const INITIAL_STATE = { ok: false } as const;

export function CreatorDeliverableUploadForm({ deliverableId }: { deliverableId: string }) {
  const [state, action, pending] = useActionState(creatorUploadDeliverableAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-border p-4">
      <input type="hidden" name="deliverable_id" value={deliverableId} />
      <div className="grid gap-2">
        <Label htmlFor={`deliverable-file-${deliverableId}`}>Upload deliverable file</Label>
        <Input
          id={`deliverable-file-${deliverableId}`}
          name="file"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf,.mp4,.mov"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`deliverable-link-${deliverableId}`}>External link (optional)</Label>
        <Input
          id={`deliverable-link-${deliverableId}`}
          name="external_link"
          placeholder="https://..."
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`deliverable-notes-${deliverableId}`}>Notes</Label>
        <Textarea
          id={`deliverable-notes-${deliverableId}`}
          name="notes"
          placeholder="Revision or upload notes"
          disabled={pending}
          rows={3}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit deliverable"}
        </Button>
      </div>
    </form>
  );
}
