"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { DownloadIcon, ListIcon, RadarIcon, SparklesIcon, type LucideIcon } from "lucide-react";

import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CreatorBrowserDialog } from "@/features/campaigns/components/creator-browser-dialog";
import { CreatorUnifiedCard } from "@/features/campaigns/components/creator-unified-card";
import { OperationalDetailSheet } from "@/features/campaigns/components/operational-detail-panel";
import { CampaignShortlistAssignmentsPanel } from "@/features/discovery/shortlists/components/campaign-shortlist-assignments-panel";
import {
  exportCampaignShortlistCsvAction,
  getCampaignShortlistAction,
  matchCampaignCreatorsAction,
  removeCreatorFromShortlistAction,
} from "@/features/campaigns/creator-discovery-actions";
import type { CampaignCreatorMatch } from "@/lib/creators/types";

type DiscoveryContextValue = {
  aiMatchOpen: boolean;
  setAiMatchOpen: (open: boolean) => void;
  shortlistOpen: boolean;
  setShortlistOpen: (open: boolean) => void;
  shortlistCount: number;
};

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

function useDiscoveryContext() {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) {
    throw new Error("Campaign creator discovery components require CampaignCreatorDiscoveryProvider");
  }
  return ctx;
}

type CampaignCreatorDiscoveryProviderProps = {
  campaignHeaderId: string;
  campaignName: string;
  brandCountry?: string | null;
  children: ReactNode;
};

