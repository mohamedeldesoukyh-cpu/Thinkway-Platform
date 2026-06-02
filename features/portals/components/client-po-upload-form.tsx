"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientUploadPoAction } from "@/features/portals/actions";

const INITIAL_STATE = { ok: false } as const;

export function ClientPoUploadForm({ campaignHeaderId }: { campaignHeaderId: string }) {
  const [state, action, pending] = useActionState(clientUploadPoAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-border p-4">
      <input type="hidden" name="campaign_header_id" value={campaignHeaderId} />
      <div className="grid gap-2">
        <Label htmlFor={`po-file-${campaignHeaderId}`}>Upload PO file</Label>
        <Input
          id={`po-file-${campaignHeaderId}`}
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`po-link-${campaignHeaderId}`}>PO link (optional)</Label>
        <Input
          id={`po-link-${campaignHeaderId}`}
          name="external_link"
          placeholder="https://..."
          disabled={pending}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading..." : "Upload PO"}
        </Button>
      </div>
    </form>
  );
}
