"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createDeliverableAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import { DELIVERABLE_TYPE_OPTIONS, PLATFORM_OPTIONS } from "@/features/campaigns/constants";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";

type CampaignDeliverableSheetProps = {
  campaignId: string;
  assignments: CampaignLineWorkspace[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignDeliverableSheet({
  campaignId,
  assignments,
  open,
  onOpenChange,
}: CampaignDeliverableSheetProps) {
  const [lineId, setLineId] = useState("");
  const [influencerId, setInfluencerId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [deliverableType, setDeliverableType] = useState("instagram_post");
  const [platform, setPlatform] = useState("");

  const [state, formAction, isPending] = useActionState(createDeliverableAction, {
    ok: false,
  } satisfies FormActionState);

  const linkedAssignments = assignments.filter(
    (a) => a.influencer_id && a.campaign_influencer_id
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setLineId("");
    setInfluencerId("");
    setAssignmentId("");
    setDeliverableType("instagram_post");
    setPlatform("");
  }, [open]);

  const assignmentOptions = linkedAssignments.map((a) => ({
    value: a.id,
    label: `${a.influencer_name} — ${a.name}`,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add deliverable</SheetTitle>
          <SheetDescription>
            Attach content to an existing creator assignment line.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="influencer_id" value={influencerId} />
          <input type="hidden" name="campaign_influencer_id" value={assignmentId} />
          <input type="hidden" name="deliverable_type" value={deliverableType} />
          <input type="hidden" name="platform" value={platform} />

          <div className="grid gap-2">
            <Label>Creator assignment</Label>
            <SearchableSelect
              value={lineId}
              onValueChange={(v) => {
                setLineId(v);
                const match = linkedAssignments.find((a) => a.id === v);
                setInfluencerId(match?.influencer_id ?? "");
                setAssignmentId(match?.campaign_influencer_id ?? "");
              }}
              options={assignmentOptions}
              placeholder="Select assignment line"
              disabled={isPending || linkedAssignments.length === 0}
            />
            <FieldError messages={state.fieldErrors?.influencer_id} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <SearchableSelect
                value={deliverableType}
                onValueChange={setDeliverableType}
                options={DELIVERABLE_TYPE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Platform</Label>
              <SearchableSelect
                value={platform}
                onValueChange={setPlatform}
                options={PLATFORM_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deliverable_title">Title</Label>
            <Input id="deliverable_title" name="title" required disabled={isPending} />
            <FieldError messages={state.fieldErrors?.title} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" name="due_date" type="date" disabled={isPending} />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending || !influencerId}>
              {isPending ? "Creating…" : "Add deliverable"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
