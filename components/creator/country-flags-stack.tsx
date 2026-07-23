"use client";

import { CountryFlagBadge, type CountryFlagBadgeOverlaySize } from "@/components/creator/country-flag-badge";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { cn } from "@/lib/utils";

type CountryFlagsStackProps = {
  countryCodes: string[] | null | undefined;
  size?: CountryFlagBadgeOverlaySize;
  className?: string;
  overlay?: boolean;
  /** Max overlapping flags to render (defaults to 3). */
  maxVisible?: number;
};

function normalizeCountryCodes(codes: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const code of codes ?? []) {
    const resolved = normalizeCountryCode(code);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    normalized.push(resolved);
  }
  return normalized;
}

function overlapClass(count: number): string {
  if (count <= 2) return "-ml-2";
  return "-ml-1.5";
}

/** Overlapping circular country flags for multi-location creators (avatar overlay pattern). */
export function CountryFlagsStack({
  countryCodes,
  size = "md",
  className,
  overlay = true,
  maxVisible = 3,
}: CountryFlagsStackProps) {
  const codes = normalizeCountryCodes(countryCodes).slice(0, maxVisible);
  if (codes.length === 0) return null;

  if (codes.length === 1) {
    return (
      <CountryFlagBadge
        countryCode={codes[0]}
        size={size}
        overlay={overlay}
        className={className}
      />
    );
  }

  return (
    <span
      className={cn("inline-flex items-center", className)}
      aria-label={codes.join(", ")}
      title={codes.join(", ")}
    >
      {codes.map((code, index) => (
        <span
          key={code}
          className={cn("relative shrink-0", index > 0 && overlapClass(codes.length))}
          style={{ zIndex: index + 1 }}
        >
          <CountryFlagBadge countryCode={code} size={size} overlay={overlay} />
        </span>
      ))}
    </span>
  );
}

export { resolveCreatorCountryCodes };
