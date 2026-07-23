"use client";

import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { cn } from "@/lib/utils";

type CreatorCountriesDisplayProps = {
  creator: Pick<
    UnifiedCreatorResult,
    "country_code" | "country_codes" | "estimated_country" | "platforms"
  >;
  /** Pre-resolved codes — skips merge when provided. */
  countryCodes?: string[];
  variant?: "inline" | "stacked" | "label-only" | "flags-only";
  flagSize?: "xs" | "sm" | "md" | "lg";
  className?: string;
  labelClassName?: string;
};

export function resolveCreatorCountryCodesFromCreator(
  creator: CreatorCountriesDisplayProps["creator"]
): string[] {
  return resolveCreatorCountryCodes({
    country_codes: creator.country_codes,
    country_code: creator.country_code,
    estimated_country: creator.estimated_country,
    platformAudienceCountries: creator.platforms.map((platform) => platform.audience_country),
  });
}

export function CreatorCountriesDisplay({
  creator,
  countryCodes,
  variant = "inline",
  flagSize = "sm",
  className,
  labelClassName,
}: CreatorCountriesDisplayProps) {
  const codes = countryCodes ?? resolveCreatorCountryCodesFromCreator(creator);
  const label = formatCreatorCountryLabels(creator, codes);

  if (codes.length === 0 || label === "—") return null;

  if (variant === "label-only") {
    return <span className={cn("text-sm text-muted-foreground", className)}>{label}</span>;
  }

  if (variant === "flags-only") {
    return (
      <CountryFlagsStack
        countryCodes={codes}
        size={flagSize}
        overlay
        className={className}
      />
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <CountryFlagsStack countryCodes={codes} size={flagSize} overlay />
        <span className={cn("text-sm text-muted-foreground", labelClassName)}>{label}</span>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <CountryFlagsStack countryCodes={codes} size={flagSize} overlay />
      <span className={cn("truncate text-sm text-muted-foreground", labelClassName)}>
        {label}
      </span>
    </span>
  );
}
