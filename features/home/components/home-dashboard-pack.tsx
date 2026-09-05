import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import "@/app/styles/discovery.css";
import "@/app/styles/home-dashboard.css";
import { cn } from "@/lib/utils";

export function HomeDashboardSuite({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "discovery-suite home-dashboard-suite flex min-h-0 min-w-0 flex-1 flex-col",
        className
      )}
      data-discovery-scroll
    >
      {children}
    </div>
  );
}

export function HomeDashboardCard({
  title,
  subtitle,
  right,
  children,
  note,
  id,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  children: ReactNode;
  note?: ReactNode;
  id?: string;
}) {
  return (
    <div className="tw-c" id={id}>
      <div className="tw-ch">
        <span className="tw-ct">{title}</span>
        {subtitle ? <span className="tw-cs">{subtitle}</span> : null}
        <span style={{ flex: 1 }} />
        {right}
      </div>
      {children}
      {note}
    </div>
  );
}

export function HomeDashboardJump({
  items,
}: {
  items: { href: string; label: string; count?: number | null }[];
}) {
  return (
    <nav className="tw-jump" aria-label="On this page">
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
          {item.count != null && item.count > 0 ? <b> {item.count}</b> : null}
        </a>
      ))}
    </nav>
  );
}

export function HomeDashboardTileGo({ children }: { children: ReactNode }) {
  return (
    <span className="tw-go">
      {children}{" "}
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export function HomeDashboardSpark({
  values,
  highlightFrom,
}: {
  values: number[];
  highlightFrom: number;
}) {
  return (
    <span className="tw-spark">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={index >= highlightFrom ? "hi" : undefined}
          style={{ height: `${value}%` }}
        />
      ))}
    </span>
  );
}

export function HomeDashboardPoRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = 207 * (1 - clamped / 100);
  return (
    <span className="tw-ring" style={{ "--off": `${offset}px` } as CSSProperties}>
      <svg width="76" height="76" aria-hidden>
        <circle className="bg" cx="38" cy="38" r="33" />
        <circle className="fg" cx="38" cy="38" r="33" />
      </svg>
      <span className="tw-ring__t">
        <span>
          <b>{clamped}%</b>
          <i>USED</i>
        </span>
      </span>
    </span>
  );
}

const QUEUE_COLS = "34px minmax(180px,1.5fr) 150px 96px";
export const HOME_QUEUE_COLS = QUEUE_COLS;

export const DASH_TABLE_COLS = "minmax(120px,1.5fr) 138px 122px 66px";

export function HomeDashboardGrid({
  cols,
  minWidth,
  header,
  children,
  footer,
}: {
  cols: string;
  minWidth: number;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const style = { "--cols": cols } as CSSProperties;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth }}>
        <div className="tw-g tw-hr" style={style}>
          {header}
        </div>
        {children}
        {footer ? (
          <div className="tw-g tw-ft" style={style}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HomeDashboardRow({
  cols,
  tone,
  children,
}: {
  cols: string;
  tone?: "bad" | "wrn" | "";
  children: ReactNode;
}) {
  return (
    <div
      className={cn("tw-g tw-r", tone)}
      style={{ "--cols": cols } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString("en-US");
}

export function avatarTone(index: number): string {
  return `k${(index % 3) + 1}`;
}

export const QUICK_ACCESS = [
  { href: "/dashboard", eyebrow: "Finance", hint: "KPIs, trends, billing alerts" },
  { href: "/campaigns", eyebrow: "Campaigns", hint: "Plans, IO, performance" },
  { href: "/clients", eyebrow: "Clients", hint: "Accounts, legal, brands" },
  { href: "/vendors", eyebrow: "Vendors", hint: "Creators, payouts, stats" },
] as const;

export function HomeDashboardQuickAccess() {
  return (
    <div className="tw-pad">
      <div className="tw-jr">
        {QUICK_ACCESS.map((item) => (
          <Link key={item.href} href={item.href} className="tw-jn cur" style={{ cursor: "pointer" }}>
            <i>{item.eyebrow}</i>
            <u style={{ marginTop: 5 }}>{item.hint}</u>
          </Link>
        ))}
      </div>
    </div>
  );
}
