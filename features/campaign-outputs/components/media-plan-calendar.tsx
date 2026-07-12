import { cn } from "@/lib/utils";

import type { MediaPlanData, MediaPlanDayType } from "../generators/media-plan";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_STYLES: Record<MediaPlanDayType, { dot: string; cell: string; label: string }> = {
  content: {
    dot: "bg-emerald-500",
    cell: "border-emerald-500/30 bg-emerald-500/5",
    label: "Publishing",
  },
  stories: { dot: "bg-sky-500", cell: "border-sky-500/30 bg-sky-500/5", label: "Stories" },
  boost: { dot: "bg-amber-500", cell: "border-amber-500/30 bg-amber-500/5", label: "Paid boost" },
  monitoring: {
    dot: "bg-slate-400",
    cell: "border-border bg-muted/30",
    label: "Monitoring",
  },
};

/**
 * Visual Media Plan — a weekly × daily calendar with the creator-by-creator
 * publishing schedule, plus activation waves and milestone windows. Renders the
 * plan as a calendar/timeline, not markdown.
 */
export function MediaPlanCalendar({ data }: { data: MediaPlanData }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          {data.durationWeeks} weeks · {data.creatorCount} creators
        </span>
        {(Object.keys(TYPE_STYLES) as MediaPlanDayType[]).map((type) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", TYPE_STYLES[type].dot)} />
            {TYPE_STYLES[type].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px] space-y-2">
          <div className="grid grid-cols-[6rem_repeat(7,1fr)] gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Week</span>
            {DAY_ABBR.map((d) => (
              <span key={d} className="text-center">
                {d}
              </span>
            ))}
          </div>

          {data.weeks.map((week) => (
            <div key={week.week} className="grid grid-cols-[6rem_repeat(7,1fr)] gap-1.5">
              <div className="flex flex-col justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
                <span className="text-xs font-bold text-foreground">Week {week.week}</span>
                <span className="text-[10px] text-muted-foreground">{week.phase}</span>
                <span className="text-[9px] text-muted-foreground/70">Wave {week.wave}</span>
              </div>
              {week.days.map((day) => {
                const style = TYPE_STYLES[day.type];
                return (
                  <div
                    key={day.day}
                    className={cn(
                      "flex min-h-[3.5rem] flex-col gap-1 rounded-lg border p-1.5 text-[10px] leading-tight",
                      style.cell
                    )}
                    title={day.label}
                  >
                    <span className={cn("size-1.5 rounded-full", style.dot)} />
                    <span className="line-clamp-3 text-foreground/90">
                      {day.creator ?? style.label}
                    </span>
                    {day.platform ? (
                      <span className="mt-auto text-[9px] text-muted-foreground">{day.platform}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Activation Waves
          </h4>
          <ul className="space-y-1 text-xs text-foreground/90">
            {data.waves.map((wave) => (
              <li key={wave.wave}>
                <span className="font-semibold">Wave {wave.wave}</span> — {wave.theme}{" "}
                <span className="text-muted-foreground">(wk {wave.weeks.join(", ")})</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Milestones & Windows
          </h4>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-foreground/90">
            {data.milestones.slice(0, 12).map((m, i) => (
              <li key={`${m.type}-${m.week}-${i}`}>
                <span className="text-muted-foreground">Wk {m.week}</span> · {m.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
