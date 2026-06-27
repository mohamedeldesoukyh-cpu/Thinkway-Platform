"use client";

import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  ONBOARDING_STATUS_LABELS,
  isClientOnboardingStatus,
  resolveClientListStatusBadges,
} from "@/lib/clients/onboarding-status";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

import { ClientStatusBadge } from "./client-status-badge";
import { OnboardingStatusBadge } from "./onboarding-status-badge";

type ClientListStatusCellProps = {
  status: ClientStatus;
  onboardingStatus: string | null | undefined;
  className?: string;
  /** Use thinkway-platform_6.html badge styling on list pages. */
  platformV6?: boolean;
};

function resolveV6BadgeClass(
  kind: "operational" | "onboarding",
  status: string
): string {
  if (kind === "operational") {
    if (status === "active") return platformV6BadgeClass("outline-green");
    return platformV6BadgeClass("gray");
  }
  if (status === "active") return platformV6BadgeClass("outline-green");
  if (status === "legal_pending") return platformV6BadgeClass("outline-amber");
  return platformV6BadgeClass("gray");
}

export function ClientListStatusCell({
  status,
  onboardingStatus,
  className,
  platformV6 = true,
}: ClientListStatusCellProps) {
  const badges = resolveClientListStatusBadges({ status, onboardingStatus });

  if (platformV6) {
    const operationalLabel =
      CLIENT_STATUS_OPTIONS.find((option) => option.value === badges.operationalStatus)
        ?.label ?? badges.operationalStatus;

    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <span className={resolveV6BadgeClass("operational", badges.operationalStatus)}>
          {operationalLabel}
        </span>
        {badges.onboardingStatus &&
        isClientOnboardingStatus(badges.onboardingStatus) ? (
          <span className={resolveV6BadgeClass("onboarding", badges.onboardingStatus)}>
            {ONBOARDING_STATUS_LABELS[badges.onboardingStatus]}
          </span>
        ) : null}
      </div>
    );
  }

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
