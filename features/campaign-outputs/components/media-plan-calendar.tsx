"use client";

import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import type { MediaPlanData, MediaPlanDay, MediaPlanDayType } from "../generators/media-plan";
import {
  formatDayColumnDate,
  formatWeekRangeLabel,
  parseCampaignStartDate,
} from "../media-plan-week-range";
import {
  MEDIA_PLAN_AD_TYPE_COLORS,
  MEDIA_PLAN_BRAND,
  MEDIA_PLAN_DAY_TYPE_COLORS,
} from "./media-plan-brand";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_STYLES: Record<MediaPlanDayType, { dot: string }> = {
  content: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.content },
  stories: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.stories },
  boost: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.boost },
  monitoring: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.monitoring },
};

const GENERIC_OPERATIONAL_TYPES = new Set([
  "Stories",
  "Paid amplification",
  "Reporting",
  "Stories slot",
  "Performance review",
]);

function typesForDay(day: MediaPlanDay): string[] {
  const primary = day.serviceTypes?.length
    ? day.serviceTypes
    : day.serviceType?.trim()
      ? [day.serviceType]
      : [];
  const additional =
    day.additionalDeliverables?.map((entry) => entry.serviceType).filter((type): type is string =>
      Boolean(type?.trim())
    ) ?? [];
  return [...new Set([...primary, ...additional])];
}

function collectLegendTypes(data: MediaPlanData): string[] {
  const fromDays = data.weeks.flatMap((w) => w.days.flatMap((d) => typesForDay(d)));
  const fromData = data.serviceTypes?.length ? data.serviceTypes : fromDays;
  return [...new Set(fromData)].filter(
    (type): type is string => Boolean(type?.trim() && !GENERIC_OPERATIONAL_TYPES.has(type))
  );
}

function buildAdTypeColorMap(types: string[]): Map<string, string> {
  return new Map(
    types.map((type, index) => [
      type,
      MEDIA_PLAN_AD_TYPE_COLORS[index % MEDIA_PLAN_AD_TYPE_COLORS.length]!,
    ])
  );
}

function BrandDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

function ServiceChips({
  types,
  typeColorMap,
  fallback,
}: {
  types: string[];
  typeColorMap: Map<string, string>;
  fallback: string;
}) {
  if (!types.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 text-[8px] font-medium"
          style={{ color: MEDIA_PLAN_BRAND.muted }}
        >
          <BrandDot color={typeColorMap.get(type) ?? fallback} className="size-1.5" />
          <span className="line-clamp-1">{type}</span>
        </span>
      ))}
    </div>
  );
}

const CreatorCard = memo(function CreatorCard({
  name,
  types,
  avatarUrl,
  profileUrl,
  typeColorMap,
  dotFallback,
}: {
  name: string;
  types: string[];
  avatarUrl?: string | null;
  profileUrl?: string | null;
  typeColorMap: Map<string, string>;
  dotFallback: string;
}) {
  return (
    <div className="rounded-lg border border-[#0B0F1A]/6 bg-[#fafbff] p-1.5">
      <div className="mb-1 flex items-center gap-1.5">
        <CreatorAvatarImage
          avatarUrl={avatarUrl ?? null}
          profileUrl={profileUrl ?? null}
          size="xs"
          className="shrink-0 ring-1 ring-[#0B0F1A]/6"
          alt={name}
        />
        <span
          className="truncate text-[9px] font-semibold"
          style={{ color: MEDIA_PLAN_BRAND.ink }}
        >
          {name}
        </span>
      </div>
      <ServiceChips types={types} typeColorMap={typeColorMap} fallback={dotFallback} />
    </div>
  );
});

