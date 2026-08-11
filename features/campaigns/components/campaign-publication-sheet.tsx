"use client";

import { CalendarIcon, HashIcon, Link2Icon, StickyNoteIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState, type FormEvent } from "react";
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
  OperationalDetailCommandBar,
  OperationalDetailFooter,
  OperationalDetailScrollBody,
  OperationalDetailSection,
  OperationalDetailSheet,
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

function resolvePlatformAndType(
  url: string,
  fallbackPlatform: string,
  fallbackType: string
): { platform: string; publicationType: string } {
  const detected = detectSocialPlatformFromContentUrl(url);
  const platform = detected ?? fallbackPlatform;
  const inferred = inferDeliverableTypeFromContentUrl(url);
  const types = getDeliverableTypeCodesForPlatform(platform);
  const publicationType =
    inferred && types.includes(inferred)
      ? inferred
      : coerceDeliverableTypeForPlatform(platform, fallbackType, url);
  return { platform, publicationType };
}

function deriveRowFromUrl(
  url: string,
  lines: CampaignLineWorkspace[],
  previous: PublicationRow
): PublicationRow {
  const { platform, publicationType } = resolvePlatformAndType(
    url,
    previous.platform,
    previous.publicationType
  );

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

function buildBatchItems(
  rows: PublicationRow[],
  assignmentLines: CampaignLineWorkspace[],
  shared: {
    publicationDate: string;
    status: string;
    caption: string;
    hashtags: string;
    notes: string;
  }
) {
  return rows
    .filter((r) => r.contentUrl.trim() && r.lineId)
    .map((row) => {
      const line = assignmentLines.find((l) => l.id === row.lineId);
      const url = row.contentUrl.trim();
      // Always prefer host detection so a stale IG row cannot poison TikTok/Facebook submits.
      const { platform, publicationType } = resolvePlatformAndType(
        url,
        row.platform,
        row.publicationType
      );
      return {
        campaign_line_id: row.lineId,
        influencer_id: line?.influencer_id ?? "",
        assignee_id: "",
        platform,
        publication_type: publicationType,
        content_url: url,
        publication_date: shared.publicationDate,
        status: shared.status,
        caption: shared.caption,
        hashtags: shared.hashtags,
        notes: shared.notes,
      };
    });
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

  const rowUrlSignature = rows.map((row) => `${row.key}:${row.contentUrl}`).join("|");

  // Keep platform/type aligned with URL hosts even if a select remount resets local state.
  useEffect(() => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.contentUrl.trim()) return row;
        const resolved = resolvePlatformAndType(
          row.contentUrl,
          row.platform,
          row.publicationType
        );
        if (
          resolved.platform === row.platform &&
          resolved.publicationType === row.publicationType
        ) {
          return row;
        }
        changed = true;
        return { ...row, ...resolved };
      });
      return changed ? next : prev;
    });
  }, [rowUrlSignature]);

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
      // URL platform always wins over the creator's first connected account.
      const resolved = resolvePlatformAndType(
        row.contentUrl,
        connected[0]?.value ?? row.platform,
        row.publicationType
      );
      return {
        ...row,
        lineId,
        autoMatched: false,
        platform: resolved.platform,
        publicationType: resolved.publicationType,
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = buildBatchItems(rows, assignmentLines, {
      publicationDate,
      status,
      caption,
      hashtags,
      notes,
    });
    if (items.length === 0) {
      toast.error("Add at least one URL with a selected creator.");
      return;
    }

    // Sync visible row platform/type before submit so the UI matches what we send.
    setRows((prev) =>
      prev.map((row) => {
        if (!row.contentUrl.trim()) return row;
        return { ...row, ...resolvePlatformAndType(row.contentUrl, row.platform, row.publicationType) };
      })
    );

    const formData = new FormData();
    formData.set("campaign_id", campaignId);
    formData.set("items", JSON.stringify(items));
    formAction(formData);
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

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add publications"
      description="Paste one or many live URLs"
      variant="detail"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <OperationalDetailCommandBar
          contextLabel="Publications"
          contextHandle={readyCount > 0 ? `${readyCount} ready` : "New"}
          title="Add publications"
          subtitle="Paste URLs — creators auto-assign when the handle matches. Override any row."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="creator-detail-sheet-action-btn"
              disabled={isPending}
              onClick={() => setRows((prev) => [...prev, newRow()])}
            >
              <PlusIcon aria-hidden />
              Add URL
            </Button>
          }
        />

        <OperationalDetailScrollBody>
          <OperationalDetailSection icon={<Link2Icon className="size-3.5" />} title="Publication URLs">
            <div className="flex flex-col gap-2">
              {rows.map((row, index) => {
                const extracted = extractHandleFromContentUrl(row.contentUrl);
                const needsCreator = Boolean(row.contentUrl.trim()) && !row.lineId;
                const resolved = resolvePlatformAndType(
                  row.contentUrl,
                  row.platform,
                  row.publicationType
                );
                const displayPlatform = resolved.platform;
                const displayType = resolved.publicationType;
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "rounded-[12px] border border-[#eaedf4] bg-white p-3 transition-colors",
                      row.contentUrl.trim() && "border-[rgba(0,87,255,0.22)] bg-[rgba(0,87,255,0.03)]"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 flex w-8 shrink-0 flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-[#94a3b8]">{index + 1}</span>
                        {row.contentUrl.trim() ? (
                          <PlatformBadge platform={displayPlatform} />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          type="url"
                          className={cn(DETAIL_FORM_INPUT_CLASS, "bg-white")}
                          value={row.contentUrl}
                          onChange={(e) => onRowUrlChange(row.key, e.target.value)}
                          onBlur={(e) => onRowUrlChange(row.key, e.target.value)}
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
                              <p className="mt-1 text-[10px] text-[#64748b]">
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
                            key={`${row.key}-platform-${displayPlatform}`}
                            platform={displayPlatform}
                            platformOptions={platformOptionsForRow({
                              ...row,
                              platform: displayPlatform,
                            })}
                            disabled={isPending}
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
                            key={`${row.key}-type-${displayPlatform}-${displayType}`}
                            platform={displayPlatform}
                            deliverableType={displayType}
                            disabled={isPending}
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
                        className="mt-0.5 size-8 shrink-0 text-[#94a3b8] hover:text-[#dc2626]"
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
          </OperationalDetailSection>

          <OperationalDetailSection icon={<CalendarIcon className="size-3.5" />} title="Schedule">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Publication date
                </p>
                <Input
                  type="date"
                  className={cn(DETAIL_FORM_INPUT_CLASS, "bg-white")}
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Status
                </p>
                <Select value={status} onValueChange={setStatus} disabled={isPending}>
                  <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "bg-white")}>
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
          </OperationalDetailSection>

          <OperationalDetailSection icon={<StickyNoteIcon className="size-3.5" />} title="Caption">
            <Textarea
              rows={2}
              className="min-h-[4rem] resize-y border-[#eaedf4] bg-white text-sm shadow-none focus-visible:ring-1"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isPending}
              placeholder="Optional — applied to all rows"
            />
          </OperationalDetailSection>

          <OperationalDetailSection icon={<HashIcon className="size-3.5" />} title="Hashtags & notes">
            <div className="space-y-3">
              <Input
                className={cn(DETAIL_FORM_INPUT_CLASS, "bg-white")}
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#brand #campaign"
                disabled={isPending}
              />
              <Textarea
                rows={2}
                className="min-h-[4rem] resize-y border-[#eaedf4] bg-white text-sm shadow-none focus-visible:ring-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
              />
            </div>
          </OperationalDetailSection>

          <FieldError messages={state.fieldErrors?.items} />
        </OperationalDetailScrollBody>

        <OperationalDetailFooter>
          <Button
            type="submit"
            size="sm"
            className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary"
            disabled={isPending || readyCount === 0}
          >
            {isPending
              ? "Saving…"
              : readyCount <= 1
                ? "Add publication"
                : `Add ${readyCount} publications`}
          </Button>
        </OperationalDetailFooter>
      </form>
    </OperationalDetailSheet>
  );
}
