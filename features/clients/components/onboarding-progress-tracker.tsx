import { CheckCircle2Icon, CircleIcon } from "lucide-react";

import {
  computeOnboardingProgress,
  deriveOnboardingStatusFromCompletion,
  formatOnboardingProgressDetail,
  getIncompleteOnboardingSectionLabels,
  isOnboardingSectionApplicable,
  type ClientOnboardingStatus,
  type OnboardingCompletionFields,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

import { OnboardingStatusBadge } from "./onboarding-status-badge";

type OnboardingProgressTrackerProps = {
  status: ClientOnboardingStatus;
  completion: OnboardingCompletionFields;
  creditLimitActive?: boolean;
  className?: string;
  compact?: boolean;
};

export function OnboardingProgressTracker({
  status,
  completion,
  creditLimitActive = false,
  className,
  compact = false,
}: OnboardingProgressTrackerProps) {
  const derivationInput = { ...completion, credit_limit_active: creditLimitActive };
  const displayStatus = deriveOnboardingStatusFromCompletion(derivationInput, status);
  const progress = computeOnboardingProgress(derivationInput);
  const applicableSections = progress.sections.filter((section) =>
    isOnboardingSectionApplicable(section.id, derivationInput)
  );

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
              Complete legal, finance (when credit limit is active), and tax before activating for campaigns.
            </p>
          ) : null}
        </div>
        <OnboardingStatusBadge status={displayStatus} />
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
            aria-label={formatOnboardingProgressDetail(progress, derivationInput)}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {progress.percentage >= 100 ? "Complete" : `${progress.percentage}%`}
        </span>
      </div>

      {progress.percentage < 100 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatOnboardingProgressDetail(progress, derivationInput)}
        </p>
      ) : null}

      {getIncompleteOnboardingSectionLabels(progress, derivationInput).length > 0 ? (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Still needed: {getIncompleteOnboardingSectionLabels(progress, derivationInput).join(" · ")}
        </p>
      ) : null}

      <ul className={cn("mt-3 space-y-2", compact && "mt-2 space-y-1.5")}>
        {applicableSections.map((section) => (
          <li key={section.id} className="flex items-center gap-2 text-sm">
            {section.completed ? (
              <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <CircleIcon className="size-4 shrink-0 text-amber-600" aria-hidden />
            )}
            <span
              className={
                section.completed ? "text-foreground" : "font-medium text-amber-700"
              }
            >
              {section.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
