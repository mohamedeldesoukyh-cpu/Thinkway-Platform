"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
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
import { createCampaignPublicationsBatchAction } from "@/features/campaigns/actions/publication-actions";
import type { FormActionState } from "@/features/campaigns/actions";
import { useRefreshCampaignAfterPublicationMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import {
  DeliverableTypeSelect,
  PlatformBadge,
  PlatformSelect,
} from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
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
import { matchAssignmentLineFromContentUrl } from "@/lib/campaigns/match-assignment-from-content-url";
import {
  coerceDeliverableTypeForPlatform,
  getCreatorConnectedPlatformOptions,
  getDeliverableTypeCodesForPlatform,
  inferDeliverableTypeFromContentUrl,
} from "@/lib/campaigns/deliverable-taxonomy";
import { SOCIAL_PLATFORM_OPTIONS } from "@/lib/master-data/constants";
import { extractHandleFromContentUrl } from "@/lib/social/extract-handle-from-content-url";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";
import { pickCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

function resolveAssignmentHandle(line: CampaignLineWorkspace): string | null {
  const fromAccounts = line.creator_platform_accounts
    ?.map((account) => account.handle?.trim().replace(/^@+/, ""))
    .find((handle) => Boolean(handle));
  if (fromAccounts) return fromAccounts;

  const fromAssignment = line.assignment?.platforms
    ?.map((platform) => platform.handle?.trim().replace(/^@+/, ""))
    .find((handle) => Boolean(handle));
  if (fromAssignment) return fromAssignment;

  const embedded = line.influencer_name?.match(/@([a-zA-Z0-9._]+)/)?.[1];
  return embedded?.trim() || null;
}

function buildPublicationAssignmentOption(line: CampaignLineWorkspace) {
  const handle = resolveAssignmentHandle(line);
  const creatorName = pickCreatorDisplayName(
    [line.influencer_name, line.assignment?.influencer_name, handle],
    handle
  );
  const handleLabel = handle ? `@${handle}` : null;
  const lineLabel = line.name?.trim() || null;
  const descriptionParts = [
    handleLabel,
    lineLabel && lineLabel !== creatorName ? lineLabel : null,
  ].filter(Boolean);

  return {
    value: line.id,
    label: creatorName,
    description: descriptionParts.length > 0 ? descriptionParts.join(" · ") : undefined,
    keywords: [creatorName, handle, handleLabel, lineLabel, line.document_number].filter(
      (value): value is string => Boolean(value)
    ),
  };
}

const PUBLICATION_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "verified", label: "Verified" },
  { value: "archived", label: "Archived" },
] as const;

type PublicationRow = {
  key: string;
  contentUrl: string;
  lineId: string;
  platform: string;
  publicationType: string;
  /** Creator was set by URL auto-match (user can still override). */
  autoMatched: boolean;
};

function newRow(partial?: Partial<PublicationRow>): PublicationRow {
  return {
    key: crypto.randomUUID(),
    contentUrl: "",
    lineId: "",
    platform: "instagram",
    publicationType: "instagram_post",
    autoMatched: false,
    ...partial,
  };
}

function splitPastedUrls(raw: string): string[] {
  return raw
    .split(/[\n\r\t,;]+|\s{2,}/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part) || /\w+\.\w+\//.test(part));
}

