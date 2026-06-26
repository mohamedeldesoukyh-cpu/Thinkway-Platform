import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { resolveClientListStatusBadges } from "@/lib/clients/onboarding-status";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

import { ClientStatusBadge } from "./client-status-badge";
import { OnboardingStatusBadge } from "./onboarding-status-badge";

type ClientListStatusCellProps = {
  status: ClientStatus;
  onboardingStatus: string | null | undefined;
  className?: string;
};

export function ClientListStatusCell({
  status,
  onboardingStatus,
  className,
}: ClientListStatusCellProps) {
  const badges = resolveClientListStatusBadges({ status, onboardingStatus });
  const badgeClassName = cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-medium");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ClientStatusBadge status={badges.operationalStatus} className={badgeClassName} />
      {badges.onboardingStatus ? (
        <OnboardingStatusBadge
          status={badges.onboardingStatus}
          className={badgeClassName}
        />
      ) : null}
    </div>
  );
}
