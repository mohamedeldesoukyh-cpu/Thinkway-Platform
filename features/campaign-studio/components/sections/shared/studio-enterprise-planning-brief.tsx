"use client";

import { cn } from "@/lib/utils";
import {
  formatExecutiveBriefLines,
  formatExecutiveDecisionSummaryLines,
  type EnterprisePlanningNarrative,
} from "@/features/campaign-studio/services/planning-narrative";

type StudioEnterprisePlanningBriefProps = {
  narrative: EnterprisePlanningNarrative;
  className?: string;
  /** Show assumptions, open decisions, objections, CSFs, decision summary. */
  showTransparency?: boolean;
  /** Include the final Executive Decision Summary block. */
  showDecisionSummary?: boolean;
};

/**
 * Single Executive Story — same brief for Studio, Proposal, Presentation, Approval.
 */
export function StudioEnterprisePlanningBrief({
  narrative,
  className,
  showTransparency = true,
  showDecisionSummary = true,
}: StudioEnterprisePlanningBriefProps) {
  const lines = formatExecutiveBriefLines(narrative);
  const decisionLines = formatExecutiveDecisionSummaryLines(narrative);

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-[14px] border border-[#0057FF]/20 bg-[#0057FF]/5 p-3.5",
        className
      )}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#0057FF]">
        Enterprise Planning Package · Executive Brief
      </p>
      <p className="text-[12.5px] font-semibold text-foreground">
        {narrative.executiveRecommendation}
      </p>
      <ul className="m-0 list-none space-y-1.5 p-0 text-[12.5px] text-foreground">
        {lines.map((line) => (
          <li key={line.label}>
            <b>{line.label}:</b> {line.body}
          </li>
        ))}
      </ul>

      {showTransparency ? (
        <div className="space-y-1.5 border-t border-[#0057FF]/15 pt-2 text-[11px] text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Assumptions</span> (not facts)
          </p>
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {narrative.assumptions.slice(0, 4).map((a) => (
              <li key={`${a.category}-${a.statement.slice(0, 24)}`}>
                <b>{a.category}:</b> {a.statement}
              </li>
            ))}
          </ul>

          <p className="pt-1 font-semibold text-foreground">
            Executive Objections{" "}
            <span className="font-normal text-muted-foreground">
              (planning observations — not blockers)
            </span>
          </p>
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {narrative.executiveObjections.slice(0, 6).map((o) => (
              <li key={o.concern}>
                <b>{o.concern}:</b> {o.observation}
              </li>
            ))}
          </ul>

          <p className="pt-1 font-semibold text-foreground">
            Critical Success Factors
          </p>
          <p className="text-[10px]">What must happen for this strategy to succeed?</p>
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {narrative.criticalSuccessFactors.slice(0, 6).map((f) => (
              <li key={f.factor}>
                <b>{f.factor}:</b> {f.whyItMatters}
              </li>
            ))}
          </ul>

          <p className="pt-1 font-semibold text-foreground">Open Decisions</p>
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {narrative.openDecisions.slice(0, 5).map((d) => (
              <li key={d.decision}>
                {d.decision} <span className="text-muted-foreground">({d.ownerHint})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showDecisionSummary ? (
        <div className="space-y-1.5 border-t border-[#0057FF]/20 pt-2 text-[12px] text-foreground">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#0057FF]">
            Executive Decision Summary
          </p>
          <ul className="m-0 list-none space-y-1 p-0">
            {decisionLines.map((line) => (
              <li key={line.label}>
                <b>{line.label}:</b> {line.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
