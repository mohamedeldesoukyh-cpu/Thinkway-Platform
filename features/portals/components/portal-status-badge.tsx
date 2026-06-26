"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  formatPortalStatusLabel,
  normalizePortalStatusKey,
  resolveStatusTone,
} from "@/components/shared/status/status-utils";

export function PortalStatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = normalizePortalStatusKey(value);
  const label = formatPortalStatusLabel(normalized);

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("portal", normalized)}
    />
  );
}
