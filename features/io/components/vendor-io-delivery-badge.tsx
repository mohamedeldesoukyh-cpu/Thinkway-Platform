"use client";

import {
  formatVendorIoDeliveryLabel,
} from "@/lib/io/vendor-io-delivery";
import { cn } from "@/lib/utils";

type Props = {
  deliveryMethod: string | null | undefined;
  deliveryStatus: string | null | undefined;
  className?: string;
};

export function VendorIoDeliveryBadge({
  deliveryMethod,
  deliveryStatus,
  className,
}: Props) {
  const label = formatVendorIoDeliveryLabel(deliveryMethod, deliveryStatus);
  if (!label) return null;

  const toneClass =
    deliveryStatus === "failed"
      ? "thinkway-campaign-badge-red"
      : deliveryMethod === "manual"
        ? "thinkway-campaign-badge-gray"
        : "thinkway-campaign-badge-green";

  return (
    <span className={cn("thinkway-campaign-badge", toneClass, className)}>
      {label}
    </span>
  );
}
