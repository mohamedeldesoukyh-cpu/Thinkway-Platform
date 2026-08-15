"use client";

import type { ReactNode } from "react";

import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import type { StudioWorkspaceStepView } from "../../services/studio-workspace-status";
import { STUDIO_WORKSPACE_STATUS_LABEL } from "../../services/studio-workspace-status";

type StudioStepShellProps = {
  step: StudioWorkspaceStepView;
  actions?: ReactNode;
  children: ReactNode;
};

export function StudioStepShell({ step, actions, children }: StudioStepShellProps) {
  return (
    <div className="min-w-0 space-y-4">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
            {STUDIO_WORKSPACE_STATUS_LABEL[step.status]}
          </p>
          <h2 className={STUDIO_REF_CLASSES.stepTitle ?? "text-xl font-extrabold tracking-tight"}>
            {step.label}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{step.question}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
