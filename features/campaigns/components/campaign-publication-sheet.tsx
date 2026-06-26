"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCampaignPublicationAction,
} from "@/features/campaigns/actions/publication-actions";
import type { FormActionState } from "@/features/campaigns/actions";
import { useRefreshCampaignAfterPublicationMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { DeliverableTypeSelect, PlatformSelect } from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
  DetailFormScrollBody,
  DetailFormSection,
  DetailSheetFooter,
  OperationalDetailSheet,
  OperationalEditPanelHeader,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import {
  getCreatorConnectedPlatformOptions,
  getDeliverableTypeCodesForPlatform,
} from "@/lib/campaigns/deliverable-taxonomy";

const PUBLICATION_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "verified", label: "Verified" },
  { value: "archived", label: "Archived" },
] as const;

type CampaignPublicationSheetProps = {
  campaignId: string;
  assignmentLines: CampaignLineWorkspace[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignPublicationSheet({
  campaignId,
  assignmentLines,
  open,
  onOpenChange,
}: CampaignPublicationSheetProps) {
  const refreshAfterPublicationMutation = useRefreshCampaignAfterPublicationMutation();
  const [lineId, setLineId] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [publicationType, setPublicationType] = useState("instagram_post");
  const [status, setStatus] = useState("draft");
  const [contentUrl, setContentUrl] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [notes, setNotes] = useState("");

  const selectedLine = assignmentLines.find((l) => l.id === lineId) ?? null;

  const platformOptions = useMemo(
    () =>
      getCreatorConnectedPlatformOptions({
        creatorPlatformAccounts: selectedLine?.creator_platform_accounts,
        assignment: selectedLine?.assignment,
      }),
    [selectedLine]
  );

  const [state, formAction, isPending] = useActionState(createCampaignPublicationAction, {
    ok: false,
  } satisfies FormActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      refreshAfterPublicationMutation();
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange, refreshAfterPublicationMutation]);

  useEffect(() => {
    if (!open) return;
    setLineId("");
    setPlatform("instagram");
    setPublicationType("instagram_post");
    setStatus("draft");
    setContentUrl("");
    setPublicationDate("");
    setCaption("");
    setHashtags("");
    setNotes("");
  }, [open]);

  useEffect(() => {
    if (!selectedLine) return;
    const firstPlatform = platformOptions[0]?.value ?? "instagram";
    setPlatform(firstPlatform);
    const types = getDeliverableTypeCodesForPlatform(firstPlatform);
    setPublicationType(types[0] ?? "other");
  }, [selectedLine, platformOptions]);

  const assignmentOptions = assignmentLines.map((a) => ({
    value: a.id,
    label: `${a.influencer_name ?? "Creator"} — ${a.name}`,
  }));

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add publication"
      description="Manual publication tracking"
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <OperationalEditPanelHeader
          title="Add publication"
          description="Track a live influencer URL manually. API auto-detection can be added later."
        />

        <DetailFormScrollBody>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="campaign_line_id" value={lineId || ""} />
          <input type="hidden" name="influencer_id" value={selectedLine?.influencer_id ?? ""} />
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="publication_type" value={publicationType} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="content_url" value={contentUrl} />
          <input type="hidden" name="publication_date" value={publicationDate} />
          <input type="hidden" name="caption" value={caption} />
          <input type="hidden" name="hashtags" value={hashtags} />
          <input type="hidden" name="notes" value={notes} />

          <DetailFormSection label="Creator / assignment">
            <SearchableSelect
              options={assignmentOptions}
              value={lineId}
              onValueChange={setLineId}
              placeholder="Select assignment…"
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.campaign_line_id} />
          </DetailFormSection>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Platform">
              <PlatformSelect
                platform={platform}
                platformOptions={platformOptions}
                disabled={isPending || !selectedLine}
                className={DETAIL_FORM_SELECT_TRIGGER_CLASS}
                onPlatformChange={(next) => {
                  setPlatform(next);
                  const types = getDeliverableTypeCodesForPlatform(next);
                  setPublicationType(types[0] ?? "other");
                }}
              />
            </DetailFormSection>
            <DetailFormSection label="Publication type">
              <DeliverableTypeSelect
                platform={platform}
                deliverableType={publicationType}
                disabled={isPending || !selectedLine}
                className={DETAIL_FORM_SELECT_TRIGGER_CLASS}
                onDeliverableTypeChange={setPublicationType}
              />
            </DetailFormSection>
          </div>

          <DetailFormSection label="Publication URL">
            <Input
              id="pub_url"
              type="url"
              className={DETAIL_FORM_INPUT_CLASS}
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="https://…"
              disabled={isPending}
            />
          </DetailFormSection>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Publication date">
              <Input
                id="pub_date"
                type="date"
                className={DETAIL_FORM_INPUT_CLASS}
                value={publicationDate}
                onChange={(e) => setPublicationDate(e.target.value)}
                disabled={isPending}
              />
            </DetailFormSection>
            <DetailFormSection label="Status">
              <Select value={status} onValueChange={setStatus} disabled={isPending}>
                <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLICATION_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailFormSection>
          </div>

          <DetailFormSection label="Caption">
            <Textarea
              id="pub_caption"
              rows={2}
              className="min-h-[4rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Hashtags">
            <Input
              id="pub_hashtags"
              className={DETAIL_FORM_INPUT_CLASS}
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#brand #campaign"
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Notes">
            <Textarea
              id="pub_notes"
              rows={2}
              className="min-h-[4rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
            />
          </DetailFormSection>
        </DetailFormScrollBody>

        <DetailSheetFooter>
          <Button size="sm" type="submit" disabled={isPending || !lineId}>
            {isPending ? "Saving…" : "Add publication"}
          </Button>
        </DetailSheetFooter>
      </form>
    </OperationalDetailSheet>
  );
}
