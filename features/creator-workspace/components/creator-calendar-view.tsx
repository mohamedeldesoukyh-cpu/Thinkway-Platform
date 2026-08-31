"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  calendarItemMeta,
  type CreatorCalendarItem,
} from "@/features/creator-workspace/calendar";
import {
  CREATOR_DOW_NAMES,
  CREATOR_MONTH_NAMES,
  todayIso,
  unitStatusPill,
} from "@/features/creator-workspace/chrome";
import { CreatorEmpty, CreatorPageHeader, CreatorRowChevron } from "@/features/creator-workspace/components/creator-workspace-ui";
import { CreatorPlatformMark } from "@/features/creator-workspace/components/creator-platform-mark";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function UpcomingRows({ items }: { items: CreatorCalendarItem[] }) {
  if (items.length === 0) {
    return (
      <CreatorEmpty
        title="Nothing scheduled"
        description="Due dates and campaign milestones will appear here."
      />
    );
  }
  return (
    <>
      {items.map((item) => {
        if (item.kind === "due") {
          const pill = unitStatusPill(item.statusLabel, item.status);
          return (
            <Link key={`due:${item.campaignHeaderId}:${item.date}:${item.title}`} href={item.href} className="row">
              <CreatorPlatformMark platform={item.platform} size={30} />
              <span className="row__b">
                <span className="row__t">{item.title} due</span>
                <span className="row__m">{calendarItemMeta(item)}</span>
              </span>
              <span className={pill.className}>{pill.label}</span>
              <CreatorRowChevron />
            </Link>
          );
        }
        return (
          <Link key={`${item.kind}:${item.campaignHeaderId}:${item.date}`} href={item.href} className="row">
            <span className={`cal__mk cal__mk--${item.kind}`} />
            <span className="row__b">
              <span className="row__t">
                {item.campaignName} {item.kind === "start" ? "starts" : "ends"}
              </span>
              <span className="row__m">{calendarItemMeta(item)}</span>
            </span>
            <CreatorRowChevron />
          </Link>
        );
      })}
    </>
  );
}

export function CreatorCalendarUpcoming({
  items,
  limit = 5,
}: {
  items: CreatorCalendarItem[];
  limit?: number;
}) {
  const today = todayIso();
  const upcoming = items.filter((item) => item.date >= today).slice(0, limit);
  return <UpcomingRows items={upcoming} />;
}

export function CreatorCalendarView({ items }: { items: CreatorCalendarItem[] }) {
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: (m ?? 1) - 1 };
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CreatorCalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const { y, m } = cursor;
  const first = new Date(Date.UTC(y, m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < lead; i += 1) cells.push({ day: null, iso: null });
  for (let d = 1; d <= days; d += 1) cells.push({ day: d, iso: iso(y, m, d) });

  const upcoming = items.filter((item) => item.date >= today).slice(0, 8);

  return (
    <>
      <CreatorPageHeader
        title="Calendar"
        description="Every due date and campaign milestone in one place."
      />
      <div className="cal">
        <div className="cal__hd">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              setCursor((cur) => {
                const next = cur.m - 1;
                return next < 0 ? { y: cur.y - 1, m: 11 } : { y: cur.y, m: next };
              })
            }
          >
            ←
          </button>
          <span className="cal__t">
            {CREATOR_MONTH_NAMES[m]} {y}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              setCursor((cur) => {
                const next = cur.m + 1;
                return next > 11 ? { y: cur.y + 1, m: 0 } : { y: cur.y, m: next };
              })
            }
          >
            →
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const [ty, tm] = today.split("-").map(Number);
              setCursor({ y: ty ?? y, m: (tm ?? 1) - 1 });
            }}
          >
            Today
          </button>
        </div>
        <div className="cal__dow">
          {CREATOR_DOW_NAMES.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="cal__grid">
          {cells.map((cell, index) => {
            if (!cell.iso || cell.day == null) {
              return <div key={`out-${index}`} className="cal__c cal__c--out" />;
            }
            const dayItems = byDate.get(cell.iso) ?? [];
            return (
              <div key={cell.iso} className="cal__c" data-today={cell.iso === today}>
                <span className="cal__d num">{cell.day}</span>
                {dayItems.map((item) =>
                  item.kind === "due" ? (
                    <Link
                      key={`e-${item.kind}-${item.href}-${item.title}`}
                      href={item.href}
                      className={`cal__e cal__e--${item.tone}`}
                      title={`${item.title} · ${item.campaignName}`}
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <Link
                      key={`e-${item.kind}-${item.href}-${item.date}`}
                      href={item.href}
                      className={`cal__e cal__e--${item.kind}`}
                      title={item.campaignName}
                    >
                      {item.campaignName} {item.kind === "start" ? "starts" : "ends"}
                    </Link>
                  )
                )}
              </div>
            );
          })}
        </div>
        <div className="cal__key">
          <span className="cx-leg">
            <i className="cal__mk cal__mk--todo" />
            To upload
          </span>
          <span className="cx-leg">
            <i className="cal__mk cal__mk--changes" />
            Changes
          </span>
          <span className="cx-leg">
            <i className="cal__mk cal__mk--approved" />
            To publish
          </span>
          <span className="cx-leg">
            <i className="cal__mk cal__mk--published" />
            Published
          </span>
          <span className="cx-leg">
            <i className="cal__mk cal__mk--start" />
            Campaign start / end
          </span>
        </div>
      </div>
      <section className="grp" style={{ marginTop: 22 }}>
        <div className="grp__h">
          <span className="grp__t">Next up</span>
        </div>
        <UpcomingRows items={upcoming} />
      </section>
    </>
  );
}
