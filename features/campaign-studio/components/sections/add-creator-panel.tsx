"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CompassIcon,
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
import {
  getCreatorEnrichmentStatusAction,
  refreshCreatorAllAction,
} from "@/features/discovery/enrichment/actions";
import { pollCreatorAfterRefresh } from "@/features/discovery/enrichment/poll-creator-refresh";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { cn } from "@/lib/utils";

import {
  stageStudioDraftChangeAction,
  unstageStudioDraftChangeAction,
  updateStudioDraftEnrichmentAction,
} from "../../actions/studio-draft-actions";
import { normalizeCreatorId } from "../../services/studio-draft";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import {
  buildCreatorSelectionChange,
  enrichmentStatusForSelection,
  undoTargetIdForSelectionChange,
  type StudioCreatorReplacementTarget,
} from "../../services/studio-creator-replacement";
import { formatFollowers } from "./shared/format-utils";
import { hasStudioCampaignBrowseConstraints } from "../../services/studio-discovery-browse-filters";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

type AddCreatorPanelProps = {
  conversationId: string;
  messageId: string;
  draft: StudioDraftState;
  onDraftUpdated: (draft: StudioDraftState) => void;
  /**
   * Set when this panel is replacing a selected creator rather than adding one.
   * Every route then stages `replace_creator` against this target instead of
   * `add_creator` — the same draft machinery, with a target.
   */
  replaceTarget?: StudioCreatorReplacementTarget | null;
  /**
   * Recommended-but-not-selected creators, offered first when replacing. These
   * are derived from the campaign's own persisted pool, not fetched.
   */
  candidates?: StudioDraftCreatorRef[];
  /** Replacement staged — lets the caller close its dialog and offer Undo. */
  onSelectionStaged?: (input: { undoCreatorId: string; displayName?: string }) => void;
  /**
   * The campaign's own Discovery filters, for browsing rather than searching by
   * name. Supplied by the caller (which holds the campaign object) via
   * `studioCampaignBrowseFilters`.
   */
  browseFilters?: UnifiedCreatorBrowseFilters;
};