export function CampaignCreatorDiscoveryProvider({
  campaignHeaderId,
  campaignName,
  brandCountry,
  children,
}: CampaignCreatorDiscoveryProviderProps) {
  const [aiMatchOpen, setAiMatchOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [shortlistCount, setShortlistCount] = useState(0);
  const [, startTransition] = useTransition();

  const refreshShortlistCount = useCallback(() => {
    startTransition(async () => {
      try {
        const rows = await getCampaignShortlistAction(campaignHeaderId);
        setShortlistCount(rows.length);
      } catch (error) {
        console.error("[Assignments] shortlist count refresh failed", {
          campaignHeaderId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }, [campaignHeaderId]);

  useEffect(() => {
    refreshShortlistCount();
  }, [refreshShortlistCount]);

  return (
    <DiscoveryContext.Provider
      value={{
        aiMatchOpen,
        setAiMatchOpen,
        shortlistOpen,
        setShortlistOpen,
        shortlistCount,
      }}
    >
      {children}
      <CampaignCreatorDiscoverySheets
        campaignHeaderId={campaignHeaderId}
        campaignName={campaignName}
        brandCountry={brandCountry}
        onShortlistChange={refreshShortlistCount}
      />
    </DiscoveryContext.Provider>
  );
}

/** Sticky footer links inside asgn-wrap — matches HTML panel-assignments footer. */
export function CampaignCreatorDiscoveryFooter() {
  const { setAiMatchOpen, setShortlistOpen, shortlistCount } = useDiscoveryContext();

  return (
    <div className="thinkway-campaign-asgn-footer">
      <button
        type="button"
        className="thinkway-campaign-asgn-footer-btn thinkway-campaign-asgn-footer-btn-primary"
        onClick={() => setAiMatchOpen(true)}
      >
        ✨ AI Match Creators
      </button>
      <button
        type="button"
        className="thinkway-campaign-asgn-footer-btn"
        onClick={() => setShortlistOpen(true)}
      >
        ☰ Campaign Shortlist
        {shortlistCount > 0 ? ` (${shortlistCount})` : ""}
      </button>
    </div>
  );
}

function DiscoverySheetHeader({
  icon: Icon,
  title,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-border/60 px-6 py-4">
      <div className="flex items-center justify-between gap-3 pr-8">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-[var(--brand-product)]" />
          <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
        </div>
        {actions}
      </div>
    </div>
  );
}

type CampaignCreatorDiscoverySheetsProps = {
  campaignHeaderId: string;
  campaignName: string;
  brandCountry?: string | null;
  onShortlistChange: () => void;
};

function CampaignCreatorDiscoverySheets({
  campaignHeaderId,
  campaignName,
  brandCountry,
  onShortlistChange,
}: CampaignCreatorDiscoverySheetsProps) {
  const { aiMatchOpen, setAiMatchOpen, shortlistOpen, setShortlistOpen } = useDiscoveryContext();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [brief, setBrief] = useState(`${campaignName} influencer campaign`);
  const [matches, setMatches] = useState<CampaignCreatorMatch[]>([]);
  const [shortlist, setShortlist] = useState<
    Awaited<ReturnType<typeof getCampaignShortlistAction>>
  >([]);
  const [isPending, startTransition] = useTransition();

  const refreshShortlist = useCallback(() => {
    startTransition(async () => {
      const rows = await getCampaignShortlistAction(campaignHeaderId);
      setShortlist(rows);
      onShortlistChange();
    });
  }, [campaignHeaderId, onShortlistChange]);

  useEffect(() => {
    if (shortlistOpen) refreshShortlist();
  }, [shortlistOpen, refreshShortlist]);

  function runAiMatch() {
    startTransition(async () => {
      const rows = await matchCampaignCreatorsAction({
        campaignHeaderId,
        brief,
        country: brandCountry ?? undefined,
        limit: 8,
      });
      setMatches(rows);
    });
  }

  function exportShortlist() {
    startTransition(async () => {
      const csv = await exportCampaignShortlistCsvAction(campaignHeaderId);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campaignName.replace(/\s+/g, "-").toLowerCase()}-shortlist.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <>
      <OperationalDetailSheet
        open={aiMatchOpen}
        onOpenChange={setAiMatchOpen}
        title="AI Match Creators"
        description="Run AI matching against your campaign brief"
      >
        <DiscoverySheetHeader
          icon={SparklesIcon}
          title="AI Match Creators"
          actions={
            <Button size="sm" variant="outline" onClick={() => setBrowserOpen(true)}>
              <RadarIcon className="size-3.5" data-icon="inline-start" />
              Open browser
            </Button>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="min-h-[120px] text-xs"
              placeholder="Campaign brief for AI matching…"
            />
            <Button size="sm" disabled={isPending || !brief.trim()} onClick={runAiMatch}>
              {isPending ? "Matching…" : "Run AI match"}
            </Button>
            {matches.length > 0 ? (
              <div className="space-y-2 pb-2">
                {matches.map((match) => (
                  <div
                    key={match.unified_id}
                    className="rounded-xl border border-border/50 bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CreatorProfileLink
                        source={creatorProfileSourceFromUnified(match.creator)}
                        size="sm"
                        showHandle={false}
                        stopPropagation
                      />
                      <p className="text-sm font-semibold tabular-nums text-[var(--brand-product)]">
                        {match.match_score}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{match.rationale}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      ROI est. {match.estimated_roi} · Niche {match.niche_fit} · Engagement{" "}
                      {match.engagement_quality} · Auth {match.authenticity}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Enter a brief and run AI match to see ranked creator suggestions.
              </p>
            )}
          </div>
        </div>
      </OperationalDetailSheet>

      <OperationalDetailSheet
        open={shortlistOpen}
        onOpenChange={setShortlistOpen}
        title="Campaign Shortlist"
        description="Creators shortlisted for this campaign"
      >
        <DiscoverySheetHeader
          icon={ListIcon}
          title="Campaign Shortlist"
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={shortlist.length === 0}
              onClick={exportShortlist}
            >
              <DownloadIcon className="size-3.5" data-icon="inline-start" />
              Export
            </Button>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {shortlist.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No creators shortlisted yet. Use Creator Browser to add creators.
              </p>
            ) : (
              shortlist.map((row) =>
                row.creator ? (
                  <div key={row.item_id} className="space-y-1">
                    <CreatorUnifiedCard creator={row.creator} compact />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() =>
                        startTransition(async () => {
                          await removeCreatorFromShortlistAction(campaignHeaderId, row.item_id);
                          refreshShortlist();
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ) : null
              )
            )}
            <CampaignShortlistAssignmentsPanel campaignHeaderId={campaignHeaderId} />
          </div>
        </div>
      </OperationalDetailSheet>

      <CreatorBrowserDialog
        open={browserOpen}
        onOpenChange={(v) => {
          setBrowserOpen(v);
          if (!v) refreshShortlist();
        }}
        onSelect={() => {}}
        campaignHeaderId={campaignHeaderId}
      />
    </>
  );
}

/** @deprecated Use CampaignCreatorDiscoveryProvider + Footer + inline sheets. */
export function CampaignCreatorDiscoveryPanel(props: Omit<CampaignCreatorDiscoveryProviderProps, "children">) {
  return (
    <CampaignCreatorDiscoveryProvider {...props}>
      <CampaignCreatorDiscoveryFooter />
    </CampaignCreatorDiscoveryProvider>
  );
}
