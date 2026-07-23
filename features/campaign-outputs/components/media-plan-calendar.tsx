"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVerticalIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { MediaPlanData, MediaPlanDay, MediaPlanDayType } from "../generators/media-plan";
import { isMediaPlanOpenPublishingSlot } from "../generators/media-plan";
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
import { DOCUMENT_PREVIEW_DIALOG_Z } from "./document-preview-window";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

export type MediaPlanCreatorMoveTarget = {
  creatorId: string;
  creatorName: string;
  fromWeek: number;
  fromDayIndex: number;
  toWeek: number;
  toDayIndex: number;
  deliverableTypes: string[];
  remainingTypes?: string[];
};

type DraggableCreator = {
  creatorId: string;
  name: string;
  types: string[];
  avatarUrl?: string | null;
  profileUrl?: string | null;
  week: number;
  dayIndex: number;
};

type PendingDrop = {
  creator: DraggableCreator;
  toWeek: number;
  toDayIndex: number;
};

const CREATOR_DRAG_MIME = "application/x-thinkway-creator";

function isDraggableCreator(value: unknown): value is DraggableCreator {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraggableCreator>;
  return (
    typeof candidate.creatorId === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.types) &&
    typeof candidate.week === "number" &&
    typeof candidate.dayIndex === "number"
  );
}

