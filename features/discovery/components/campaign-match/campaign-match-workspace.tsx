"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet-lazy";
import {
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
} from "@/features/discovery/components/discovery-creator-exact-row";
import {
  DiscoveryEmptyState,
  DiscoveryLoadingState,
  DiscoverySuiteMasthead,
} from "@/features/discovery/components/design-system";
import {
  InterestChips,
  RelevanceScore,
} from "@/features/discovery/components/discovery-interest-chips";
import { matchDiscoveryCreatorsBriefAction } from "@/features/discovery/actions";
import { getCampaignIntelligenceLibraryFilterOptionsAction } from "@/features/campaign-intelligence-profile/actions/library-actions";
import type { CampaignCreatorMatch } from "@/lib/creators/types";

const MARKETS = ["Egypt", "United Arab Emirates", "Saudi Arabia"] as const;
const LIBRARY_HREF = "/discovery/intelligence/library";

export function CampaignMatchWorkspace() {
  const [brief, setBrief] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [market, setMarket] = useState<string>(MARKETS[0]);
  const [budget, setBudget] = useState("");
  const [creatorsNeeded, setCreatorsNeeded] = useState("");
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; name: string; documentNumber: string; brandId: string }>
  >([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [matches, setMatches] = useState<CampaignCreatorMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCreator, setDetailCreator] = useState<
    CampaignCreatorMatch["creator"] | null
  >(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [isPending, startTransition] = useTransition();
  const briefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void getCampaignIntelligenceLibraryFilterOptionsAction()
      .then((options) => {
        setBrands(options.brands.map((b) => ({ id: b.id, name: b.name })));
        setCampaigns(options.campaigns);
      })
      .catch(() => {
        setBrands([]);
        setCampaigns([]);
      });
  }, []);

  const campaignsForBrand =
    brandId === ""
      ? campaigns
      : campaigns.filter((campaign) => campaign.brandId === brandId);

  const allSelected =
    matches.length > 0 &&
    matches.every((m) => selectedIds.has(m.creator.unified_id));
  const indeterminate = selectedIds.size > 0 && !allSelected;
  const briefSet = brief.trim().length > 0;

  const mastheadMetrics = [
    {
      label: "Matches",
      value: hasRun || matches.length > 0 ? matches.length : 0,
      tone: matches.length === 0 ? ("r" as const) : undefined,
    },
    {
      label: "Brief",
      value: briefSet ? "set" : "not set",
      tone: "s" as const,
    },
    { label: "Creators scanned", value: hasRun ? matches.length : 0 },
    { label: "Shortlisted", value: selectedIds.size },
  ];

  function toggleSelect(unifiedId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unifiedId)) next.delete(unifiedId);
      else next.add(unifiedId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(matches.map((m) => m.creator.unified_id)));
  }

  function runMatch() {
    const trimmed = brief.trim();
    if (!trimmed) {
      toast.error("Enter a campaign brief to match creators.");
      briefRef.current?.focus();
      return;
    }

    startTransition(async () => {
      try {
        const rows = await matchDiscoveryCreatorsBriefAction({
          brief: trimmed,
          limit: 20,
        });
        setMatches(rows);
        setHasRun(true);
        setSelectedIds(new Set());
        if (rows.length === 0) {
          toast.message("No creators matched this brief.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Match failed");
      }
    });
  }

  const loadFromLibrary = (
    <Button type="button" variant="outline" className="h-8 text-[12px]" asChild>
      <Link href={LIBRARY_HREF}>Load from library</Link>
    </Button>
  );

  return (
    <div className="discovery-suite flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--tw-bg)]">
      <div className="shrink-0 px-4 pt-4">
        <DiscoverySuiteMasthead
          title="Campaign match"
          subtitle="Score creators against your brief using unified browse and fit ranking"
          metrics={mastheadMetrics}
          badge={
            matches.length === 0 ? (
              <span className="tw-p p-y">No matches</span>
            ) : undefined
          }
          freezeOnScroll={false}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <div className="tw-c">
          <div className="tw-ch">
            <span className="tw-ct">Match workspace</span>
            <span className="tw-cs">
              score creators against your brief using unified browse and fit
              ranking
            </span>
          </div>
          <div className="tw-pad">
            <div
              className="grid gap-[11px]"
              style={{
                gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
              }}
            >
              <div>
                <label className="tw-lbl" htmlFor="match-campaign">
                  Campaign
                </label>
                <select
                  id="match-campaign"
                  className="tw-in"
                  aria-label="Campaign"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                >
                  <option value="">Choose a campaign…</option>
                  {campaignsForBrand.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.documentNumber} · {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tw-lbl" htmlFor="match-brand">
                  Brand
                </label>
                <select
                  id="match-brand"
                  className="tw-in"
                  aria-label="Brand"
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    setCampaignId("");
                  }}
                >
                  <option value="">All brands</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tw-lbl" htmlFor="match-market">
                  Market
                </label>
                <select
                  id="match-market"
                  className="tw-in"
                  aria-label="Market"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                >
                  {MARKETS.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tw-lbl" htmlFor="match-budget">
                  Budget
                </label>
                <input
                  id="match-budget"
                  className="tw-in"
                  aria-label="Budget"
                  placeholder="e.g. 500,000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div>
                <label className="tw-lbl" htmlFor="match-creators-needed">
                  Creators needed
                </label>
                <input
                  id="match-creators-needed"
                  className="tw-in"
                  aria-label="Creators needed"
                  placeholder="e.g. 8"
                  value={creatorsNeeded}
                  onChange={(e) => setCreatorsNeeded(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="tw-lbl" htmlFor="match-brief">
                Campaign brief
              </label>
              <textarea
                id="match-brief"
                ref={briefRef}
                className="tw-in"
                style={{ height: 96, padding: 10, resize: "vertical" }}
                aria-label="Campaign brief"
                placeholder="Describe the campaign — audience, tone, deliverables, must-haves…"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>
          </div>
          <div
            className="tw-ch"
            style={{ borderTop: "1px solid var(--tw-hair)", borderBottom: 0 }}
          >
            <span className="tw-cs">
              Matching scores every creator in Discovery against the brief and
              ranks by fit.
            </span>
            <span className="tw-sp" />
            {loadFromLibrary}
            <Button
              type="button"
              disabled={isPending}
              onClick={runMatch}
              className="h-8 gap-1.5 rounded-[8px] px-3 text-[12px] font-semibold"
            >
              <SparklesIcon className="size-3.5" />
              {isPending ? "Matching…" : "Match creators"}
            </Button>
          </div>
        </div>

        <div className="tw-c">
          <div className="tw-ch">
            <span className="tw-ct">Ranked creators</span>
            <span className="tw-cs">
              {matches.length > 0
                ? `${matches.length} ranked by fit`
                : "no matches yet"}
            </span>
          </div>

          {isPending && matches.length === 0 ? (
            <DiscoveryLoadingState
              message="Ranking creators for your brief…"
              className="py-12"
            />
          ) : matches.length === 0 ? (
            <DiscoveryEmptyState
              title="No matches yet"
              description="Enter a campaign brief and run match to see ranked creators. You can also load a saved brief from the Intelligence library instead of writing one."
              className="py-12"
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-[12.5px] font-bold"
                  onClick={() => briefRef.current?.focus()}
                >
                  Write a brief
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-[12.5px] font-bold"
                  asChild
                >
                  <Link href={LIBRARY_HREF}>Load from library</Link>
                </Button>
              </div>
            </DiscoveryEmptyState>
          ) : (
            <>
              <DiscoveryCreatorExactHeader
                total={matches.length}
                allSelected={indeterminate ? "indeterminate" : allSelected}
                hasCreators={matches.length > 0}
                onToggleSelectAll={toggleSelectAll}
                metaLabel="Match fit"
              />
              <div className="discovery-search-exact-scroll max-h-[min(70vh,960px)]">
                {matches.map((match) => {
                  const creator = match.creator;
                  const selected = selectedIds.has(creator.unified_id);
                  return (
                    <DiscoveryCreatorExactRow
                      key={creator.unified_id}
                      creator={creator}
                      selected={selected}
                      onToggleSelect={() => toggleSelect(creator.unified_id)}
                      onOpenCreator={() => {
                        setDetailCreator(creator);
                        setDetailOpen(true);
                      }}
                      showCampaignRelevance
                      meta={
                        <div className="flex flex-col gap-1.5">
                          <RelevanceScore score={match.match_score} />
                          <InterestChips
                            interests={[match.rationale]}
                            maxVisible={1}
                            emptyLabel=""
                            variant="compact"
                          />
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailCreator(null);
        }}
      />
    </div>
  );
}
