"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignObject } from "@/features/campaign-intelligence";

import { runStudioDiscoveryAction } from "../../actions/run-studio-discovery-action";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { deriveCreatorQuantityRecommendation } from "../../services/creator-quantity";
import { resolveStudioDiscoverySufficiency } from "../../services/studio-discovery-sufficiency";
import { resolveStudioCreatorShortfall } from "../../services/studio-creator-shortfall";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type CreatorsMixHeaderProps = {
  campaignObject?: CampaignObject;
  discoveryStatus: CampaignStudioSectionStatus;
  conversationId?: string;
  onCampaignObjectUpdated?: (campaignObject: Record<string, unknown>) => void;
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";
  if (confidence > 0) return "Low";
  return "Unknown";
}

export function CreatorsMixHeader({
  campaignObject,
  discoveryStatus,
  conversationId,
  onCampaignObjectUpdated,
}: CreatorsMixHeaderProps) {
  const [running, startRun] = useTransition();
  // A failed search is its own outcome. Nothing is persisted on failure, so the
  // stage keeps its previous state and this line says the search failed rather
  // than letting it read as "searched, zero results".
  const [searchFailure, setSearchFailure] = useState<string | null>(null);
  const facts = getCampaignFacts(campaignObject);
  const quantity = deriveCreatorQuantityRecommendation(facts);
  const sufficiency = resolveStudioDiscoverySufficiency(
    campaignObject,
    discoveryStatus === "running"
  );
  const required = quantity.recommended;
  const qualified = sufficiency.qualifiedCount;
  const missing =
    required != null && qualified < required ? required - qualified : 0;
  // The slate never pads with an off-strategy creator, so a short slate is a
  // real supply outcome. Say so in one line instead of leaving the operator to
  // read it out of two stat tiles.
  const shortfall = resolveStudioCreatorShortfall({
    requestedCount: required,
    recommendedCount: qualified,
  });
  // Offered while a confirmed profile exists and inventory has not been
  // searched, and again after a search that returned nothing so the operator
  // can re-run once filters or inventory change.
  const canRunDiscovery =
    Boolean(conversationId) &&
    sufficiency.factsConfirmed &&
    (sufficiency.state === "discovery_ready" || sufficiency.state === "no_inventory");

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1D9E75]">
        Recommended creator mix
      </p>
      {required == null ? (
        <h3 className="mt-1 text-lg font-extrabold tracking-tight">
          Creator quantity cannot yet be determined.
        </h3>
      ) : (
        /*
          "Recommended quantity", not "N creators recommended": the second
          reading collides with the slate count, and the page already used the
          word "recommended" for both the quantity the brief asks for and the
          creators actually on the slate.
        */
        <h3 className="mt-1 text-lg font-extrabold tracking-tight">
          Recommended quantity: {required} creators
        </h3>
      )}
      {/*
        Confidence in the recommended QUANTITY, computed from budget, duration
        and objective evidence. It says nothing about whether creators have been
        found — the tiles below are that fact.
      */}
      <p className="mt-1 text-sm text-muted-foreground">
        Quantity confidence: {confidenceLabel(quantity.confidence)}
      </p>
      <p className="mt-2 text-sm text-foreground">{quantity.rationale}</p>
      {quantity.evidence.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {quantity.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {/*
        The one quantity / coverage summary on the Creators screen.
        `Qualified` is the campaign slate as the campaign object holds it
        (`recommendations.creatorIds`), which is also the "Recommended" chip on
        the Discovery pipeline below — the two are the same number by
        construction, not two measurements.
      */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Required" value={required == null ? "—" : String(required)} />
        <Stat label="On slate" value={String(qualified)} />
        <Stat label="Short" value={String(missing)} />
        <Stat label="Discovery" value={sufficiency.title} />
      </div>
      {shortfall.summary ? (
        <p className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {shortfall.summary}
        </p>
      ) : null}
      {/*
        `sufficiency.detail` and `Action: nextAction` used to be repeated here
        AND in the Discovery section immediately below, word for word — the
        enrichment sentence appeared twice before the operator reached a single
        creator. The Discovery block owns that explanation; this block owns the
        numbers, and the tile above carries the state so the two do not drift.
      */}

      {searchFailure ? (
        <p className="mt-2 text-sm font-semibold text-destructive">
          Discovery search failed: {searchFailure}
        </p>
      ) : null}

      {canRunDiscovery ? (
        <Button
          type="button"
          size="sm"
          className={`mt-3 ${STUDIO_CLASSES.primaryBtn}`}
          disabled={running}
          onClick={() =>
            startRun(async () => {
              setSearchFailure(null);
              const result = await runStudioDiscoveryAction({ conversationId: conversationId! });
              if (!result.ok) {
                setSearchFailure(result.message);
                toast.error(result.message);
                return;
              }
              onCampaignObjectUpdated?.(result.campaignObject);
              if (result.creatorCount === 0) toast.info(result.message);
              else toast.success(result.message);
            })
          }
        >
          {running ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              Searching Discovery…
            </>
          ) : (
            <>
              <SearchIcon className="size-3.5" />
              Run Discovery
            </>
          )}
        </Button>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}
