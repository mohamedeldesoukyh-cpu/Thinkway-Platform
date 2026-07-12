"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { STUDIO_CLASSES, STUDIO_OBJECTIVE_BADGE } from "../../../constants/studio-tokens";

export function StatBox({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className={cn(STUDIO_CLASSES.statBox, className)}>
      <p className={cn(STUDIO_CLASSES.label, "text-[#6B7280]")}>{label}</p>
      <p className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.5px] text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-[#6B7280]">{sub}</p> : null}
    </div>
  );
}

export function DetailItem({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className={STUDIO_CLASSES.detailItem}>
      <p className={cn(STUDIO_CLASSES.label, "mb-0.5 text-[#6B7280]")}>{label}</p>
      <p className="text-[13px] font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}

export function ReasonCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className={STUDIO_CLASSES.reasonCard}>
      <p className={cn(STUDIO_CLASSES.label, "mb-1 text-[#7C3AED]")}>{label}</p>
      <p className={cn(STUDIO_CLASSES.bodySm, "text-foreground")}>{value}</p>
      {badge ? (
        <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#6B7280]">
          <span className="rounded-full bg-[#7C3AED]/10 px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#7C3AED]">
            {badge}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function BudgetHero({ amount, caption }: { amount: string; caption: string }) {
  return (
    <div className={STUDIO_CLASSES.budgetHero}>
      <div>
        <p className="text-[34px] font-black leading-none">{amount}</p>
        <p className="mt-0.5 text-xs opacity-85">{caption}</p>
      </div>
    </div>
  );
}

export function BudgetRow({
  name,
  amount,
  trailing,
}: {
  name: string;
  amount: string;
  trailing?: ReactNode;
}) {
  return (
    <div className={STUDIO_CLASSES.budgetRow}>
      <span className="size-2.5 shrink-0 rounded-full bg-[#0C9D57]" />
      <span className="min-w-0 flex-1 text-[13px] font-bold text-foreground">{name}</span>
      {trailing}
      <span className="shrink-0 font-mono text-[13px] font-extrabold text-foreground">{amount}</span>
    </div>
  );
}

export function MixRow({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div className={STUDIO_CLASSES.mixRow}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="w-[150px] shrink-0 text-[12.5px] font-bold text-foreground">{label}</span>
      <div className={STUDIO_CLASSES.mixBar}>
        <span
          className="block h-full rounded-lg transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-extrabold text-foreground">
        {percent}%
      </span>
    </div>
  );
}

export function WeekCard({
  week,
  title,
  description,
  owner,
  highlight,
}: {
  week: string;
  title: string;
  description?: string;
  owner?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        STUDIO_CLASSES.weekCard,
        highlight && "border-[#0C9D57]/20 bg-[#0C9D57]/6"
      )}
    >
      <p className={cn(STUDIO_CLASSES.labelSm, "text-[#0C9D57]")}>{week}</p>
      <h4 className="mt-1 text-[12.5px] font-extrabold leading-snug text-foreground">{title}</h4>
      {description ? (
        <p className="mt-1.5 text-[11px] leading-snug text-[#6B7280]">{description}</p>
      ) : null}
      {owner ? (
        <p className="mt-1.5 text-[10.5px] font-bold text-[#0057FF]">Owner: {owner}</p>
      ) : null}
    </div>
  );
}

export function PsBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={STUDIO_CLASSES.psBox}>
      <p className={cn(STUDIO_CLASSES.label, "text-[#6B7280]")}>{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-foreground">{value}</p>
    </div>
  );
}

export function QuadCard({
  label,
  items,
  labelColor,
}: {
  label: string;
  items: string[];
  labelColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={STUDIO_CLASSES.quadCard}>
      <p className={cn(STUDIO_CLASSES.labelSm, "mb-1.5", labelColor)}>{label}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className="relative pl-3 text-[11.5px] leading-snug text-foreground before:absolute before:left-0 before:font-black before:text-foreground before:content-['·']"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BenchCard({
  metric,
  source,
  expected,
  industry,
}: {
  metric: string;
  source: string;
  expected: string;
  industry: string;
}) {
  return (
    <div className={STUDIO_CLASSES.benchCard}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={cn(STUDIO_CLASSES.labelSm, "text-[#6B7280]")}>{metric}</p>
        <span className={STUDIO_CLASSES.tag}>{source}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 text-[11.5px]">
        <div>
          <p className={cn(STUDIO_CLASSES.label, "text-[#6B7280]")}>Expected</p>
          <p className="mt-0.5 font-bold leading-snug text-[#0C9D57]">{expected}</p>
        </div>
        <div>
          <p className={cn(STUDIO_CLASSES.label, "text-[#6B7280]")}>Industry</p>
          <p className="mt-0.5 leading-snug text-foreground">{industry}</p>
        </div>
      </div>
    </div>
  );
}

export function OppCard({
  category,
  impact,
  title,
  description,
}: {
  category: string;
  impact: string;
  title: string;
  description: string;
}) {
  const impactClass =
    impact === "high"
      ? STUDIO_CLASSES.pillFit
      : impact === "medium"
        ? "rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[9px] font-extrabold text-[#7C3AED]"
        : STUDIO_CLASSES.tag;

  return (
    <div className={STUDIO_CLASSES.oppCard}>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <span className={STUDIO_CLASSES.tag}>{category}</span>
        <span className={impactClass}>
          {impact === "high" ? "High Impact" : impact === "medium" ? "Medium Impact" : "Low Impact"}
        </span>
      </div>
      <p className="text-[13px] font-extrabold text-foreground">{title}</p>
      <p className="mt-0.5 text-[11.5px] text-[#6B7280]">{description}</p>
    </div>
  );
}

export function Col2Bullets({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={cn(STUDIO_CLASSES.labelSm, "mb-2 text-[#7C3AED]")}>{label}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="relative pl-3.5 text-[12.5px] leading-snug text-foreground before:absolute before:left-0 before:font-black before:text-[#0057FF] before:content-['•']"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShowMoreButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={cn(STUDIO_CLASSES.showMore, "w-full")} onClick={onClick}>
      {children}
    </button>
  );
}

export function ObjectiveBadge({ objective }: { objective: string }) {
  const normalized = objective.trim();
  const style =
    normalized.toLowerCase().includes("awareness")
      ? STUDIO_OBJECTIVE_BADGE.Awareness
      : normalized.toLowerCase().includes("engagement")
        ? STUDIO_OBJECTIVE_BADGE.Engagement
        : normalized.toLowerCase().includes("ugc")
          ? STUDIO_OBJECTIVE_BADGE["UGC volume"]
          : "bg-[#EEF1F8] text-[#6B7280]";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", style)}>
      {objective}
    </span>
  );
}