function deriveRowFromUrl(
  url: string,
  lines: CampaignLineWorkspace[],
  previous: PublicationRow
): PublicationRow {
  const detected = detectSocialPlatformFromContentUrl(url);
  const platform = detected ?? previous.platform;
  const inferred = inferDeliverableTypeFromContentUrl(url);
  const types = getDeliverableTypeCodesForPlatform(platform);
  const publicationType =
    inferred && types.includes(inferred)
      ? inferred
      : coerceDeliverableTypeForPlatform(platform, previous.publicationType, url);

  const matched = matchAssignmentLineFromContentUrl(url, lines);
  const shouldApplyMatch =
    Boolean(matched) && (!previous.lineId || previous.autoMatched);

  return {
    ...previous,
    contentUrl: url,
    platform,
    publicationType,
    lineId: shouldApplyMatch ? matched!.id : previous.lineId,
    autoMatched: shouldApplyMatch ? true : previous.lineId ? previous.autoMatched : false,
  };
}

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
  const itemsFieldId = useId();
  const [rows, setRows] = useState<PublicationRow[]>([newRow()]);
  const [status, setStatus] = useState("published");
  const [publicationDate, setPublicationDate] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [notes, setNotes] = useState("");

  const assignmentOptions = useMemo(
    () => assignmentLines.map(buildPublicationAssignmentOption),
    [assignmentLines]
  );

  const [state, formAction, isPending] = useActionState(
    createCampaignPublicationsBatchAction,
    { ok: false } satisfies FormActionState
  );

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
    setRows([newRow()]);
    setStatus("published");
    setPublicationDate("");
    setCaption("");
    setHashtags("");
    setNotes("");
  }, [open]);

  function updateRow(key: string, updater: (row: PublicationRow) => PublicationRow) {
    setRows((prev) => prev.map((row) => (row.key === key ? updater(row) : row)));
  }

  function onRowUrlChange(key: string, nextUrl: string) {
    const pasted = splitPastedUrls(nextUrl);
    if (pasted.length > 1) {
      setRows((prev) => {
        const index = prev.findIndex((r) => r.key === key);
        if (index < 0) return prev;
        const base = prev[index]!;
        const derived = pasted.map((url, i) =>
          deriveRowFromUrl(url, assignmentLines, i === 0 ? { ...base, contentUrl: url } : newRow())
        );
        return [...prev.slice(0, index), ...derived, ...prev.slice(index + 1)];
      });
      return;
    }

    updateRow(key, (row) => deriveRowFromUrl(nextUrl, assignmentLines, row));
  }

  function onRowCreatorChange(key: string, lineId: string) {
    updateRow(key, (row) => {
      const line = assignmentLines.find((l) => l.id === lineId) ?? null;
      const connected = getCreatorConnectedPlatformOptions({
        creatorPlatformAccounts: line?.creator_platform_accounts,
        assignment: line?.assignment,
      });
      const urlPlatform = detectSocialPlatformFromContentUrl(row.contentUrl);
      const nextPlatform = urlPlatform ?? connected[0]?.value ?? row.platform;
      const types = getDeliverableTypeCodesForPlatform(nextPlatform);
      const nextType = types.includes(row.publicationType)
        ? row.publicationType
        : (types[0] ?? "other");
      return {
        ...row,
        lineId,
        autoMatched: false,
        platform: nextPlatform,
        publicationType: coerceDeliverableTypeForPlatform(
          nextPlatform,
          nextType,
          row.contentUrl
        ),
      };
    });
  }

  function platformOptionsForRow(row: PublicationRow) {
    const line = assignmentLines.find((l) => l.id === row.lineId) ?? null;
    const connected = getCreatorConnectedPlatformOptions({
      creatorPlatformAccounts: line?.creator_platform_accounts,
      assignment: line?.assignment,
    });
    const seen = new Set(connected.map((o) => o.value));
    const rest = SOCIAL_PLATFORM_OPTIONS.filter((o) => !seen.has(o.value)).map((o) => ({
      value: o.value,
      label: o.label,
    }));
    return [...connected, ...rest];
  }

  const readyCount = rows.filter((r) => r.contentUrl.trim() && r.lineId).length;
  const itemsPayload = rows
    .filter((r) => r.contentUrl.trim())
    .map((row) => {
      const line = assignmentLines.find((l) => l.id === row.lineId);
      return {
        campaign_line_id: row.lineId,
        influencer_id: line?.influencer_id ?? "",
        platform: row.platform,
        publication_type: row.publicationType,
        content_url: row.contentUrl.trim(),
        publication_date: publicationDate,
        status,
        caption,
        hashtags,
        notes,
      };
    });

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add publications"
      description="Paste one or many live URLs"
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <OperationalEditPanelHeader
          title="Add publications"
          description="Paste URLs — creators auto-assign when the handle matches. Override any row."
        />

        <DetailFormScrollBody>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input
            id={itemsFieldId}
            type="hidden"
            name="items"
            value={JSON.stringify(itemsPayload)}
          />

          <div className="overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-sidebar-accent-foreground">
                  Publication URLs
                </p>
                <p className="text-xs text-sidebar-foreground/60">
                  One row per URL · creator beside each link
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 rounded-2xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                disabled={isPending}
                onClick={() => setRows((prev) => [...prev, newRow()])}
              >
                <PlusIcon className="size-3.5" />
                Add URL
              </Button>
            </div>

            <div className="flex flex-col gap-1 p-3">
              {rows.map((row, index) => {
                const extracted = extractHandleFromContentUrl(row.contentUrl);
                const needsCreator = Boolean(row.contentUrl.trim()) && !row.lineId;
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "flex flex-col gap-2 rounded-3xl px-3 py-2.5 transition-colors",
                      row.contentUrl.trim()
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 flex w-8 shrink-0 flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-sidebar-foreground/50">
                          {index + 1}
                        </span>
                        {row.contentUrl.trim() ? (
                          <PlatformBadge platform={row.platform} />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          type="url"
                          className={cn(
                            DETAIL_FORM_INPUT_CLASS,
                            "border-sidebar-border/80 bg-background/80"
                          )}
                          value={row.contentUrl}
                          onChange={(e) => onRowUrlChange(row.key, e.target.value)}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            const urls = splitPastedUrls(text);
                            if (urls.length > 1) {
                              e.preventDefault();
                              onRowUrlChange(row.key, urls.join("\n"));
                            }
                          }}
                          placeholder="https://… (paste several to split)"
                          disabled={isPending}
                        />

                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <div className="min-w-0">
                            <SearchableSelect
                              options={assignmentOptions}
                              value={row.lineId}
                              onValueChange={(value) => onRowCreatorChange(row.key, value)}
                              placeholder={
                                needsCreator
                                  ? extracted
                                    ? `Match @${extracted.handle}…`
                                    : "Select creator…"
                                  : "Select creator…"
                              }
                              disabled={isPending}
                            />
                            {row.autoMatched ? (
                              <p className="mt-1 text-[10px] text-sidebar-foreground/55">
                                Auto-assigned from URL
                                {extracted ? ` · @${extracted.handle}` : ""}
                              </p>
                            ) : needsCreator ? (
                              <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                                Choose the creator for this URL
                              </p>
                            ) : null}
                          </div>

                          <PlatformSelect
                            platform={row.platform}
                            platformOptions={platformOptionsForRow(row)}
                            disabled={isPending}
                            className={DETAIL_FORM_SELECT_TRIGGER_CLASS}
                            onPlatformChange={(next) =>
                              updateRow(row.key, (current) => {
                                const types = getDeliverableTypeCodesForPlatform(next);
                                return {
                                  ...current,
                                  platform: next,
                                  publicationType: types.includes(current.publicationType)
                                    ? current.publicationType
                                    : (types[0] ?? "other"),
                                };
                              })
                            }
                          />

                          <DeliverableTypeSelect
                            platform={row.platform}
                            deliverableType={row.publicationType}
                            disabled={isPending}
                            className={DETAIL_FORM_SELECT_TRIGGER_CLASS}
                            onDeliverableTypeChange={(next) =>
                              updateRow(row.key, (current) => ({
                                ...current,
                                publicationType: next,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="mt-0.5 size-8 shrink-0 rounded-2xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        disabled={isPending || rows.length <= 1}
                        onClick={() =>
                          setRows((prev) =>
                            prev.length <= 1 ? prev : prev.filter((r) => r.key !== row.key)
                          )
                        }
                        aria-label="Remove URL"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Publication date">
              <Input
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

          <DetailFormSection label="Caption (optional, all rows)">
            <Textarea
              rows={2}
              className="min-h-[4rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Hashtags">
            <Input
              className={DETAIL_FORM_INPUT_CLASS}
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#brand #campaign"
              disabled={isPending}
            />
          </DetailFormSection>

          <DetailFormSection label="Notes">
            <Textarea
              rows={2}
              className="min-h-[4rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
            />
          </DetailFormSection>

          <FieldError messages={state.fieldErrors?.items} />
        </DetailFormScrollBody>

        <DetailSheetFooter>
          <Button size="sm" type="submit" disabled={isPending || readyCount === 0}>
            {isPending
              ? "Saving…"
              : readyCount <= 1
                ? "Add publication"
                : `Add ${readyCount} publications`}
          </Button>
        </DetailSheetFooter>
      </form>
    </OperationalDetailSheet>
  );
}
