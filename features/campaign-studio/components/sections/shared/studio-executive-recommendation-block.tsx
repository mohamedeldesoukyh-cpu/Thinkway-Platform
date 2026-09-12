"use client";

import { useEffect, useState } from "react";

import { loadStudioEciPlanningSignalsAction } from "@/features/campaign-studio/actions/studio-eci-actions";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { creatorFactualIntelligence } from "@/features/campaign-studio/services/studio-creator-factual-intelligence";

/** Labelled paragraph used across the planning blocks. */
export function ExecBlock({ title, body }: { title: string; body?: string | null }) {
  if (!body?.trim()) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-foreground">{body}</p>
    </div>
  );
}

/**
 * Creator intelligence for one creator, on this campaign — factual only.
 *
 * Rendered INSIDE Discovery's own creator detail sheet as its `contextSlot`.
 * There is one implementation of this content and one creator detail view.
 *
 * It used to render `toExecutiveCreatorDetailView` verbatim, so Creator Details
 * opened with "Not Recommended: do not prioritize esraafahmy for this
 * campaign", a decision narrative, and "Business value: High Risk". That is the
 * internal decision layer. It still exists and still shows where it belongs —
 * the creator card and the recommendation groups, from
 * `resolveCampaignCreatorDecision`.
 *
 * Here the operator gets measurements and evidence. Negative facts stay
 * visible; absent ones are named as absent; nothing positive is invented.
 */
export function StudioExecutiveRecommendationBlock({
  creatorId,
  signal: signalProp,
  active,
}: {
  creatorId?: string | null;
  /** Already-hydrated signal from the card, when the section has one. */
  signal?: StudioEciPlanningSignal | null;
  /** Load only while the detail view is actually open. */
  active: boolean;
}) {
  const [signal, setSignal] = useState<StudioEciPlanningSignal | null>(signalProp ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active || !creatorId) {
      setSignal(signalProp ?? null);
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
    return <p className="text-sm text-muted-foreground">Loading creator intelligence…</p>;
  }

  const facts = creatorFactualIntelligence(signal);

  return (
    <div className="space-y-3.5 rounded-xl border border-border/60 bg-muted/[0.03] p-3">
      {facts.measurements.length > 0 ? (
        <div className="rounded-lg border border-[#0057FF]/20 bg-[#0057FF]/[0.03] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0057FF]">
            Measurements
          </p>
          <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {facts.measurements.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {facts.observations.length > 0 ? (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Factual campaign evidence
          </p>
          <ul className="m-0 list-none space-y-1 p-0 text-sm text-foreground">
            {facts.observations.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.missing.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/5 p-3">
          {/*
            Named explicitly. Absent data must never read as a negative
            judgement about the creator.
          */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Not available
          </p>
          <ul className="m-0 list-none space-y-1 p-0 text-sm text-muted-foreground">
            {facts.missing.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
