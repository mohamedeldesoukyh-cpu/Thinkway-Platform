"use client";

import { cn } from "@/lib/utils";

import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import type { StudioWorkspaceStepView } from "../services/studio-workspace-status";
import { STUDIO_WORKSPACE_STATUS_LABEL } from "../services/studio-workspace-status";
import type { StudioWorkspaceStepId } from "../constants/studio-workspace";
import { useStudioRefMode } from "../hooks/use-studio-ref-mode";

type StudioWorkspaceNavProps = {
  steps: StudioWorkspaceStepView[];
  activeStepId: StudioWorkspaceStepId;
  onNavigate: (stepId: StudioWorkspaceStepId) => void;
  campaignTitle?: string;
  embedded?: boolean;
};

function flagClass(status: StudioWorkspaceStepView["status"]): string | null {
  if (status === "blocked" || status === "outdated") {
    return STUDIO_REF_CLASSES.stepFlagRisk;
  }
  if (status === "in_progress") {
    return STUDIO_REF_CLASSES.stepFlagWarn;
  }
  return null;
}

export function StudioWorkspaceNav({
  steps,
  activeStepId,
  onNavigate,
  campaignTitle,
  embedded = false,
}: StudioWorkspaceNavProps) {
  const refMode = useStudioRefMode();

  if (refMode && !embedded) {
    return (
      <nav className={STUDIO_REF_CLASSES.rail} aria-label="Campaign planning steps">
        <h6 className={STUDIO_REF_CLASSES.railHead}>Planning</h6>
        {steps.map((step, index) => {
          const active = step.id === activeStepId;
          const flag = flagClass(step.status);
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onNavigate(step.id)}
              className={cn(STUDIO_REF_CLASSES.step, active && STUDIO_REF_CLASSES.stepOn)}
              aria-current={active ? "step" : undefined}
            >
              <span className={STUDIO_REF_CLASSES.railStepNum}>{index + 1}</span>
              <span>
                <b>
                  {step.label}
                  {flag ? (
                    <span className={cn(STUDIO_REF_CLASSES.stepFlag, flag)} aria-hidden />
                  ) : null}
                </b>
                <u>{STUDIO_WORKSPACE_STATUS_LABEL[step.status]}</u>
              </span>
            </button>
          );
        })}
        <div className={STUDIO_REF_CLASSES.railSep} />
        {campaignTitle ? (
          <p className="truncate px-1 text-[11px] text-[var(--cs-mut,#64748B)]">{campaignTitle}</p>
        ) : null}
      </nav>
    );
  }

  return (
    <nav
      className={cn(embedded ? "p-3" : STUDIO_REF_CLASSES.navigator, "min-w-0")}
      aria-label="Campaign planning steps"
    >
      {campaignTitle ? (
        <p className="mb-3 truncate px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          {campaignTitle}
        </p>
      ) : null}
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {steps.map((step, index) => {
          const active = step.id === activeStepId;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onNavigate(step.id)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                  active
                    ? "bg-[#EFF4FF] text-[#0B52E0]"
                    : "text-foreground/80 hover:bg-muted/60"
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold",
                    step.complete && step.status !== "outdated"
                      ? "bg-[#0C9D57] text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{step.label}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {STUDIO_WORKSPACE_STATUS_LABEL[step.status]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
