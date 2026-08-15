"use client";

import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignObject } from "@/features/campaign-intelligence";

import { deriveCreatorQuantityRecommendation } from "../../services/creator-quantity";
import { resolveStudioDiscoverySufficiency } from "../../services/studio-discovery-sufficiency";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type CreatorsMixHeaderProps = {
  campaignObject?: CampaignObject;
  discoveryStatus: CampaignStudioSectionStatus;
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";
  if (confidence > 0) return "Low";
  return "Unknown";
}

export function CreatorsMixHeader({ campaignObject, discoveryStatus }: CreatorsMixHeaderProps) {
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
        <h3 className="mt-1 text-lg font-extrabold tracking-tight">
          {required} creators recommended
        </h3>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        Confidence: {confidenceLabel(quantity.confidence)}
      </p>
      <p className="mt-2 text-sm text-foreground">{quantity.rationale}</p>
      {quantity.evidence.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {quantity.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Required" value={required == null ? "—" : String(required)} />
        <Stat label="Qualified" value={String(qualified)} />
        <Stat label="Missing" value={String(missing)} />
        <Stat label="Discovery" value={sufficiency.title} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{sufficiency.detail}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">Action: {sufficiency.nextAction}</p>
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
