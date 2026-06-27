"use client";

import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { VENDOR_STATUS_OPTIONS } from "@/features/vendors/constants";
import type { InfluencerStatus } from "@/types/database";

type VendorListStatusCellProps = {
  status: InfluencerStatus;
};

function resolveV6BadgeClass(status: InfluencerStatus): string {
  if (status === "active") return platformV6BadgeClass("outline-green");
  if (status === "prospect") return platformV6BadgeClass("blue");
  if (status === "blacklisted") return platformV6BadgeClass("red");
  return platformV6BadgeClass("gray");
}

export function VendorListStatusCell({ status }: VendorListStatusCellProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

  return <span className={resolveV6BadgeClass(status)}>{label}</span>;
}
