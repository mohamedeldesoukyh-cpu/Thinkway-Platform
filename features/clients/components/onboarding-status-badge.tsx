import { Badge } from "@/components/ui/badge";
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_TONE,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { STATUS_TONE_CLASS } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";

type OnboardingStatusBadgeProps = {
  status: ClientOnboardingStatus;
  className?: string;
};

export function OnboardingStatusBadge({ status, className }: OnboardingStatusBadgeProps) {
  const tone = ONBOARDING_STATUS_TONE[status];
  const label = ONBOARDING_STATUS_LABELS[status];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