const DayColumn = memo(function DayColumn({
  day,
  dayIndex,
  weekNum,
  campaignStart,
  typeColorMap,
}: {
  day: MediaPlanDay;
  dayIndex: number;
  weekNum: number;
  campaignStart: Date;
  typeColorMap: Map<string, string>;
}) {
  const style = TYPE_STYLES[day.type];
  const dateStr = day.dateLabel ?? formatDayColumnDate(campaignStart, weekNum, dayIndex);
  const dayAbbr = (DAY_ABBR[dayIndex] ?? day.day).toUpperCase();

  return (
    <div className="flex min-h-[5.5rem] flex-col overflow-hidden rounded-[10px] border border-[#0B0F1A]/6 bg-white">
      <div
        className="flex items-center justify-between border-b border-[#0B0F1A]/4 px-2 py-1"
        style={{ backgroundColor: "rgba(0,87,255,0.06)" }}
      >
        <span
          className="text-[8px] font-extrabold tracking-[0.08em]"
          style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
        >
          {dayAbbr}
        </span>
        <span className="font-mono text-[8px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
          {dateStr}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1">
        {day.creator ? (
          <>
            <CreatorCard
              name={day.shortName ?? day.creator ?? ""}
              types={
                day.serviceTypes?.length
                  ? day.serviceTypes
                  : day.serviceType?.trim()
                    ? [day.serviceType]
                    : typesForDay(day)
              }
              avatarUrl={day.avatarUrl}
              profileUrl={day.profileUrl}
              typeColorMap={typeColorMap}
              dotFallback={style.dot}
            />
            {(day.additionalDeliverables ?? []).map((entry, index) => (
              <CreatorCard
                key={`${entry.creatorId ?? entry.creator ?? index}`}
                name={entry.shortName ?? entry.creator ?? "Creator"}
                types={
                  entry.serviceTypes?.length
                    ? entry.serviceTypes
                    : entry.serviceType?.trim()
                      ? [entry.serviceType]
                      : []
                }
                avatarUrl={entry.avatarUrl}
                profileUrl={entry.profileUrl}
                typeColorMap={typeColorMap}
                dotFallback={style.dot}
              />
            ))}
          </>
        ) : (
          <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-lg border border-[#0B0F1A]/6 bg-white p-1.5">
            {typesForDay(day).length > 0 ? (
              <ServiceChips
                types={typesForDay(day)}
                typeColorMap={typeColorMap}
                fallback={style.dot}
              />
            ) : (
              <span className="text-[9px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {day.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Visual Media Plan — weekblock / daycol / ccard layout aligned with export reference.
 */
export function MediaPlanCalendar({
  data,
  orientation = "portrait",
}: {
  data: MediaPlanData;
  orientation?: "portrait" | "landscape";
}) {
  const landscape = orientation === "landscape";
  const legendTypes = useMemo(() => collectLegendTypes(data), [data]);
  const typeColorMap = useMemo(() => buildAdTypeColorMap(legendTypes), [legendTypes]);
  const campaignStart = useMemo(
    () => parseCampaignStartDate(data.campaignStartDate),
    [data.campaignStartDate]
  );
  const slotLabel =
    data.postingSlotCount && data.postingSlotCount !== data.creatorCount
      ? `${data.postingSlotCount} ad slots · ${data.creatorCount} creators`
      : data.postingSlotCount
        ? `${data.postingSlotCount} deliverables`
        : `${data.creatorCount} creators`;

  return (
    <div
      className="space-y-4 rounded-2xl border border-[#0B0F1A]/6 p-4 sm:p-5"
      style={{ backgroundColor: MEDIA_PLAN_BRAND.lavender }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm"
          style={{ background: MEDIA_PLAN_BRAND.gradient }}
        >
          {data.durationWeeks} weeks · {slotLabel}
        </span>
        {legendTypes.length > 0 ? (
          <span
            className="text-[10px] font-extrabold uppercase tracking-[0.5px]"
            style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
          >
            Ad types
          </span>
        ) : null}
        {legendTypes.map((type) => (
          <span
            key={type}
            className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border border-[#0B0F1A]/8 bg-white px-2.5 py-0.5 text-[10px] font-medium shadow-sm"
            style={{ color: MEDIA_PLAN_BRAND.ink }}
          >
            <BrandDot color={typeColorMap.get(type) ?? MEDIA_PLAN_BRAND.muted} className="size-2" />
            <span className="truncate">{type}</span>
          </span>
        ))}
      </div>

      <div className={cn("space-y-5", landscape ? "w-full" : "min-w-[720px] overflow-x-auto")}>
        {data.weeks.map((week) => (
          <div key={week.week} className="weekblock">
            <div className="mb-2 flex flex-wrap items-baseline gap-3">
              <span
                className="text-[10px] font-extrabold tracking-[0.12em]"
                style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
              >
                WEEK {week.week}
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
              >
                {formatWeekRangeLabel(campaignStart, week.week)}
              </span>
              <span className="ml-auto text-[10px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {week.phase} · Wave {week.wave}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {week.days.map((day, dayIndex) => (
                <DayColumn
                  key={`${week.week}-${day.day}`}
                  day={day}
                  dayIndex={dayIndex}
                  weekNum={week.week}
                  campaignStart={campaignStart}
                  typeColorMap={typeColorMap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
