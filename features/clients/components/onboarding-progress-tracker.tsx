import { CheckCircle2Icon, CircleIcon } from "lucide-react";

import {
  computeOnboardingProgress,
  type ClientOnboardingStatus,
  type OnboardingCompletionFields,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

import { OnboardingStatusBadge } from "./onboarding-status-badge";

type OnboardingProgressTrackerProps = {
  status: ClientOnboardingStatus;
  completion: OnboardingCompletionFields;
  className?: string;
  compact?: boolean;
};

export function OnboardingProgressTracker({
  status,
  completion,
  className,
  compact = false,
}: OnboardingProgressTrackerProps) {
  const progress = computeOnboardingProgress(completion);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        compact && "p-3",
        className
      )}
      aria-label="Client onboarding progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            Onboarding progress
          </h3>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              Complete legal, finance, contracts, and tax before activating for campaigns.
            </p>
          ) : null}
        </div>
        <OnboardingStatusBadge status={status} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percentage}%` }}
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress.percentage}% onboarding complete`}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {progress.percentage}%
        </span>
      </div>

      <ul className={cn("mt-3 space-y-2", compact && "mt-2 space-y-1.5")}>
        {progress.sections.map((section) => (
          <li key={section.id} className="flex items-center gap-2 text-sm">
            {section.completed ? (
              <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <CircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={section.completed ? "text-foreground" : "text-muted-foreground"}>
              {section.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
