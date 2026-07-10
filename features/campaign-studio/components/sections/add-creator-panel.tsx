"use client";

import { useCallback, useState } from "react";
import {
  Link2Icon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Undo2Icon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import type {
  StudioDraftCreatorRef,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";
import { browseUnifiedCreatorsAction } from "@/features/campaigns/creator-discovery-actions";
import { addCreatorByProfileUrlAction } from "@/features/discovery/add-creator-by-url/actions";
import { refreshCreatorAllAction } from "@/features/discovery/enrichment/actions";
import { pollCreatorAfterRefresh } from "@/features/discovery/enrichment/poll-creator-refresh";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  stageStudioDraftChangeAction,
  unstageStudioDraftChangeAction,
  updateStudioDraftEnrichmentAction,
} from "../../actions/studio-draft-actions";
import { normalizeCreatorId } from "../../services/studio-draft";
import { formatFollowers } from "./shared/format-utils";

type AddCreatorPanelProps = {
  conversationId: string;
  messageId: string;
  draft: StudioDraftState;
  onDraftUpdated: (draft: StudioDraftState) => void;
};

type AddMode = "discovery" | "url";

function toDraftRef(
  creator: UnifiedCreatorResult,
  source: StudioDraftCreatorRef["source"],
  enrichmentStatus: NonNullable<StudioDraftCreatorRef["enrichmentStatus"]>
): StudioDraftCreatorRef {
  const primaryPlatform = creator.platforms[0];
  return {
    creatorId: creator.unified_id,
    displayName: creator.display_name,
    handle: primaryPlatform?.handle,
    platform: primaryPlatform?.platform,
    followers: creator.metrics.followers.value ?? undefined,
    avatarUrl: creator.primaryAvatarUrl ?? creator.profile_image_url ?? undefined,
    source,
    enrichmentStatus,
  };
}

const ENRICHMENT_CHIPS: Record<
  NonNullable<StudioDraftCreatorRef["enrichmentStatus"]>,
  { label: string; className: string }
> = {
  not_requested: {
    label: "Not enriched",
    className: "bg-muted text-muted-foreground",
  },
  pending: {
    label: "Enriching…",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  enriched: {
    label: "Intelligence ready",
    className: "bg-[#1D9E75]/10 text-[#1D9E75]",
  },
  failed: {
    label: "Enrichment failed",
    className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
};

/**
 * Staged creator additions + the two add paths from the spec:
 * Discovery picks stay un-enriched until a manual Refresh Intelligence;
 * external-URL creators enrich automatically with visible progress.
 */
export function AddCreatorPanel({
  conversationId,
  messageId,
  draft,
  onDraftUpdated,
}: AddCreatorPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("discovery");
  const [query, setQuery] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [addingUrl, setAddingUrl] = useState(false);
  const [results, setResults] = useState<UnifiedCreatorResult[]>([]);
  const [busyCreatorId, setBusyCreatorId] = useState<string | null>(null);

  const stagedAdditions = draft.changes.filter((c) => c.kind === "add_creator");
  const stagedIds = new Set(
    stagedAdditions.map((c) =>
      normalizeCreatorId(c.kind === "add_creator" ? c.creator.creatorId : "")
    )
  );

  const stageAddition = useCallback(
    async (ref: StudioDraftCreatorRef) => {
      const result = await stageStudioDraftChangeAction({
        conversationId,
        messageId,
        change: { kind: "add_creator", creator: ref },
      });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      if (result.draft) onDraftUpdated(result.draft);
      toast.success(result.message);
      return true;
    },
    [conversationId, messageId, onDraftUpdated]
  );

  const setEnrichment = useCallback(
    async (
      creatorId: string,
      enrichmentStatus: NonNullable<StudioDraftCreatorRef["enrichmentStatus"]>
    ) => {
      const result = await updateStudioDraftEnrichmentAction({
        conversationId,
        messageId,
        creatorId,
        enrichmentStatus,
      });
      if (result.ok && result.draft) onDraftUpdated(result.draft);
    },
    [conversationId, messageId, onDraftUpdated]
  );

  const enrichStagedCreator = useCallback(
    async (ref: StudioDraftCreatorRef) => {
      const influencerId = ref.creatorId.startsWith("inf:")
        ? ref.creatorId.slice(4)
        : !ref.creatorId.startsWith("dis:")
          ? ref.creatorId
          : null;
      if (!influencerId) {
        toast.error("This creator has no production profile to enrich yet.");
        return;
      }
      setBusyCreatorId(ref.creatorId);
      try {
        const queued = await refreshCreatorAllAction(influencerId);
        if (!queued.ok) {
          toast.error(queued.message ?? "Could not queue enrichment.");
          return;
        }
        await setEnrichment(ref.creatorId, "pending");
        toast.success(`Refreshing intelligence for ${ref.displayName ?? "creator"}…`);
        const status = await pollCreatorAfterRefresh(
          { unifiedId: ref.creatorId, influencerId },
          { onUpdated: () => undefined }
        );
        await setEnrichment(
          ref.creatorId,
          status === "completed" ? "enriched" : "failed"
        );
        if (status === "completed") {
          toast.success(`${ref.displayName ?? "Creator"} intelligence is up to date.`);
        } else {
          toast.error("Enrichment did not complete — try again.");
        }
      } finally {
        setBusyCreatorId(null);
      }
    },
    [setEnrichment]
  );

  const searchDiscovery = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const result = await browseUnifiedCreatorsAction(
        { search: q, page: 1, pageSize: 6 },
        { caller: "studio_add_creator" }
      );
      setResults(result.creators);
      if (result.creators.length === 0) {
        toast.info("No Discovery creators matched — try a broader search.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addFromUrl = useCallback(async () => {
    const url = profileUrl.trim();
    if (!url) return;
    setAddingUrl(true);
    try {
      const result = await addCreatorByProfileUrlAction(url);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const ref = toDraftRef(
        result.creator,
        "external_url",
        result.enrichmentQueued ? "pending" : "enriched"
      );
      const staged = await stageAddition(ref);
      if (!staged) return;
      setProfileUrl("");

      if (result.enrichmentQueued && result.creator.influencer_id) {
        // External-URL additions auto-enrich — surface progress on the staged card.
        void pollCreatorAfterRefresh(
          { unifiedId: result.creator.unified_id, influencerId: result.creator.influencer_id },
          { onUpdated: () => undefined }
        ).then((status) =>
          setEnrichment(ref.creatorId, status === "completed" ? "enriched" : "failed")
        );
      }
    } finally {
      setAddingUrl(false);
    }
  }, [profileUrl, setEnrichment, stageAddition]);

  const undoAddition = useCallback(
    async (creatorId: string) => {
      setBusyCreatorId(creatorId);
      try {
        const result = await unstageStudioDraftChangeAction({
          conversationId,
          messageId,
          creatorId,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.draft) onDraftUpdated(result.draft);
        toast.success("Addition removed from the draft.");
      } finally {
        setBusyCreatorId(null);
      }
    },
    [conversationId, messageId, onDraftUpdated]
  );

  return (
    <div className="space-y-2">
      {stagedAdditions.map((change) => {
        if (change.kind !== "add_creator") return null;
        const ref = change.creator;
        const chip = ENRICHMENT_CHIPS[ref.enrichmentStatus ?? "not_requested"];
        const busy = busyCreatorId === ref.creatorId;
        return (
          <div
            key={ref.creatorId}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#1D9E75]/50 bg-[#1D9E75]/5 p-3"
          >
            <CreatorAvatarImage
              avatarUrl={ref.avatarUrl}
              size="sm"
              alt={ref.displayName ?? "Creator"}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{ref.displayName ?? ref.creatorId}</span>
                {ref.handle ? (
                  <span className="break-all text-xs text-muted-foreground">@{ref.handle}</span>
                ) : null}
                <Badge className="h-auto bg-[#1D9E75]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#1D9E75]">
                  Pending addition
                </Badge>
                <Badge className={`h-auto px-1.5 py-0.5 text-[9px] font-semibold ${chip.className}`}>
                  {ref.enrichmentStatus === "pending" ? (
                    <Loader2Icon className="mr-1 size-2.5 animate-spin" />
                  ) : null}
                  {chip.label}
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ref.platform ? `${ref.platform} · ` : ""}
                {ref.followers != null ? `${formatFollowers(ref.followers)} followers · ` : ""}
                {ref.source === "external_url" ? "Added from profile link" : "Picked from Discovery"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {ref.enrichmentStatus !== "pending" && ref.enrichmentStatus !== "enriched" ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  className="h-7 border-violet-300 px-2.5 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300"
                  onClick={() => void enrichStagedCreator(ref)}
                >
                  <SparklesIcon className="size-3" />
                  Refresh Intelligence
                </Button>
              ) : null}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={busy}
                className="h-7 px-2.5 text-muted-foreground"
                onClick={() => void undoAddition(ref.creatorId)}
              >
                <Undo2Icon className="size-3" />
                Undo
              </Button>
            </div>
          </div>
        );
      })}

      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setOpen(true)}
        >
          <UserPlusIcon className="size-3.5" />
          Add creator to the plan
        </Button>
      ) : (
        <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
              <Button
                type="button"
                size="xs"
                variant={mode === "discovery" ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setMode("discovery")}
              >
                <SearchIcon className="size-3" />
                From Discovery
              </Button>
              <Button
                type="button"
                size="xs"
                variant={mode === "url" ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setMode("url")}
              >
                <Link2Icon className="size-3" />
                From profile URL
              </Button>
            </div>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>

          {mode === "discovery" ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={query}
                  placeholder="Search Discovery creators by name or handle…"
                  className="h-8 text-xs"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchDiscovery();
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={searching || !query.trim()}
                  className="h-8 bg-[#1D9E75] px-3 text-xs hover:bg-[#178f69]"
                  onClick={() => void searchDiscovery()}
                >
                  {searching ? <Loader2Icon className="size-3.5 animate-spin" /> : "Search"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Discovery picks keep their current data — use Refresh Intelligence per creator
                when you want updated metrics.
              </p>
              {results.map((creator) => {
                const alreadyStaged = stagedIds.has(normalizeCreatorId(creator.unified_id));
                return (
                  <div
                    key={creator.unified_id}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2"
                  >
                    <CreatorAvatarImage
                      avatarUrl={creator.primaryAvatarUrl ?? creator.profile_image_url}
                      size="sm"
                      alt={creator.display_name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{creator.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {creator.platforms[0]?.platform ?? "—"} ·{" "}
                        {formatFollowers(creator.metrics.followers.value ?? undefined)} followers
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      disabled={alreadyStaged}
                      className="h-7 bg-[#1D9E75] px-2.5 hover:bg-[#178f69] disabled:opacity-50"
                      onClick={() =>
                        void stageAddition(toDraftRef(creator, "discovery", "not_requested"))
                      }
                    >
                      <PlusIcon className="size-3" />
                      {alreadyStaged ? "Staged" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={profileUrl}
                  placeholder="Paste an Instagram / TikTok / YouTube profile link…"
                  className="h-8 text-xs"
                  onChange={(e) => setProfileUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addFromUrl();
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={addingUrl || !profileUrl.trim()}
                  className="h-8 bg-[#1D9E75] px-3 text-xs hover:bg-[#178f69]"
                  onClick={() => void addFromUrl()}
                >
                  {addingUrl ? <Loader2Icon className="size-3.5 animate-spin" /> : "Add & enrich"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                New profiles are fetched and analyzed automatically — progress shows on the staged
                card and nothing recalculates until you apply all updates.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
