"use client";

import { Fragment } from "react";

import { cn } from "@/lib/utils";

import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import type { StudioStoryPhase } from "../constants/studio-layout";
import type { CampaignStudioSection } from "../types/campaign-studio";

type StudioStepBarProps = {
  phases: Array<StudioStoryPhase<CampaignStudioSection>>;
  activePhaseId: string;
  onNavigatePhase: (phaseId: string) => void;
};

export function studioPhaseDomId(
  phaseId: string,
  variant: "default" | "ref" = "default"
): string {
  return variant === "ref" ? `step-${phaseId}` : `studio-phase-${phaseId}`;
}

export function StudioStepBar({ phases, activePhaseId, onNavigatePhase }: StudioStepBarProps) {
  return (
    <div className={STUDIO_REF_CLASSES.stepBar} role="tablist" aria-label="Campaign story phases">
      {phases.map((phase, index) => (
        <Fragment key={phase.id}>
          <button
            type="button"
            role="tab"
            aria-selected={phase.id === activePhaseId}
            className={cn(
              STUDIO_REF_CLASSES.stepChip,
              phase.id === activePhaseId && STUDIO_REF_CLASSES.stepChipActive
            )}
            onClick={() => onNavigatePhase(phase.id)}
          >
            <span className={STUDIO_REF_CLASSES.stepChipNum}>{index + 1}</span>
            <span className={STUDIO_REF_CLASSES.stepChipText}>
              <b>{phase.label}</b>
              <span>{phase.sections.length} sections</span>
            </span>
          </button>
          {index < phases.length - 1 ? (
            <div className={STUDIO_REF_CLASSES.stepChipConnector} aria-hidden />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
