"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { STUDIO_PHASE_NAV, DEFAULT_PHASE_NAV } from "../constants/studio-nav-config";
import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import type { StudioWorkspaceStepView } from "../services/studio-workspace-status";
import { STUDIO_WORKSPACE_STATUS_LABEL } from "../services/studio-workspace-status";
import type { StudioWorkspaceStepId } from "../constants/studio-workspace";

type StudioWorkspaceNavProps = {
  steps: StudioWorkspaceStepView[];
  activeStepId: StudioWorkspaceStepId;
  onNavigate: (stepId: StudioWorkspaceStepId) => void;
  campaignTitle?: string;
  embedded?: boolean;
};

function statusClass(status: StudioWorkspaceStepView["status"]): string {
  if (status === "outdated") return "text-amber-700 dark:text-amber-300";
  if (status === "blocked") return "text-amber-800 dark:text-amber-200";
  if (status === "in_progress") return "text-violet-700 dark:text-violet-300";
  if (status === "ready") return "text-[#0C9D57]";
  return "text-muted-foreground";
}

export function StudioWorkspaceNav({
  steps,
  activeStepId,
  onNavigate,
  campaignTitle,
  embedded = false,
}: StudioWorkspaceNavProps) {
  return (
    <nav
      className={cn(
        embedded ? "p-3" : STUDIO_REF_CLASSES.navigator,
        "min-w-0"
      )}
      aria-label="Campaign planning steps"
    >
      {campaignTitle ? (
        <p className="mb-3 truncate px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          {campaignTitle}
        </p>
      ) : null}
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {steps.map((step, index) => {
          const nav = STUDIO_PHASE_NAV[step.id] ?? DEFAULT_PHASE_NAV;
          const Icon = nav.icon;
          const active = step.id === activeStepId;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onNavigate(step.id)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/5"
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold",
                    step.complete && step.status !== "outdated"
                      ? "bg-[#0C9D57] text-white"
                      : nav.iconBgClass
                  )}
                >
                  {step.complete && step.status !== "outdated" ? (
                    <CheckIcon className="size-3.5" aria-hidden />
                  ) : (
                    <Icon className={cn("size-3.5", nav.iconTextClass)} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">
                    {index + 1}. {step.label}
                  </span>
                  <span className={cn("block text-[10px] font-semibold uppercase tracking-wide", statusClass(step.status))}>
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
