"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createCampaignPublicationAction,
} from "@/features/campaigns/actions/publication-actions";
import type { FormActionState } from "@/features/campaigns/actions";
import { DeliverableTypeSelect, PlatformSelect } from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
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
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add publication</SheetTitle>
          <SheetDescription>
            Track a live influencer URL manually. API auto-detection can be added later.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="mt-6 space-y-4">
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

          <div className="grid gap-2">
            <Label>Creator / assignment</Label>
            <SearchableSelect
              options={assignmentOptions}
              value={lineId}
              onValueChange={setLineId}
              placeholder="Select assignment…"
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.campaign_line_id} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Platform</Label>
              <PlatformSelect
                platform={platform}
                platformOptions={platformOptions}
                disabled={isPending || !selectedLine}
                className="h-8 w-full max-w-none"
                onPlatformChange={(next) => {
                  setPlatform(next);
                  const types = getDeliverableTypeCodesForPlatform(next);
                  setPublicationType(types[0] ?? "other");
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Publication type</Label>
              <DeliverableTypeSelect
                platform={platform}
                deliverableType={publicationType}
                disabled={isPending || !selectedLine}
                className="h-8 w-full max-w-none min-w-0"
                onDeliverableTypeChange={setPublicationType}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pub_url">Publication URL</Label>
            <Input
              id="pub_url"
              type="url"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="https://…"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pub_date">Publication date</Label>
              <Input
                id="pub_date"
                type="date"
                value={publicationDate}
                onChange={(e) => setPublicationDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={isPending}>
                <SelectTrigger className="h-8">
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
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pub_caption">Caption</Label>
            <Textarea
              id="pub_caption"
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pub_hashtags">Hashtags</Label>
            <Input
              id="pub_hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#brand #campaign"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pub_notes">Notes</Label>
            <Textarea
              id="pub_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={isPending || !lineId}>
              {isPending ? "Saving…" : "Add publication"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
