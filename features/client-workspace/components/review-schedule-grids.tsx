import type { CSSProperties, ReactNode } from "react";
import { reviewScheduleToday } from "../content-review-schedule";
import {
  scheduleAxis,
  scheduleGroups,
  scheduleNeedsDecision,
  schedulePeriodKey,
  type ScheduleRow,
  type ScheduleView,
} from "../review-schedule-model";
export function ReviewScheduleGrids({
  rows,
  axis,
  currentView,
  square,
}: {
  rows: ScheduleRow[];
  axis: ReturnType<typeof scheduleAxis>;
  currentView: ScheduleView;
  square: (row: ScheduleRow) => ReactNode;
}) {
  const groups = scheduleGroups(rows);
  const today = reviewScheduleToday();
  function periodContents(
    groupRows: ScheduleRow[],
    key: string,
    view: ScheduleView,
  ) {
    const matched = groupRows.filter(
      (row) =>
        row.expected_review_date &&
        schedulePeriodKey(row.expected_review_date, view) === key,
    );
    return matched.length ? matched.map(square) : <em>—</em>;
  }
  return (
    <>
      {(["w", "m", "q"] as const).map((v) => {
        const periods = axis.views[v],
          cols = `minmax(110px,176px) repeat(${periods.length},minmax(${v === "w" ? "26px" : `var(--period-min,${v === "m" ? "46px" : "90px"})`},1fr)) minmax(var(--unscheduled-min,180px),${v === "w" ? "1.4" : "2.1"}fr)`;
        return (
          <div
            className="tbl"
            data-v={v}
            key={v}
            hidden={currentView !== v}
            style={
              {
                "--cols": cols,
                ...(periods.length > 12 ? { "--period-min": "0px" } : {}),
              } as CSSProperties
            }
          >
            <div
              className="tbl__s"
              tabIndex={0}
              role="region"
              aria-label={`${v === "w" ? "Weekly" : v === "m" ? "Monthly" : "Quarterly"} review schedule`}
            >
              <div
                className="tbl__canvas"
                style={
                  v === "w"
                    ? { minWidth: 356 + periods.length * 26 }
                    : undefined
                }
              >
                <div className="g hd">
                  <span className="stick">Creator</span>
                  {periods.map((p) => (
                    <span
                      className={`mh${p.key === schedulePeriodKey(today, v) ? " is-now" : ""}`}
                      key={p.key}
                    >
                      {p.label}
                      <em>{p.year}</em>
                    </span>
                  ))}
                  <span className="ns">Not scheduled</span>
                </div>
                {groups.map((group, i) => (
                  <div className="g r" key={group.name}>
                    <span className="who stick">
                      <span className={`av a${(i % 3) + 1}`}>
                        {group.name.replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="who__t">
                        <b title={group.name}>{group.name}</b>
                        <u>
                          {group.rows.filter(scheduleNeedsDecision).length} of{" "}
                          {group.rows.length} need you
                        </u>
                      </span>
                    </span>
                    {periods.map((p) => (
                      <span
                        className={`rvs-cell${p.key === schedulePeriodKey(today, v) ? " is-now" : ""}`}
                        key={p.key}
                      >
                        {periodContents(group.rows, p.key, v)}
                      </span>
                    ))}
                    <span className="pool">
                      <span className="pool__u">
                        {group.rows
                          .filter((r) => !r.expected_review_date)
                          .map(square)}
                      </span>
                      <em>
                        {
                          group.rows.filter((r) => !r.expected_review_date)
                            .length
                        }
                      </em>
                    </span>
                  </div>
                ))}
                <div className="g ft">
                  <span className="stick">Expected for review</span>
                  {periods.map((p) => (
                    <span key={p.key}>
                      {rows.filter(
                        (r) =>
                          r.expected_review_date &&
                          schedulePeriodKey(r.expected_review_date, v) ===
                            p.key,
                      ).length || "—"}
                    </span>
                  ))}
                  <span className="ns__t">
                    <b>{rows.filter((r) => !r.expected_review_date).length}</b>{" "}
                    of {rows.length} have no date
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
