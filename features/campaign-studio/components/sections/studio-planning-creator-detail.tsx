"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CreatorDrawerSelection } from "@/features/campaign-decision-workspace/components/creator-drawer";
import { loadStudioEciPlanningSignalsAction } from "@/features/campaign-studio/actions/studio-eci-actions";
import type { StudioEciPlanningSignal } from "@/features/campaign-studio/services/eci/project-studio-eci-signal";
import { toExecutiveCreatorDetailView } from "@/features/campaign-studio/services/eci/executive-planning-view";
import {
  formatEngagement,
  formatFollowers,
} from "@/features/campaign-studio/components/sections/shared/format-utils";
import { StudioRecommendationNarrative } from "./shared/studio-recommendation-narrative";

type StudioPlanningCreatorDetailProps = {
  selection: CreatorDrawerSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal?: StudioEciPlanningSignal | null;
};

function ExecBlock({ title, body }: { title: string; body: string }) {
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
 * Creator Detail — decision-first executive thinking.
 * Same sheet chrome; reorganized content only (no redesign).
 */
export function StudioPlanningCreatorDetail({
  selection,
  open,
  onOpenChange,
  signal: signalProp,
}: StudioPlanningCreatorDetailProps) {
  const [signal, setSignal] = useState<StudioEciPlanningSignal | null>(signalProp ?? null);
  const [loading, setLoading] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    if (!open || !selection?.id) {
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
    void loadStudioEciPlanningSignalsAction([selection.id]).then((record) => {
      if (cancelled) return;
      const bare = selection.id!.replace(/^inf:/, "").replace(/^dis:/, "");
      setSignal(record[bare] ?? record[selection.id!] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selection?.id, signalProp]);

  const internalHref =
    selection?.id?.startsWith("inf:") && selection.id.slice(4)
      ? `/vendors/${selection.id.slice(4)}`
      : undefined;

  const exec = signal
    ? toExecutiveCreatorDetailView(signal, selection?.displayName)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Executive recommendation</SheetTitle>
          <SheetDescription>
            Decision-first planning view for this campaign — not an analytics screen.
          </SheetDescription>
        </SheetHeader>

        {selection ? (
          <div className="mt-6 space-y-3.5">
            <div className="flex items-start gap-3">
              <CreatorAvatarImage
                avatarUrl={selection.avatarUrl}
                profileUrl={selection.profileUrl}
                size="md"
                alt={selection.displayName}
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{selection.displayName}</p>
                {selection.handle ? (
                  <p className="text-sm text-muted-foreground">{selection.handle}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selection.platform ? <span className="capitalize">{selection.platform}</span> : null}
                  {selection.followers != null ? (
                    <span>{formatFollowers(selection.followers)} followers</span>
                  ) : null}
                  {selection.engagementRate != null ? (
                    <span>{formatEngagement(selection.engagementRate)} ER</span>
                  ) : null}
                </div>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Preparing executive recommendation…</p>
            ) : exec ? (
              <>
                <div className="rounded-lg border border-[#0057FF]/25 bg-[#0057FF]/5 p-3 text-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#0057FF]">
                    Executive Recommendation
                  </p>
                  <p className="mt-1.5 font-semibold text-foreground">
                    {exec.executiveRecommendation}
                  </p>
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                An executive recommendation is not available yet for this creator. Profile context
                remains below.
              </p>
            )}

            {selection.audienceSummary ? (
              <ExecBlock title="Audience snapshot" body={selection.audienceSummary} />
            ) : null}
            {selection.priceEstimate ? (
              <ExecBlock title="Estimated fee" body={selection.priceEstimate} />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selection.profileUrl ? (
                <Button
                  type="button"
                  variant="default"
                  className="bg-brand-product hover:bg-brand-product/90"
                  asChild
                >
                  <a href={selection.profileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-4" />
                    View social profile
                  </a>
                </Button>
              ) : null}
              {internalHref ? (
                <Button type="button" variant="outline" asChild>
                  <Link href={internalHref}>Open in Thinkway</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