function readDraggedCreator(event: React.DragEvent): DraggableCreator | null {
  const raw = event.dataTransfer.getData(CREATOR_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDraggableCreator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function typesForDay(day: MediaPlanDay): string[] {
  const primary = day.serviceTypes?.length
    ? day.serviceTypes
    : day.serviceType?.trim()
      ? [day.serviceType]
      : [];
  const additional =
    day.additionalDeliverables
      ?.filter((entry) => !entry.isMirror && !entry.isCompanion)
      .map((entry) => entry.serviceType)
      .filter((type): type is string => Boolean(type?.trim())) ?? [];
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
  editable,
  draggable,
  isDragging,
  isDragGhost,
  onDragStart,
  onDragEnd,
  onClickMove,
}: {
  name: string;
  types: string[];
  avatarUrl?: string | null;
  profileUrl?: string | null;
  typeColorMap: Map<string, string>;
  dotFallback: string;
  editable?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDragGhost?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onClickMove?: () => void;
}) {
  return (
    <div
      draggable={Boolean(draggable && editable)}
      onDragStart={(event) => {
        if (!editable || !draggable) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", name);
        event.stopPropagation();
        onDragStart?.(event);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => {
        if (editable && onClickMove) onClickMove();
      }}
      className={cn(
        "rounded-lg border border-[#0B0F1A]/6 bg-[#fafbff] p-1.5 transition-[opacity,transform,box-shadow]",
        editable && draggable && "cursor-grab active:cursor-grabbing hover:border-[#0057FF]/25 hover:shadow-sm",
        isDragging && !isDragGhost && "scale-[0.97] opacity-35",
        isDragGhost && "pointer-events-none border-[#0057FF]/40 shadow-lg ring-2 ring-[#0057FF]/25",
        editable && "group/card"
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        {editable ? (
          <GripVerticalIcon
            className="size-3 shrink-0 text-[#0B0F1A]/25 group-hover/card:text-[#0057FF]/60"
            aria-hidden
          />
        ) : null}
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

function MoveCreatorPopover({
  creator,
  durationWeeks,
  open,
  onOpenChange,
  onMove,
  saving,
}: {
  creator: DraggableCreator;
  durationWeeks: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (target: MediaPlanCreatorMoveTarget) => void;
  saving?: boolean;
}) {
  const [week, setWeek] = useState(String(creator.week));
  const [dayIndex, setDayIndex] = useState(String(creator.dayIndex));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="sr-only">Move {creator.name}</span>
      </PopoverTrigger>
      <PopoverContent
        className="z-[9999] w-64 space-y-3"
        style={{ zIndex: DOCUMENT_PREVIEW_DIALOG_Z }}
        align="start"
        data-no-drag
      >
        <div>
          <p className="text-xs font-semibold text-foreground">Move creator</p>
          <p className="text-[11px] text-muted-foreground">{creator.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Week
            </label>
            <Select value={week} onValueChange={setWeek} disabled={saving}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]" style={{ zIndex: DOCUMENT_PREVIEW_DIALOG_Z + 1 }}>
                {Array.from({ length: durationWeeks }, (_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    Week {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Day
            </label>
            <Select value={dayIndex} onValueChange={setDayIndex} disabled={saving}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]" style={{ zIndex: DOCUMENT_PREVIEW_DIALOG_Z + 1 }}>
                {DAY_NAMES.map((day, index) => (
                  <SelectItem key={day} value={String(index)}>
                    {DAY_ABBR[index]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onMove({
              creatorId: creator.creatorId,
              creatorName: creator.name,
              fromWeek: creator.week,
              fromDayIndex: creator.dayIndex,
              toWeek: Number(week),
              toDayIndex: Number(dayIndex),
              deliverableTypes: creator.types.length ? creator.types : ["Activation"],
            })
          }
          className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#1D9E75] text-xs font-semibold text-white hover:bg-[#178a66] disabled:opacity-50"
        >
          {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : "Move to slot"}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function MoveDeliverablesDialog({
  pending,
  open,
  saving,
  onOpenChange,
  onConfirm,
}: {
  pending: PendingDrop | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: MediaPlanCreatorMoveTarget) => void;
}) {
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  /** Ignore the trailing pointer event from HTML5 drag-drop that otherwise auto-dismisses Radix. */
  const ignoreOutsideUntilRef = useRef(0);

  const deliverableTypes = pending?.creator.types.length
    ? pending.creator.types
    : ["Activation"];

  useEffect(() => {
    if (!open || !pending) return;
    ignoreOutsideUntilRef.current = Date.now() + 300;
    setMode("all");
    setSelectedTypes(
      pending.creator.types.length ? pending.creator.types : ["Activation"]
    );
  }, [open, pending]);

  const movedTypes =
    mode === "all"
      ? deliverableTypes
      : selectedTypes.filter((type) => deliverableTypes.includes(type));
  const remainingTypes = deliverableTypes.filter((type) => !movedTypes.includes(type));
  const canConfirm = movedTypes.length > 0 && Boolean(pending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[9999] max-w-md"
        overlayClassName="z-[9999]"
        style={{ zIndex: DOCUMENT_PREVIEW_DIALOG_Z }}
        data-no-drag
        onPointerDownOutside={(event) => {
          if (Date.now() < ignoreOutsideUntilRef.current) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (Date.now() < ignoreOutsideUntilRef.current) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Move deliverables</DialogTitle>
          <DialogDescription>
            {pending
              ? `Move ${pending.creator.name} from ${DAY_ABBR[pending.creator.dayIndex]} (Week ${pending.creator.week}) to ${DAY_ABBR[pending.toDayIndex]} (Week ${pending.toWeek}).`
              : "Choose which deliverables to move."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 hover:bg-muted/40">
            <input
              type="radio"
              name="move-mode"
              className="mt-0.5"
              checked={mode === "all"}
              onChange={() => setMode("all")}
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">Move all deliverables</span>
              <span className="text-xs text-muted-foreground">
                Moves every deliverable on this card to the new day.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 hover:bg-muted/40">
            <input
              type="radio"
              name="move-mode"
              className="mt-0.5"
              checked={mode === "selected"}
              onChange={() => setMode("selected")}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Move selected deliverables</span>
              <span className="text-xs text-muted-foreground">
                Only checked types move; the rest stay on the original day.
              </span>
              {mode === "selected" ? (
                <div className="mt-2 space-y-2 pt-2">
                  {deliverableTypes.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-xs text-foreground">
                      <Checkbox
                        checked={selectedTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          setSelectedTypes((current) =>
                            checked
                              ? [...new Set([...current, type])]
                              : current.filter((entry) => entry !== type)
                          );
                        }}
                      />
                      <span className="break-words">{type}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm || saving}
            onClick={() => {
              if (!pending || !canConfirm) return;
              onConfirm({
                creatorId: pending.creator.creatorId,
                creatorName: pending.creator.name,
                fromWeek: pending.creator.week,
                fromDayIndex: pending.creator.dayIndex,
                toWeek: pending.toWeek,
                toDayIndex: pending.toDayIndex,
                deliverableTypes: movedTypes,
                remainingTypes: remainingTypes.length ? remainingTypes : undefined,
              });
            }}
          >
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Apply move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DayColumn = memo(function DayColumn({
  day,
  dayIndex,
  weekNum,
  campaignStart,
  typeColorMap,
  editable,
  dragOver,
  draggingCreatorId,
  movePopoverCreatorId,
  durationWeeks,
  saving,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveCreator,
  onBeginDrag,
  onEndDrag,
  onOpenMovePopover,
  onCloseMovePopover,
}: {
  day: MediaPlanDay;
  dayIndex: number;
  weekNum: number;
  campaignStart: Date;
  typeColorMap: Map<string, string>;
  editable?: boolean;
  dragOver?: boolean;
  draggingCreatorId?: string | null;
  movePopoverCreatorId?: string | null;
  durationWeeks: number;
  saving?: boolean;
  onDragOver?: () => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onMoveCreator?: (target: MediaPlanCreatorMoveTarget) => void;
  onBeginDrag?: (creator: DraggableCreator, event: React.DragEvent<HTMLDivElement>) => void;
  onEndDrag?: () => void;
  onOpenMovePopover?: (creator: DraggableCreator) => void;
  onCloseMovePopover?: () => void;
}) {
  const style = TYPE_STYLES[day.type];
  const dateStr = day.dateLabel ?? formatDayColumnDate(campaignStart, weekNum, dayIndex);
  const dayAbbr = (DAY_ABBR[dayIndex] ?? day.day).toUpperCase();

  const acceptDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    onDragOver?.();
  };

  const renderCreatorEntry = (
    entry: {
      creatorId?: string;
      creator?: string;
      shortName?: string;
      avatarUrl?: string | null;
      profileUrl?: string | null;
      serviceTypes?: string[];
      serviceType?: string;
    },
    key: string
  ) => {
    if (!entry.creatorId || !entry.creator) return null;
    const creator: DraggableCreator = {
      creatorId: entry.creatorId,
      name: entry.shortName ?? entry.creator,
      types: entry.serviceTypes?.length
        ? entry.serviceTypes
        : entry.serviceType?.trim()
          ? [entry.serviceType]
          : [],
      avatarUrl: entry.avatarUrl,
      profileUrl: entry.profileUrl,
      week: weekNum,
      dayIndex,
    };

    return (
      <div key={key} className="relative">
        <CreatorCard
          name={creator.name}
          types={creator.types}
          avatarUrl={creator.avatarUrl}
          profileUrl={creator.profileUrl}
          typeColorMap={typeColorMap}
          dotFallback={style.dot}
          editable={editable}
          draggable
          isDragging={draggingCreatorId === creator.creatorId}
          onDragStart={(event) =>
            onBeginDrag?.({ ...creator, week: weekNum, dayIndex }, event)
          }
          onDragEnd={() => onEndDrag?.()}
          onClickMove={() => onOpenMovePopover?.({ ...creator, week: weekNum, dayIndex })}
        />
        {movePopoverCreatorId === creator.creatorId && onMoveCreator ? (
          <MoveCreatorPopover
            creator={{ ...creator, week: weekNum, dayIndex }}
            durationWeeks={durationWeeks}
            open
            onOpenChange={(open) => {
              if (!open) onCloseMovePopover?.();
            }}
            onMove={onMoveCreator}
            saving={saving}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex min-h-[5.5rem] flex-col overflow-visible rounded-[10px] border bg-white transition-[colors,transform,box-shadow]",
        dragOver
          ? "scale-[1.01] border-[#0057FF] bg-[#0057FF]/8 shadow-md ring-2 ring-[#0057FF]/30"
          : draggingCreatorId
            ? "border-[#0057FF]/15"
            : "border-[#0B0F1A]/6"
      )}
      onDragEnter={acceptDrop}
      onDragOver={acceptDrop}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(event) => {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        onDrop?.(event);
      }}
    >
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
      <div
        className="flex flex-1 flex-col gap-1 p-1"
        onDragEnter={acceptDrop}
        onDragOver={acceptDrop}
        onDrop={(event) => {
          if (!editable) return;
          event.preventDefault();
          event.stopPropagation();
          onDrop?.(event);
        }}
      >
        {day.creator ? (
          <>
            {renderCreatorEntry(day, `${weekNum}-${dayIndex}-primary`)}
            {(day.additionalDeliverables ?? [])
              .filter((entry) => !entry.isMirror && !entry.isCompanion)
              .map((entry, index) =>
                renderCreatorEntry(entry, `${weekNum}-${dayIndex}-extra-${index}`)
              )}
          </>
        ) : isMediaPlanOpenPublishingSlot(day) ? null : (
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
 * When `editable`, creators can be dragged between day columns or moved via click picker.
 */
export function MediaPlanCalendar({
  data,
  orientation = "portrait",
  editable = false,
  saving = false,
  onMoveCreator,
}: {
  data: MediaPlanData;
  orientation?: "portrait" | "landscape";
  editable?: boolean;
  saving?: boolean;
  onMoveCreator?: (target: MediaPlanCreatorMoveTarget) => void;
}) {
  const landscape = orientation === "landscape";
  const legendTypes = useMemo(() => collectLegendTypes(data), [data]);
  const typeColorMap = useMemo(() => buildAdTypeColorMap(legendTypes), [legendTypes]);
  const campaignStart = useMemo(
    () => parseCampaignStartDate(data.campaignStartDate),
    [data.campaignStartDate]
  );

  const [draggingCreator, setDraggingCreator] = useState<DraggableCreator | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ week: number; dayIndex: number } | null>(
    null
  );
  const [movePopoverCreator, setMovePopoverCreator] = useState<DraggableCreator | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const draggingCreatorRef = useRef<DraggableCreator | null>(null);
  const dropOpenTimerRef = useRef<number | null>(null);

  const clearDragVisualState = useCallback(() => {
    draggingCreatorRef.current = null;
    setDraggingCreator(null);
    setDragOverSlot(null);
    setDragPointer(null);
  }, []);

  const handleBeginDrag = useCallback(
    (creator: DraggableCreator, event: React.DragEvent<HTMLDivElement>) => {
      if (dropOpenTimerRef.current != null) {
        window.clearTimeout(dropOpenTimerRef.current);
        dropOpenTimerRef.current = null;
      }
      draggingCreatorRef.current = creator;
      setDraggingCreator(creator);
      setMovePopoverCreator(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", creator.creatorId);
      event.dataTransfer.setData("application/x-thinkway-creator-id", creator.creatorId);
      event.dataTransfer.setData(CREATOR_DRAG_MIME, JSON.stringify(creator));

      const target = event.currentTarget;
      const clone = target.cloneNode(true) as HTMLElement;
      clone.style.width = `${target.offsetWidth}px`;
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      document.body.appendChild(clone);
      event.dataTransfer.setDragImage(clone, target.offsetWidth / 2, target.offsetHeight / 2);
      window.setTimeout(() => clone.remove(), 0);
    },
    []
  );

  useEffect(() => {
    if (!draggingCreator) {
      setDragPointer(null);
      return;
    }
    const onDragOver = (event: DragEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("dragover", onDragOver);
    return () => window.removeEventListener("dragover", onDragOver);
  }, [draggingCreator]);

  useEffect(() => {
    return () => {
      if (dropOpenTimerRef.current != null) {
        window.clearTimeout(dropOpenTimerRef.current);
      }
    };
  }, []);

  const handleDrop = useCallback(
    (week: number, dayIndex: number, event: React.DragEvent<HTMLDivElement>) => {
      if (!onMoveCreator) return;
      const creator = draggingCreatorRef.current ?? readDraggedCreator(event);
      if (!creator) return;

      if (creator.week === week && creator.dayIndex === dayIndex) {
        clearDragVisualState();
        return;
      }

      const nextPending: PendingDrop = {
        creator,
        toWeek: week,
        toDayIndex: dayIndex,
      };

      clearDragVisualState();
      setMovePopoverCreator(null);

      // Defer dialog open past the drag pointer-up sequence so Radix does not auto-dismiss.
      if (dropOpenTimerRef.current != null) {
        window.clearTimeout(dropOpenTimerRef.current);
      }
      dropOpenTimerRef.current = window.setTimeout(() => {
        dropOpenTimerRef.current = null;
        setPendingDrop(nextPending);
      }, 0);
    },
    [clearDragVisualState, onMoveCreator]
  );

  const handleConfirmMove = useCallback(
    (target: MediaPlanCreatorMoveTarget) => {
      onMoveCreator?.(target);
      setPendingDrop(null);
    },
    [onMoveCreator]
  );

  const slotLabel =
    data.postingSlotCount && data.postingSlotCount !== data.creatorCount
      ? `${data.postingSlotCount} ad slots · ${data.creatorCount} creators`
      : data.postingSlotCount
        ? `${data.postingSlotCount} deliverables`
        : `${data.creatorCount} creators`;

  return (
    <div
      ref={calendarRef}
      className="relative space-y-4 rounded-2xl border border-[#0B0F1A]/6 p-4 sm:p-5"
      style={{ backgroundColor: MEDIA_PLAN_BRAND.lavender }}
      data-no-drag
      data-media-plan-calendar
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm"
          style={{ background: MEDIA_PLAN_BRAND.gradient }}
        >
          {data.durationWeeks} weeks · {slotLabel}
        </span>
        {editable ? (
          <span className="rounded-full border border-[#0057FF]/20 bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#0057FF]">
            Drag creators between days · release to choose what moves
          </span>
        ) : null}
        {saving ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" />
            Saving schedule…
          </span>
        ) : null}
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
                  editable={editable}
                  durationWeeks={data.durationWeeks}
                  saving={saving}
                  dragOver={
                    dragOverSlot?.week === week.week && dragOverSlot.dayIndex === dayIndex
                  }
                  draggingCreatorId={draggingCreator?.creatorId ?? null}
                  movePopoverCreatorId={movePopoverCreator?.creatorId ?? null}
                  onDragOver={() => setDragOverSlot({ week: week.week, dayIndex })}
                  onDragLeave={() => {
                    if (
                      dragOverSlot?.week === week.week &&
                      dragOverSlot.dayIndex === dayIndex
                    ) {
                      setDragOverSlot(null);
                    }
                  }}
                  onDrop={(event) => handleDrop(week.week, dayIndex, event)}
                  onMoveCreator={onMoveCreator}
                  onBeginDrag={handleBeginDrag}
                  onEndDrag={() => {
                    // dragend always fires after drop; keep pending-drop open intact.
                    clearDragVisualState();
                  }}
                  onOpenMovePopover={setMovePopoverCreator}
                  onCloseMovePopover={() => setMovePopoverCreator(null)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {dragPointer && draggingCreator ? (
        <div
          className="pointer-events-none fixed z-[80] w-36 -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragPointer.x, top: dragPointer.y }}
        >
          <CreatorCard
            name={draggingCreator.name}
            types={draggingCreator.types}
            avatarUrl={draggingCreator.avatarUrl}
            profileUrl={draggingCreator.profileUrl}
            typeColorMap={typeColorMap}
            dotFallback={MEDIA_PLAN_BRAND.electricBlue}
            isDragGhost
          />
        </div>
      ) : null}

      <MoveDeliverablesDialog
        pending={pendingDrop}
        open={Boolean(pendingDrop)}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) setPendingDrop(null);
        }}
        onConfirm={handleConfirmMove}
      />
    </div>
  );
}
