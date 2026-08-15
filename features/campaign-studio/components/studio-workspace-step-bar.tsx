"use client";

import { Fragment } from "react";

import { cn } from "@/lib/utils";

import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import type { StudioWorkspaceStepView } from "../services/studio-workspace-status";
import { STUDIO_WORKSPACE_STATUS_LABEL } from "../services/studio-workspace-status";
import type { StudioWorkspaceStepId } from "../constants/studio-workspace";

type StudioWorkspaceStepBarProps = {
  steps: StudioWorkspaceStepView[];
  activeStepId: StudioWorkspaceStepId;
  onNavigate: (stepId: StudioWorkspaceStepId) => void;
};

export function StudioWorkspaceStepBar({
  steps,
  activeStepId,
  onNavigate,
}: StudioWorkspaceStepBarProps) {
  return (
    <div className={STUDIO_REF_CLASSES.stepBar} role="tablist" aria-label="Campaign planning steps">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <button
            type="button"
            role="tab"
            aria-selected={step.id === activeStepId}
            className={cn(
              STUDIO_REF_CLASSES.stepChip,
              step.id === activeStepId && STUDIO_REF_CLASSES.stepChipActive
            )}
            onClick={() => onNavigate(step.id)}
          >
            <span className={STUDIO_REF_CLASSES.stepChipNum}>{index + 1}</span>
            <span className={STUDIO_REF_CLASSES.stepChipText}>
              <b>{step.label}</b>
              <span>{STUDIO_WORKSPACE_STATUS_LABEL[step.status]}</span>
            </span>
          </button>
          {index < steps.length - 1 ? (
            <div className={STUDIO_REF_CLASSES.stepChipConnector} aria-hidden />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
