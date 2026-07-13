"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import type { MediaPlanData, MediaPlanDay, MediaPlanDayType } from "../generators/media-plan";
import {
  MEDIA_PLAN_AD_TYPE_COLORS,
  MEDIA_PLAN_BRAND,
  MEDIA_PLAN_DAY_TYPE_COLORS,
} from "./media-plan-brand";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_STYLES: Record<MediaPlanDayType, { dot: string; cell: string }> = {
  content: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.content, cell: "border-[#0B0F1A]/8 bg-white" },
  stories: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.stories, cell: "border-[#0B0F1A]/8 bg-white" },
  boost: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.boost, cell: "border-[#0B0F1A]/8 bg-white" },
  monitoring: { dot: MEDIA_PLAN_DAY_TYPE_COLORS.monitoring, cell: "border-[#0B0F1A]/8 bg-[#E8EFFE]/60" },
};

const GENERIC_OPERATIONAL_TYPES = new Set([
  "Stories",
  "Paid amplification",
  "Reporting",
  "Stories slot",
  "Performance review",
]);

function typesForDay(day: MediaPlanDay): string[] {
  if (day.serviceTypes?.length) return day.serviceTypes;
  if (day.serviceType?.trim()) return [day.serviceType];
  return [];
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

function borderStyleFromColors(hexColors: string[]): CSSProperties | undefined {
  if (hexColors.length === 0) return undefined;
  if (hexColors.length === 1) {
    return { borderColor: hexColors[0], borderWidth: 2 };
  }
  const segment = 360 / hexColors.length;
  const stops = hexColors
    .map((hex, index) => `${hex} ${index * segment}deg ${(index + 1) * segment}deg`)
    .join(", ");
  return {
    border: "2px solid transparent",
    background: `linear-gradient(#ffffff, #ffffff) padding-box, conic-gradient(from 0deg, ${stops}) border-box`,
  };
}

function BrandDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

function CreatorCalendarCell({
  day,
  landscape,
  typeColorMap,
}: {
  day: MediaPlanDay;
  landscape: boolean;
  typeColorMap: Map<string, string>;
}) {
  const style = TYPE_STYLES[day.type];
  const types = typesForDay(day);
  const dotColors = types.map((type) => typeColorMap.get(type) ?? style.dot);
  const borderStyle = borderStyleFromColors(dotColors);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-1.5 text-[10px] leading-tight shadow-[0_1px_3px_rgba(6,8,16,0.06)]",
        landscape ? "min-h-[5rem]" : "min-h-[5.5rem]",
        types.length > 0 ? "bg-white" : style.cell
      )}
      style={borderStyle}
      title={day.label}
    >
      {day.dateLabel ? (
        <span
          className="font-mono text-[9px] font-medium"
          style={{ color: MEDIA_PLAN_BRAND.muted }}
        >
          {day.dateLabel}
        </span>
      ) : null}
      {day.creator ? (
        <div className="flex min-w-0 items-start gap-1.5">
          <CreatorAvatarImage
            avatarUrl={day.avatarUrl ?? null}
            profileUrl={day.profileUrl ?? null}
            size={landscape ? "sm" : "xs"}
            className="mt-0.5 shrink-0 ring-1 ring-[#0B0F1A]/6"
            alt={day.shortName ?? day.creator ?? ""}
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[10px] font-semibold"
              style={{ color: MEDIA_PLAN_BRAND.ink }}
            >
              {day.shortName ?? day.creator}
            </p>
            {types.length > 0 ? (
              <ul className="mt-0.5 space-y-0.5">
                {types.map((type) => (
                  <li
                    key={type}
                    className="flex min-w-0 items-center gap-1 text-[9px] leading-snug"
                    style={{ color: MEDIA_PLAN_BRAND.muted }}
                  >
                    <BrandDot color={typeColorMap.get(type) ?? style.dot} className="size-1.5" />
                    <span className="line-clamp-1 font-medium">{type}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-1">
          {types.length > 0 ? (
            types.map((type) => (
              <span
                key={type}
                className="flex items-center gap-1 text-[9px]"
                style={{ color: MEDIA_PLAN_BRAND.muted }}
              >
                <BrandDot color={typeColorMap.get(type) ?? style.dot} className="size-1.5" />
                {type}
              </span>
            ))
          ) : (
            <>
              <BrandDot color={style.dot} className="size-1.5" />
              <span className="text-[9px]" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                {day.label}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Visual Media Plan — Thinkway brand kit styling on a weekly publishing calendar.
 * Landscape orientation widens the grid for document preview and print.
 */
export function MediaPlanCalendar({
  data,
  orientation = "portrait",
}: {
  data: MediaPlanData;
  orientation?: "portrait" | "landscape";
}) {
  const landscape = orientation === "landscape";
  const legendTypes = collectLegendTypes(data);
  const typeColorMap = buildAdTypeColorMap(legendTypes);
  const slotLabel =
    data.postingSlotCount && data.postingSlotCount !== data.creatorCount
      ? `${data.postingSlotCount} ad slots · ${data.creatorCount} creators`
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

      <div className={cn("overflow-x-auto", landscape ? "overflow-x-visible" : "")}>
        <div className={cn("space-y-2", landscape ? "w-full min-w-0" : "min-w-[720px] space-y-2")}>
          <div
            className={cn(
              "grid gap-1.5 px-1 text-[10px] font-extrabold uppercase tracking-[0.5px]",
              landscape
                ? "grid-cols-[5.5rem_repeat(7,minmax(0,1fr))]"
                : "grid-cols-[6rem_repeat(7,1fr)]"
            )}
            style={{ color: MEDIA_PLAN_BRAND.deepNavy }}
          >
            <span>Week</span>
            {DAY_ABBR.map((d) => (
              <span key={d} className="text-center">
                {d}
              </span>
            ))}
          </div>

          {data.weeks.map((week) => (
            <div
              key={week.week}
              className={cn(
                "grid gap-1.5",
                landscape
                  ? "grid-cols-[5.5rem_repeat(7,minmax(0,1fr))]"
                  : "grid-cols-[6rem_repeat(7,1fr)]"
              )}
            >
              <div
                className="flex flex-col justify-center rounded-xl px-2 py-1.5 text-white shadow-sm"
                style={{ background: MEDIA_PLAN_BRAND.gradient }}
              >
                <span className="font-mono text-xs font-bold">Week {week.week}</span>
                <span className="text-[10px] font-medium text-white/85">{week.phase}</span>
                <span className="text-[9px] text-white/65">Wave {week.wave}</span>
              </div>
              {week.days.map((day) => (
                <CreatorCalendarCell
                  key={`${week.week}-${day.day}`}
                  day={day}
                  landscape={landscape}
                  typeColorMap={typeColorMap}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[#0B0F1A]/8 bg-white shadow-sm">
          <div className="h-1" style={{ background: MEDIA_PLAN_BRAND.gradient }} />
          <div className="p-3">
            <h4
              className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.5px]"
              style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
            >
              Activation Waves
            </h4>
            <ul className="space-y-1 text-xs" style={{ color: MEDIA_PLAN_BRAND.ink }}>
              {data.waves.map((wave) => (
                <li key={wave.wave}>
                  <span className="font-semibold" style={{ color: MEDIA_PLAN_BRAND.deepNavy }}>
                    Wave {wave.wave}
                  </span>{" "}
                  — {wave.theme}{" "}
                  <span style={{ color: MEDIA_PLAN_BRAND.muted }}>(wk {wave.weeks.join(", ")})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#0B0F1A]/8 bg-white shadow-sm">
          <div className="h-1" style={{ background: MEDIA_PLAN_BRAND.gradient }} />
          <div className="p-3">
            <h4
              className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.5px]"
              style={{ color: MEDIA_PLAN_BRAND.electricBlue }}
            >
              Milestones & Windows
            </h4>
            <ul
              className="max-h-40 space-y-1 overflow-y-auto text-xs"
              style={{ color: MEDIA_PLAN_BRAND.ink }}
            >
              {data.milestones.slice(0, 12).map((m, i) => (
                <li key={`${m.type}-${m.week}-${i}`}>
                  <span className="font-mono font-medium" style={{ color: MEDIA_PLAN_BRAND.muted }}>
                    Wk {m.week}
                  </span>{" "}
                  · {m.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
