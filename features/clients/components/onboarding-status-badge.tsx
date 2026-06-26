import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_TONE,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

type OnboardingStatusBadgeProps = {
  status: ClientOnboardingStatus;
  className?: string;
};

export function OnboardingStatusBadge({ status, className }: OnboardingStatusBadgeProps) {
  return (
    <StatusBadge
      label={ONBOARDING_STATUS_LABELS[status]}
      tone={ONBOARDING_STATUS_TONE[status]}
      className={cn("font-medium", className)}
    />
  );
}
