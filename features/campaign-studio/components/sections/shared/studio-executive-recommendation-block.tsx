"use client";

import { useEffect, useState } from "react";

import { loadStudioEciPlanningSignalsAction } from "@/features/campaign-studio/actions/studio-eci-actions";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { toExecutiveCreatorDetailView } from "@/features/campaign-studio/services/eci/executive-planning-view";

import { StudioRecommendationNarrative } from "./studio-recommendation-narrative";

/** Labelled paragraph used across the planning blocks. */
export function ExecBlock({ title, body }: { title: string; body?: string | null }) {
  if (!body?.trim()) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-foreground">{body}</p>
    </div>
  );
}

/**
 * Studio's executive planning recommendation for one creator.
 *
 * Extracted so it can be rendered INSIDE Discovery's own creator detail sheet
 * (as its `contextSlot`) as well as in the planning fallback. There is one
 * implementation of this content and one creator detail view — Discovery's.
 *
 * Nothing is fabricated: with no ECI signal the block says the recommendation
 * is not available yet.
 */
export function StudioExecutiveRecommendationBlock({
  creatorId,
  displayName,
  signal: signalProp,
  active,
}: {
  creatorId?: string | null;
  displayName?: string;
  /** Already-hydrated signal from the card, when the section has one. */
  signal?: StudioEciPlanningSignal | null;
  /** Load only while the detail view is actually open. */
  active: boolean;
}) {
  const [signal, setSignal] = useState<StudioEciPlanningSignal | null>(signalProp ?? null);
  const [loading, setLoading] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    if (!active || !creatorId) {
      setSignal(signalProp ?? null);
      setShowDetailed(false);
      return;
    }
    if (signalProp) {
      setSignal(signalProp);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadStudioEciPlanningSignalsAction([creatorId]).then((record) => {
      if (cancelled) return;
      const bare = creatorId.replace(/^inf:/, "").replace(/^dis:/, "");
      setSignal(record[bare] ?? record[creatorId] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [active, creatorId, signalProp]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Preparing executive recommendation…</p>
    );
  }

  const exec = signal ? toExecutiveCreatorDetailView(signal, displayName) : null;
  if (!exec) {
    return (
      <p className="text-sm text-muted-foreground">
        An executive recommendation is not available yet for this creator.
      </p>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="rounded-lg border border-[#0057FF]/25 bg-[#0057FF]/5 p-3 text-sm">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#0057FF]">
          Executive Recommendation
        </p>
        <p className="mt-1.5 font-semibold text-foreground">{exec.executiveRecommendation}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Planning confidence: <b>{exec.strategyConfidence.level}</b> —{" "}
          {exec.strategyConfidence.why}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Decision narrative
        </p>
        <StudioRecommendationNarrative narrative={exec.narrative} variant="full" />
      </div>

      <ExecBlock title="Campaign Contribution" body={exec.campaignContribution} />
      <ExecBlock title="Historical Evidence" body={exec.historicalEvidence} />

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-[11px] text-muted-foreground">
        <p className="font-semibold text-foreground">Why this confidence level</p>
        <p className="mt-1">{exec.strategyConfidence.evidenceSupports}</p>
        <p className="mt-1">
          <span className="font-semibold text-foreground">Assumptions:</span>{" "}
          {exec.strategyConfidence.assumptions}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-foreground">What could reduce confidence:</span>{" "}
          {exec.strategyConfidence.whatCouldReduce}
        </p>
      </div>

      <button
        type="button"
        className="text-[11px] font-semibold text-[#0057FF] hover:underline"
        onClick={() => setShowDetailed((v) => !v)}
      >
        {showDetailed ? "Hide detailed intelligence" : "Show detailed intelligence"}
      </button>

      {showDetailed ? (
        <div className="space-y-2.5">
          <ExecBlock
            title="What the planning recommendation means"
            body={exec.detailedIntelligence.investmentMeaning}
          />
          <ExecBlock
            title="What the commercial outlook means"
            body={exec.detailedIntelligence.commercialMeaning}
          />
          <ExecBlock
            title="What the audience outlook means"
            body={exec.detailedIntelligence.audienceMeaning}
          />
          <ExecBlock
            title="What the performance outlook means"
            body={exec.detailedIntelligence.performanceMeaning}
          />
          <ExecBlock
            title="What category & brand fit means"
            body={exec.detailedIntelligence.categoryBrandMeaning}
          />
        </div>
      ) : null}
    </div>
  );
}
