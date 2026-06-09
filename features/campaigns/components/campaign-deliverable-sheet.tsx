"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDeliverableAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import { DELIVERABLE_TYPE_OPTIONS, PLATFORM_OPTIONS } from "@/features/campaigns/constants";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormScrollBody,
  DetailFormSection,
  DetailSheetFooter,
  OperationalDetailSheet,
  OperationalEditPanelHeader,
} from "@/features/campaigns/components/operational-detail-panel";
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
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add deliverable"
      description="Attach content to an assignment line"
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <OperationalEditPanelHeader
          title="Add deliverable"
          description="Attach content to an existing creator assignment line."
        />

        <DetailFormScrollBody>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="influencer_id" value={influencerId} />
          <input type="hidden" name="campaign_influencer_id" value={assignmentId} />
          <input type="hidden" name="deliverable_type" value={deliverableType} />
          <input type="hidden" name="platform" value={platform} />

          <DetailFormSection label="Creator assignment">
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
          </DetailFormSection>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Type">
              <SearchableSelect
                value={deliverableType}
                onValueChange={setDeliverableType}
                options={DELIVERABLE_TYPE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                disabled={isPending}
              />
            </DetailFormSection>
            <DetailFormSection label="Platform">
              <SearchableSelect
                value={platform}
                onValueChange={setPlatform}
                options={PLATFORM_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                disabled={isPending}
              />
            </DetailFormSection>
          </div>

          <DetailFormSection label="Title">
            <Input
              id="deliverable_title"
              name="title"
              className={DETAIL_FORM_INPUT_CLASS}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.title} />
          </DetailFormSection>

          <DetailFormSection label="Due date">
            <Input
              id="due_date"
              name="due_date"
              type="date"
              className={DETAIL_FORM_INPUT_CLASS}
              disabled={isPending}
            />
          </DetailFormSection>
        </DetailFormScrollBody>

        <DetailSheetFooter>
          <Button size="sm" type="submit" disabled={isPending || !influencerId}>
            {isPending ? "Creating…" : "Add deliverable"}
          </Button>
        </DetailSheetFooter>
      </form>
    </OperationalDetailSheet>
  );
}