/** "recommended" is offered only while replacing; it has no meaning for a plain add. */
type AddMode = "recommended" | "browse" | "discovery" | "url";

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
    className: "bg-brand-product/10 text-brand-product",
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
  replaceTarget = null,
  candidates = [],
  onSelectionStaged,
  browseFilters,
}: AddCreatorPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>(
    replaceTarget && candidates.length > 0 ? "recommended" : "discovery"
  );
  const [query, setQuery] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [addingUrl, setAddingUrl] = useState(false);
  const [results, setResults] = useState<UnifiedCreatorResult[]>([]);
  const [busyCreatorId, setBusyCreatorId] = useState<string | null>(null);

  // Replace is clicked on a creator card above this panel, which is collapsed
  // by default — so without this the operator clicked Replace and saw nothing.
  const replaceTargetId = replaceTarget?.creatorId ?? null;
  useEffect(() => {
    if (!replaceTargetId) return;
    setOpen(true);
    // Always the candidate tab; `effectiveMode` below demotes it to Browse
    // Discovery when there is nothing left to recommend, and promotes it again
    // if hydration produces candidates. No ref read during render.
    setMode("recommended");
  }, [replaceTargetId]);

  // "recommended" only means anything while replacing. Once the replacement is
  // staged the target clears, so fall back rather than leave a list that says
  // it replaces a creator it no longer has.
  const effectiveMode: AddMode =
    mode === "recommended" && !(replaceTarget && candidates.length > 0)
      ? browseFilters
        ? "browse"
        : "discovery"
      : mode === "browse" && !browseFilters
        ? "discovery"
        : mode;

  const stagedAdditions = draft.changes.filter((c) => c.kind === "add_creator");
  const stagedIds = new Set(
    stagedAdditions.map((c) =>
      normalizeCreatorId(c.kind === "add_creator" ? c.creator.creatorId : "")
    )
  );

  const stageAddition = useCallback(
    async (ref: StudioDraftCreatorRef) => {
      // One staging path for both. `replace_creator` already exists as a draft
      // change and `applyStudioDraftChanges` + `reoptimizeCampaignAfterApply`
      // already commit and re-score it, so replacing is adding with a target.
      const change = buildCreatorSelectionChange({
        replacement: ref,
        target: replaceTarget,
        stagedAt: new Date().toISOString(),
      });
      const result = await stageStudioDraftChangeAction({
        conversationId,
        messageId,
        change,
      });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      if (result.draft) onDraftUpdated(result.draft);
      toast.success(result.message);
      const undoCreatorId = undoTargetIdForSelectionChange(change);
      if (undoCreatorId) {
        onSelectionStaged?.({
          undoCreatorId,
          displayName: replaceTarget?.displayName ?? ref.displayName,
        });
      }
      return true;
    },
    [conversationId, messageId, onDraftUpdated, onSelectionStaged, replaceTarget]
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

  // A persisted "pending" chip only means a poll was running in some session.
  // Reconcile against the real backend status once per creator, and resume
  // polling when the job is still queued/collecting — never trust the stored
  // optimistic state after a reload.
  const reconciledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const change of stagedAdditions) {
      if (change.kind !== "add_creator") continue;
      const ref = change.creator;
      if (ref.enrichmentStatus !== "pending") continue;
      if (reconciledRef.current.has(ref.creatorId)) continue;
      reconciledRef.current.add(ref.creatorId);

      const influencerId = ref.creatorId.startsWith("inf:")
        ? ref.creatorId.slice(4)
        : !ref.creatorId.startsWith("dis:")
          ? ref.creatorId
          : null;
      if (!influencerId) continue;

      void getCreatorEnrichmentStatusAction(influencerId).then((status) => {
        if (status === "completed") return setEnrichment(ref.creatorId, "enriched");
        if (status === "failed" || status === "pending") {
          // "pending" here means no job and no queued row — enrichment is not running.
          return setEnrichment(ref.creatorId, "failed");
        }
        // queued / collecting — a job really is in flight; resume the poll.
        return pollCreatorAfterRefresh(
          { unifiedId: ref.creatorId, influencerId },
          { onUpdated: () => undefined }
        ).then((terminal) =>
          setEnrichment(ref.creatorId, terminal === "completed" ? "enriched" : "failed")
        );
      });
    }
  }, [stagedAdditions, setEnrichment]);

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

  /**
   * Browse Discovery with the campaign's own constraints — the same
   * `browseUnifiedCreatorsAction` Discovery itself calls, with the filter set
   * projected from Creator Search Requirements. Needs no query, so it works
   * when there are no remaining recommended candidates and nothing has been
   * searched yet.
   */
  const browseDiscovery = useCallback(async () => {
    if (!browseFilters) return;
    setSearching(true);
    try {
      const result = await browseUnifiedCreatorsAction(browseFilters, {
        caller: "studio_browse_discovery",
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults(result.creators);
      if (result.creators.length === 0) {
        toast.info("No Discovery creators match the campaign filters yet.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Browse failed.");
    } finally {
      setSearching(false);
    }
  }, [browseFilters]);

  /** One staging path for both Discovery routes — browse and search by name. */
  const pickDiscoveryCreator = useCallback(
    (creator: UnifiedCreatorResult) => {
      void stageAddition(toDraftRef(creator, "discovery", "not_requested"));
    },
    [stageAddition]
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
      if (result.error) {
        toast.error(result.error);
        return;
      }
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
      if (!result.creator) {
        toast.info(result.message);
        return;
      }
      // Status must mirror the backend: only a confirmed queue insert may show
      // progress; anything else stays "not enriched" with the server's reason.
      const ref = toDraftRef(
        result.creator,
        "external_url",
        enrichmentStatusForSelection({
          source: "external_url",
          queued: Boolean(result.enrichmentQueued),
        })
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
      } else if (!result.enrichmentQueued) {
        toast.warning("Creator added without enrichment", { description: result.message });
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
            className="flex flex-col gap-3 rounded-xl border border-dashed border-brand-product/50 bg-brand-product/5 p-3 sm:flex-row sm:items-center"
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
                <Badge className="h-auto bg-brand-product/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-product">
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
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
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
            <div
              className="flex gap-1 rounded-lg bg-muted/60 p-0.5"
              role="tablist"
              aria-label="Add creator source"
            >
              {replaceTarget && candidates.length > 0 ? (
                <Button
                  type="button"
                  size="xs"
                  role="tab"
                  aria-selected={effectiveMode === "recommended"}
                  variant={effectiveMode === "recommended" ? "secondary" : "ghost"}
                  className={cn("h-7 px-2.5 text-xs", STUDIO_CLASSES.focusRingInset)}
                  onClick={() => setMode("recommended")}
                >
                  <SparklesIcon className="size-3" aria-hidden />
                  Other recommended ({candidates.length})
                </Button>
              ) : null}
              {browseFilters ? (
                <Button
                  type="button"
                  size="xs"
                  role="tab"
                  aria-selected={effectiveMode === "browse"}
                  variant={effectiveMode === "browse" ? "secondary" : "ghost"}
                  className={cn("h-7 px-2.5 text-xs", STUDIO_CLASSES.focusRingInset)}
                  onClick={() => {
                    setMode("browse");
                    if (results.length === 0) void browseDiscovery();
                  }}
                >
                  <CompassIcon className="size-3" aria-hidden />
                  Browse Discovery
                </Button>
              ) : null}
              <Button
                type="button"
                size="xs"
                role="tab"
                aria-selected={effectiveMode === "discovery"}
                variant={effectiveMode === "discovery" ? "secondary" : "ghost"}
                className={cn("h-7 px-2.5 text-xs", STUDIO_CLASSES.focusRingInset)}
                onClick={() => setMode("discovery")}
              >
                <SearchIcon className="size-3" aria-hidden />
                Search by name
              </Button>
              <Button
                type="button"
                size="xs"
                role="tab"
                aria-selected={effectiveMode === "url"}
                variant={effectiveMode === "url" ? "secondary" : "ghost"}
                className={cn("h-7 px-2.5 text-xs", STUDIO_CLASSES.focusRingInset)}
                onClick={() => setMode("url")}
              >
                <Link2Icon className="size-3" aria-hidden />
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

          {effectiveMode === "recommended" ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Recommended for this campaign and not currently selected. Already
                enriched — picking one replaces{" "}
                <span className="font-semibold">{replaceTarget?.displayName ?? "the creator"}</span>{" "}
                straight away.
              </p>
              <ul className="space-y-1">
                {candidates.map((candidate) => (
                  <li
                    key={candidate.creatorId}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2 py-1.5"
                  >
                    <CreatorAvatarImage
                      avatarUrl={candidate.avatarUrl}
                      size="xs"
                      alt={candidate.displayName ?? candidate.handle ?? ""}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {candidate.displayName ?? candidate.handle ?? candidate.creatorId}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {[
                          candidate.handle ? `@${candidate.handle}` : null,
                          candidate.platform,
                          candidate.followers != null
                            ? `${formatFollowers(candidate.followers)} followers`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      disabled={busyCreatorId === candidate.creatorId}
                      className={cn("h-7 px-2.5 text-xs", STUDIO_CLASSES.primaryBtn)}
                      onClick={() => {
                        setBusyCreatorId(candidate.creatorId);
                        void stageAddition(candidate).finally(() => setBusyCreatorId(null));
                      }}
                    >
                      Use this creator
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : effectiveMode === "browse" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {hasStudioCampaignBrowseConstraints(browseFilters ?? {})
                    ? "Discovery creators that match this campaign's confirmed market, platforms and categories."
                    : "Browsing Discovery without campaign filters — this campaign has no confirmed constraints yet."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={searching}
                  className={cn("h-8 px-3 text-xs sm:shrink-0", STUDIO_CLASSES.primaryBtn)}
                  onClick={() => void browseDiscovery()}
                >
                  {searching ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : results.length > 0 ? (
                    "Refresh"
                  ) : (
                    "Browse"
                  )}
                </Button>
              </div>
              <DiscoveryResultList
                results={results}
                stagedIds={stagedIds}
                replacing={Boolean(replaceTarget)}
                onPick={pickDiscoveryCreator}
              />
            </div>
          ) : effectiveMode === "discovery" ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
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
                  className={cn("h-8 px-3 text-xs sm:shrink-0", STUDIO_CLASSES.primaryBtn)}
                  onClick={() => void searchDiscovery()}
                >
                  {searching ? <Loader2Icon className="size-3.5 animate-spin" /> : "Search"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Discovery picks keep their current data — use Refresh Intelligence per creator
                when you want updated metrics.
              </p>
              <DiscoveryResultList
                results={results}
                stagedIds={stagedIds}
                replacing={Boolean(replaceTarget)}
                onPick={pickDiscoveryCreator}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
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
                  className={cn("h-8 px-3 text-xs sm:shrink-0", STUDIO_CLASSES.primaryBtn)}
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

/**
 * Discovery result rows, shared by Browse Discovery and search-by-name so both
 * routes render and stage identically.
 */
function DiscoveryResultList({
  results,
  stagedIds,
  replacing,
  onPick,
}: {
  results: UnifiedCreatorResult[];
  stagedIds: Set<string>;
  replacing: boolean;
  onPick: (creator: UnifiedCreatorResult) => void;
}) {
  if (results.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {results.map((creator) => {
        const alreadyStaged = stagedIds.has(normalizeCreatorId(creator.unified_id));
        return (
          <li
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
              className={cn("h-7 px-2.5 disabled:opacity-50 sm:shrink-0", STUDIO_CLASSES.primaryBtn)}
              onClick={() => onPick(creator)}
            >
              <PlusIcon className="size-3" />
              {alreadyStaged ? "Staged" : replacing ? "Use" : "Add"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
