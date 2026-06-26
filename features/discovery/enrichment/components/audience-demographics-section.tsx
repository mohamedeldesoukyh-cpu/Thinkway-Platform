import { GlobeIcon, UsersRoundIcon, MapPinIcon, CakeIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { DataSourceBadge, type DataSource } from "./data-source-badge";
import type { DemographicSource } from "../status";

/**
 * Self-contained "Audience Demographics" section (spec §6/§7).
 *
 * Renders age distribution, gender split, top countries and top cities. Shows a
 * clean "Unavailable" state when data is NULL — it NEVER fabricates values. The
 * provenance badge reflects the real provider (Actual / Manual / Unavailable).
 */

export type AudienceDemographics = {
  age: {
    "13_17": number | null;
    "18_24": number | null;
    "25_34": number | null;
    "35_44": number | null;
    "45_54": number | null;
    "55_plus": number | null;
  };
  gender: {
    male: number | null;
    female: number | null;
    unknown: number | null;
  };
  topCountries: Array<{ code?: string; name?: string; percent?: number }> | null;
  topCities: Array<{ name?: string; percent?: number }> | null;
  source: DemographicSource;
};

const AGE_LABELS: Array<[keyof AudienceDemographics["age"], string]> = [
  ["13_17", "13–17"],
  ["18_24", "18–24"],
  ["25_34", "25–34"],
  ["35_44", "35–44"],
  ["45_54", "45–54"],
  ["55_plus", "55+"],
];

function badgeForSource(source: DemographicSource): DataSource {
  if (source === "unavailable") return "unavailable";
  if (source === "manual") return "manual";
  return "actual";
}

function pctLabel(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value).toFixed(0)}%`;
}

function hasAge(age: AudienceDemographics["age"]): boolean {
  return AGE_LABELS.some(([key]) => age[key] != null);
}

function hasGender(gender: AudienceDemographics["gender"]): boolean {
  return gender.male != null || gender.female != null || gender.unknown != null;
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      <span aria-hidden className="text-muted-foreground/80">
        {icon}
      </span>
      {children}
    </h4>
  );
}

function Bar({ value }: { value: number | null }) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function UnavailableNote() {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
      Audience demographics are not available for this creator yet. They populate
      automatically when a demographics provider (e.g. Modash) is connected.
    </p>
  );
}

export function AudienceDemographicsSection({
  demographics,
  className,
}: {
  demographics: AudienceDemographics;
  className?: string;
}) {
  const available = demographics.source !== "unavailable";
  const showAge = available && hasAge(demographics.age);
  const showGender = available && hasGender(demographics.gender);
  const showCountries =
    available && Array.isArray(demographics.topCountries) && demographics.topCountries.length > 0;
  const showCities =
    available && Array.isArray(demographics.topCities) && demographics.topCities.length > 0;

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <UsersRoundIcon className="size-3.5 text-muted-foreground/80" aria-hidden />
          Audience Demographics
        </h3>
        <DataSourceBadge
          source={badgeForSource(demographics.source)}
          label={demographics.source === "unavailable" ? "Unavailable" : undefined}
        />
      </div>

      {!showAge && !showGender && !showCountries && !showCities ? (
        <UnavailableNote />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {showAge ? (
            <div className="space-y-2.5">
              <SectionTitle icon={<CakeIcon className="size-3.5" />}>Age</SectionTitle>
              <ul className="space-y-2">
                {AGE_LABELS.map(([key, label]) => (
                  <li key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">
                        {pctLabel(demographics.age[key])}
                      </span>
                    </div>
                    <Bar value={demographics.age[key]} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showGender ? (
            <div className="space-y-2.5">
              <SectionTitle icon={<UsersRoundIcon className="size-3.5" />}>
                Gender
              </SectionTitle>
              <ul className="space-y-2">
                {[
                  ["Female", demographics.gender.female] as const,
                  ["Male", demographics.gender.male] as const,
                  ["Unknown", demographics.gender.unknown] as const,
                ].map(([label, value]) => (
                  <li key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{pctLabel(value)}</span>
                    </div>
                    <Bar value={value} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showCountries ? (
            <div className="space-y-2.5">
              <SectionTitle icon={<GlobeIcon className="size-3.5" />}>
                Top countries
              </SectionTitle>
              <ul className="space-y-1.5">
                {demographics.topCountries!.slice(0, 5).map((c, i) => (
                  <li
                    key={`${c.code ?? c.name ?? i}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-foreground">{c.name ?? c.code ?? "—"}</span>
                    <span className="font-medium tabular-nums text-muted-foreground">
                      {pctLabel(c.percent ?? null)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showCities ? (
            <div className="space-y-2.5">
              <SectionTitle icon={<MapPinIcon className="size-3.5" />}>Top cities</SectionTitle>
              <ul className="space-y-1.5">
                {demographics.topCities!.slice(0, 5).map((c, i) => (
                  <li
                    key={`${c.name ?? i}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-foreground">{c.name ?? "—"}</span>
                    <span className="font-medium tabular-nums text-muted-foreground">
                      {pctLabel(c.percent ?? null)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
