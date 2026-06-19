"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { duplicateCampaignAction } from "@/features/campaigns/actions";
import type { CampaignWorkspace } from "@/features/campaigns/types";

type DuplicateCampaignDialogProps = {
  workspace: CampaignWorkspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DuplicateCampaignDialog({
  workspace,
  open,
  onOpenChange,
}: DuplicateCampaignDialogProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(duplicateCampaignAction, {
    ok: false,
  });

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      if (state.campaignId) {
        router.push(`/campaigns/${state.campaignId}`);
      }
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange, router]);

  const defaultStart =
    workspace.start_date ?? new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyIcon className="size-5" />
            Duplicate campaign
          </DialogTitle>
          <DialogDescription>
            Copy structure and commercial amounts from{" "}
            {formatDocumentNumberForDisplay(workspace.document_number)}. New campaign and line
            numbers will be generated. Billing history, invoices, and audit logs are excluded.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="source_campaign_id" value={workspace.id} />

          <div className="grid gap-2">
            <Label htmlFor="dup_name">New campaign name *</Label>
            <Input
              id="dup_name"
              name="name"
              defaultValue={`${workspace.name} (Copy)`}
              required
              disabled={pending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dup_start">Campaign month / start date *</Label>
              <Input
                id="dup_start"
                name="start_date"
                type="date"
                defaultValue={defaultStart}
                required
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dup_live">Live date</Label>
              <Input
                id="dup_live"
                name="live_date"
                type="date"
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dup_budget">Budget month</Label>
              <Input id="dup_budget" name="budget_month" placeholder="2026-06" disabled={pending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dup_po">PO number</Label>
              <Input id="dup_po" name="po_number" disabled={pending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dup_client_bo">Client BO number</Label>
              <Input id="dup_client_bo" name="client_bo_number" disabled={pending} />
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border p-3">
            <p className="text-sm font-medium">Include in copy</p>
            {[
              ["copy_influencers", "Creator assignments", true],
              ["copy_deliverables", "Deliverables", true],
              ["copy_pricing", "Pricing", true],
              ["copy_notes", "Notes", true],
              ["copy_workflow", "Workflow settings", true],
            ].map(([name, label, defaultChecked]) => (
              <label key={name as string} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name as string}
                  defaultChecked={defaultChecked as boolean}
                  className="size-4 rounded border"
                />
                {label as string}
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Duplicating…" : "Duplicate campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
