"use client";

import { CalendarIcon, ImageIcon, StickyNoteIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  beginDeliverableFileUploadAction,
  completeDeliverableFileUploadAction,
} from "@/features/campaigns/actions/deliverable-documentation-actions";
import {
  listCampaignStoryPostsAction,
  markStoriesLiveAction,
  persistStoryScreenshotAction,
} from "@/features/campaigns/actions/mark-stories-live-actions";
import {
  DETAIL_FORM_INPUT_CLASS,
  OperationalDetailCommandBar,
  OperationalDetailFooter,
  OperationalDetailScrollBody,
  OperationalDetailSection,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import { putDeliverableAssetToSignedUrl } from "@/features/campaigns/deliverable-asset-upload";
import { useRefreshCampaignAfterPublicationMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { defaultStoryWentLiveDate, todayYmd, type CampaignStoryPostCandidate } from "@/lib/campaigns/mark-stories-live-policy";
import { resolveAssignmentCreatorHandle } from "@/lib/campaigns/resolve-assignment-creator-label";
import { inferDeliverableAssetMime } from "@/lib/services/deliverables/documentation-types";
import { pickCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

const STORY_SCREENSHOT_MAX_BYTES = 15 * 1024 * 1024;

function buildCreatorOption(line: CampaignLineWorkspace) {
  const handle = resolveAssignmentCreatorHandle(line);
  const creatorName = pickCreatorDisplayName(
    [line.influencer_name, line.assignment?.influencer_name, handle],
    handle
  );
  const handleLabel = handle ? `@${handle}` : null;
  const lineLabel = line.name?.trim() || null;
  return {
    value: line.id,
    label: creatorName,
    description: [handleLabel, lineLabel && lineLabel !== creatorName ? lineLabel : null]
      .filter(Boolean)
      .join(" · ") || undefined,
    keywords: [creatorName, handle, handleLabel, lineLabel, line.document_number].filter(
      (value): value is string => Boolean(value)
    ),
  };
}

type StoryDraft = {
  selected: boolean;
  wentLiveDate: string;
  contentUrl: string;
  file: File | null;
};

function emptyDraft(post: CampaignStoryPostCandidate): StoryDraft {
  return {
    selected: false,
    wentLiveDate: defaultStoryWentLiveDate(post.liveDate),
    contentUrl: "",
    file: null,
  };
}

async function uploadStoryScreenshot(input: {
  campaignId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string;
  publicationId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.file.size > STORY_SCREENSHOT_MAX_BYTES) {
    return { ok: false, message: "Screenshots must be 15 MB or smaller." };
  }
  const mimeType = inferDeliverableAssetMime(input.file.type, input.file.name);
  if (!mimeType.startsWith("image/")) {
    return { ok: false, message: "Use a PNG, JPG, or WebP screenshot." };
  }
  const begun = await beginDeliverableFileUploadAction({
    campaignHeaderId: input.campaignId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType: "story_screenshot",
    label: input.file.name,
    fileName: input.file.name,
    mimeType,
    fileSize: input.file.size,
  });
  if (!begun.ok) return begun;
  const uploaded = await putDeliverableAssetToSignedUrl({
    signedUrl: begun.data.signedUrl,
    token: begun.data.token,
    file: input.file,
    mimeType,
    bucket: begun.data.bucket,
    storagePath: begun.data.storagePath,
  });
  if (!uploaded.ok) return { ok: false, message: uploaded.message };
  const completed = await completeDeliverableFileUploadAction({
    campaignHeaderId: input.campaignId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType: "story_screenshot",
    fileName: input.file.name,
    mimeType,
    fileSize: input.file.size,
    assetId: begun.data.assetId,
    versionId: begun.data.versionId,
    versionNumber: begun.data.versionNumber,
    storagePath: begun.data.storagePath,
  });
  if (!completed.ok) return completed;
  const linked = await persistStoryScreenshotAction({
    campaignId: input.campaignId,
    publicationId: input.publicationId,
    bucket: begun.data.bucket,
    storagePath: begun.data.storagePath,
    fileName: input.file.name,
    mimeType,
  });
  if (!linked.ok) {
    console.warn("[mark-stories-live] publication screenshot copy skipped", linked.message);
  }
  return { ok: true };
}

type CampaignMarkStoriesLiveSheetProps = {
  campaignId: string;
  assignmentLines: CampaignLineWorkspace[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignMarkStoriesLiveSheet({
  campaignId,
  assignmentLines,
  open,
  onOpenChange,
}: CampaignMarkStoriesLiveSheetProps) {
  const refreshAfterPublicationMutation = useRefreshCampaignAfterPublicationMutation();
  const [lineId, setLineId] = useState("");
  const [notes, setNotes] = useState("");
  const [bulkDate, setBulkDate] = useState(todayYmd());
  const [posts, setPosts] = useState<CampaignStoryPostCandidate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StoryDraft>>({});
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const assignmentOptions = useMemo(
    () => assignmentLines.map(buildCreatorOption),
    [assignmentLines]
  );

  useEffect(() => {
    if (!open) return;
    setLineId("");
    setNotes("");
    setBulkDate(todayYmd());
    setPosts([]);
    setDrafts({});
    setLoading(false);
    setIsPending(false);
    setLoadError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !lineId) {
      setPosts([]);
      setDrafts({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void listCampaignStoryPostsAction({ campaignId, campaignLineId: lineId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        setPosts([]);
        setDrafts({});
        return;
      }
      setPosts(result.posts);
      setDrafts(
        Object.fromEntries(result.posts.map((post) => [post.id, emptyDraft(post)]))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, lineId, open]);

  const selectedCount = posts.filter((post) => drafts[post.id]?.selected && !post.alreadyLive).length;
  const screenshotCount = posts.filter((post) => drafts[post.id]?.file).length;
  const readyCount = selectedCount + posts.filter((post) => post.alreadyLive && drafts[post.id]?.file).length;

  function updateDraft(id: string, patch: Partial<StoryDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyDraft(posts.find((post) => post.id === id)!)), ...patch },
    }));
  }

  function applyBulkDate(next: string) {
    setBulkDate(next);
    setDrafts((prev) => {
      const copy = { ...prev };
      for (const post of posts) {
        if (post.alreadyLive) continue;
        const current = copy[post.id];
        if (!current?.selected) continue;
        copy[post.id] = { ...current, wentLiveDate: next };
      }
      return copy;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const toMark = posts.filter((post) => drafts[post.id]?.selected && !post.alreadyLive);
    const screenshotRows = posts.filter((post) => drafts[post.id]?.file);
    if (toMark.length === 0 && screenshotRows.length === 0) return;

    setIsPending(true);
    try {
      const needPublication = screenshotRows.filter((post) => !post.publicationId);
      const markItems = [...toMark, ...needPublication].filter(
        (post, index, all) => all.findIndex((row) => row.id === post.id) === index
      );

      let markResult: Awaited<ReturnType<typeof markStoriesLiveAction>> | null = null;
      if (markItems.length > 0) {
        markResult = await markStoriesLiveAction({
          campaignId,
          items: markItems.map((post) => ({
            assignmentPostScheduleId: post.id,
            wentLiveDate: drafts[post.id]?.wentLiveDate || defaultStoryWentLiveDate(post.liveDate),
            contentUrl: drafts[post.id]?.contentUrl || null,
            notes: notes.trim() || null,
          })),
        });
        if (!markResult.ok) {
          toast.error(markResult.message);
          return;
        }
      }

      const publicationByPost = new Map(
        (markResult?.ok ? markResult.results : []).map((row) => [
          row.assignmentPostScheduleId,
          row,
        ])
      );
      let screenshotFailures = 0;
      for (const post of screenshotRows) {
        const file = drafts[post.id]?.file;
        const publicationId = publicationByPost.get(post.id)?.publicationId ?? post.publicationId;
        if (!file || !publicationId) {
          if (file) screenshotFailures += 1;
          continue;
        }
        const uploaded = await uploadStoryScreenshot({
          campaignId,
          assignmentDeliverableId: post.assignmentDeliverableId,
          assignmentPostScheduleId: post.id,
          publicationId,
          file,
        });
        if (!uploaded.ok) screenshotFailures += 1;
      }

      refreshAfterPublicationMutation();
      if (toMark.length > 0 && markResult?.ok) {
        toast.success(
          screenshotFailures > 0
            ? `${markResult.message} Screenshot could not be saved for ${screenshotFailures} ${
                screenshotFailures === 1 ? "story" : "stories"
              }.`
            : markResult.message
        );
      } else if (screenshotFailures === 0 && screenshotRows.length > 0) {
        toast.success(screenshotRows.length === 1 ? "Screenshot saved." : "Screenshots saved.");
      } else if (screenshotFailures > 0) {
        toast.error("Stories stayed live. Screenshot could not be saved.");
      }
      onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mark stories live"
      description="Tick planned stories that went live. Metrics are not collected for stories."
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
        <OperationalDetailCommandBar
          contextLabel="Publications"
          title="Mark stories live"
          subtitle="Stories expire, so they are marked live from the assignment plan instead of a public URL."
        />
        <OperationalDetailScrollBody>
          <OperationalDetailSection icon={<UserIcon className="size-3.5" />} title="Creator">
            <SearchableSelect
              value={lineId}
              onValueChange={setLineId}
              options={assignmentOptions}
              placeholder="Select a creator"
              disabled={isPending}
              emptyMessage="No assigned creators"
            />
          </OperationalDetailSection>

          <OperationalDetailSection icon={<CalendarIcon className="size-3.5" />} title="Planned stories">
            {!lineId ? (
              <p className="text-sm text-muted-foreground">Select a creator to see their planned stories.</p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Loading stories…</p>
            ) : loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No planned stories for this creator.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                    Went-live date for selected
                  </p>
                  <Input
                    type="date"
                    className={cn(DETAIL_FORM_INPUT_CLASS, "bg-white")}
                    value={bulkDate}
                    onChange={(event) => applyBulkDate(event.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  {posts.map((post) => {
                    const draft = drafts[post.id] ?? emptyDraft(post);
                    return (
                      <div
                        key={post.id}
                        className={cn(
                          "rounded-xl border border-[#eaedf4] bg-white p-3 space-y-2",
                          post.alreadyLive && "opacity-70"
                        )}
                      >
                        <label className="flex items-start gap-2.5">
                          <Checkbox
                            checked={post.alreadyLive || draft.selected}
                            disabled={isPending || post.alreadyLive}
                            onCheckedChange={(checked) =>
                              updateDraft(post.id, { selected: checked === true })
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {post.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {post.alreadyLive
                                ? post.hasScreenshot
                                  ? "Already live · screenshot on file"
                                  : "Already live"
                                : post.liveDate
                                  ? `Scheduled ${post.liveDate}`
                                  : "No scheduled date"}
                            </span>
                          </span>
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            type="date"
                            className={cn(DETAIL_FORM_INPUT_CLASS, "bg-white")}
                            value={draft.wentLiveDate}
                            disabled={isPending || post.alreadyLive}
                            onChange={(event) =>
                              updateDraft(post.id, { wentLiveDate: event.target.value })
                            }
                          />
                          <Input
                            className={cn(DETAIL_FORM_INPUT_CLASS, "bg-white")}
                            placeholder="Optional story URL (reference only)"
                            value={draft.contentUrl}
                            disabled={isPending || post.alreadyLive}
                            onChange={(event) =>
                              updateDraft(post.id, { contentUrl: event.target.value })
                            }
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ImageIcon className="size-3.5 shrink-0" />
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={isPending}
                            className="max-w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                            onChange={(event) =>
                              updateDraft(post.id, { file: event.target.files?.[0] ?? null })
                            }
                          />
                          {draft.file ? (
                            <span className="truncate">{draft.file.name}</span>
                          ) : (
                            <span>Screenshot optional</span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </OperationalDetailSection>

          <OperationalDetailSection icon={<StickyNoteIcon className="size-3.5" />} title="Notes">
            <Textarea
              rows={2}
              className="min-h-[4rem] resize-y border-[#eaedf4] bg-white text-sm shadow-none focus-visible:ring-1"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
              placeholder="Optional — applied to stories marked live now"
            />
          </OperationalDetailSection>
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
              : selectedCount > 0
                ? selectedCount === 1
                  ? "Mark live"
                  : `Mark ${selectedCount} stories live`
                : screenshotCount === 1
                  ? "Save screenshot"
                  : "Save screenshots"}
          </Button>
        </OperationalDetailFooter>
      </form>
    </OperationalDetailSheet>
  );
}