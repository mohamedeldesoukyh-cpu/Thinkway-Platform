"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { STUDIO_REF_CLASSES } from "../../../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES, STUDIO_OBJECTIVE_BADGE } from "../../../constants/studio-tokens";
import { useStudioRefMode } from "../../../hooks/use-studio-ref-mode";

export function StatBox({
  label,
  value,
  sub,
  className,
  mono = false,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
  /** Reference uses Geist Mono only for numeric budget figures. */
  mono?: boolean;
}) {
  const refMode = useStudioRefMode();
  if (!value.trim()) return null;

  if (refMode) {
    return (
      <div className={cn(STUDIO_REF_CLASSES.statTile, className)}>
        <div className={STUDIO_REF_CLASSES.statTileLbl}>{label}</div>
        <div
          className={cn(
            STUDIO_REF_CLASSES.statTileVal,
            mono && STUDIO_REF_CLASSES.mono
          )}
        >
          {value}
        </div>
        {sub ? <div className={STUDIO_REF_CLASSES.statTileSub}>{sub}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn(STUDIO_CLASSES.statBox, className)}>
      <p className={cn(STUDIO_CLASSES.label, "text-[#6B7280]")}>{label}</p>
      <p className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.5px] text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-[#6B7280]">{sub}</p> : null}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.statTiles, className)}>{children}</div>;
  }
  return <div className={cn(STUDIO_CLASSES.statGrid, className)}>{children}</div>;
}

export function DetailItem({ label, value }: { label: string; value: string }) {
  const refMode = useStudioRefMode();
  if (!value.trim()) return null;

  if (refMode) {
    return (
      <div>
        <div className={STUDIO_REF_CLASSES.fieldLbl}>{label}</div>
        <div className={STUDIO_REF_CLASSES.fieldVal}>{value}</div>
      </div>
    );
  }

  return (
    <div className={STUDIO_CLASSES.detailItem}>
      <p className={cn(STUDIO_CLASSES.label, "mb-0.5 text-[#6B7280]")}>{label}</p>
      <p className="text-[13px] font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}

export function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.fieldGrid, className)}>{children}</div>;
  }
  return <div className={cn(STUDIO_CLASSES.detailGrid, className)}>{children}</div>;
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
  const refMode = useStudioRefMode();
  if (!value.trim()) return null;

  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.insightCard}>
        <div className={STUDIO_REF_CLASSES.insightLbl}>{label}</div>
        <div className={STUDIO_REF_CLASSES.insightTxt}>{value}</div>
        {badge ? <span className={STUDIO_REF_CLASSES.confChip}>{badge}</span> : null}
      </div>
    );
  }

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

export function InsightGrid({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.insightGrid, className)}>{children}</div>;
  }
  return <div className={cn(STUDIO_CLASSES.reasonGrid, className)}>{children}</div>;
}

export function BudgetHero({ amount, caption }: { amount: string; caption: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.budgetBanner}>
        <div className={STUDIO_REF_CLASSES.budgetVal}>{amount}</div>
        <div className={STUDIO_REF_CLASSES.budgetLbl}>{caption}</div>
      </div>
    );
  }

  return (
    <div className={STUDIO_CLASSES.budgetHero}>
      <div>
        <p className="text-[34px] font-black leading-none">{amount}</p>
        <p className="mt-0.5 text-xs opacity-85">{caption}</p>
      </div>
    </div>
  );
}

export function RationaleBar({ children }: { children: ReactNode }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={STUDIO_REF_CLASSES.rationaleBar}>{children}</div>;
  }
  return <div className={STUDIO_CLASSES.rationaleBox}>{children}</div>;
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
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <div className={STUDIO_CLASSES.budgetRow}>
        <span className="min-w-0 flex-1 text-[13px] font-bold">{name}</span>
        {trailing}
        <span className={cn("shrink-0 font-extrabold", STUDIO_REF_CLASSES.mono)}>{amount}</span>
      </div>
    );
  }

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
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.mixBarRow}>
        <span className={STUDIO_REF_CLASSES.mixDot} style={{ background: color }} />
        <span className={STUDIO_REF_CLASSES.mixBarLbl}>{label}</span>
        <div className={STUDIO_REF_CLASSES.mixTrack}>
          <div className={STUDIO_REF_CLASSES.mixFill} style={{ width: `${percent}%`, background: color }} />
        </div>
        <span className={STUDIO_REF_CLASSES.mixPct}>{percent}%</span>
      </div>
    );
  }

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
  const refMode = useStudioRefMode();

  if (refMode) {
    return (
      <div className={cn(STUDIO_REF_CLASSES.weekCard, highlight && STUDIO_REF_CLASSES.weekCardDone)}>
        <div className={STUDIO_REF_CLASSES.weekLbl}>{week}</div>
        <div className={STUDIO_REF_CLASSES.weekTitle}>{title}</div>
        {description ? <div className={STUDIO_REF_CLASSES.weekDesc}>{description}</div> : null}
        {owner ? <div className={STUDIO_REF_CLASSES.weekOwner}>Owner: {owner}</div> : null}
      </div>
    );
  }

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

export function WeekGrid({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.timelineGrid, className)}>{children}</div>;
  }
  return <div className={cn(STUDIO_CLASSES.weekGrid, className)}>{children}</div>;
}

export function PsBox({ label, value }: { label: string; value: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.statusTile}>
        <div className={STUDIO_REF_CLASSES.statusTileLbl}>{label}</div>
        <div className={STUDIO_REF_CLASSES.statusTileVal}>{value}</div>
      </div>
    );
  }

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
  variant = "default",
}: {
  label: string;
  items: string[];
  labelColor: string;
  variant?: "default" | "pos" | "neg";
}) {
  const refMode = useStudioRefMode();
  if (items.length === 0) return null;

  if (refMode) {
    return (
      <div>
        <div
          className={cn(
            STUDIO_REF_CLASSES.miniListLbl,
            variant === "pos" && STUDIO_REF_CLASSES.miniListLblPos,
            variant === "neg" && STUDIO_REF_CLASSES.miniListLblNeg
          )}
        >
          {label}
        </div>
        <ul className={STUDIO_REF_CLASSES.miniList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

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
  const refMode = useStudioRefMode();

  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.benchItem}>
        <div className={STUDIO_REF_CLASSES.benchTop}>
          <span className={STUDIO_REF_CLASSES.benchTitle}>{metric}</span>
          <span className={STUDIO_REF_CLASSES.benchSrc}>{source}</span>
        </div>
        <div className={cn(STUDIO_REF_CLASSES.benchRow, STUDIO_REF_CLASSES.benchRowExpected)}>
          <span className="k">Expected</span>
          <span className="v">{expected}</span>
        </div>
        <div className={STUDIO_REF_CLASSES.benchRow}>
          <span className="k">Industry</span>
          <span className="v">{industry}</span>
        </div>
      </div>
    );
  }

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
  const refMode = useStudioRefMode();
  const high = impact === "high";

  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.oppCard}>
        <div className={STUDIO_REF_CLASSES.oppTags}>
          <span
            className={cn(STUDIO_REF_CLASSES.miniTag)}
            style={{ background: "#f3f6fc", color: "#3f4757" }}
          >
            {category}
          </span>
          <span
            className={STUDIO_REF_CLASSES.miniTag}
            style={{
              background: high ? "#ecfdf5" : "#fffbeb",
              color: high ? "#065f46" : "#92400e",
            }}
          >
            {high ? "High Impact" : impact === "medium" ? "Medium Impact" : "Low Impact"}
          </span>
        </div>
        <div className={STUDIO_REF_CLASSES.oppTitle}>{title}</div>
        <div className={STUDIO_REF_CLASSES.oppDesc}>{description}</div>
      </div>
    );
  }

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
  tone = "decisions",
}: {
  label: string;
  items: string[];
  tone?: "decisions" | "actions" | "next";
}) {
  const refMode = useStudioRefMode();
  if (items.length === 0) return null;

  if (refMode) {
    return (
      <div>
        <div
          className={cn(
            STUDIO_REF_CLASSES.execColLbl,
            tone === "decisions" && "decisions",
            tone === "actions" && "actions",
            tone === "next" && "next"
          )}
        >
          {label}
        </div>
        <ul
          className={cn(
            STUDIO_REF_CLASSES.execList,
            tone === "decisions" && STUDIO_REF_CLASSES.execListDecisions,
            tone === "actions" && STUDIO_REF_CLASSES.execListActions,
            tone === "next" && STUDIO_REF_CLASSES.execListNext
          )}
        >
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

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
  const refMode = useStudioRefMode();
  return (
    <button
      type="button"
      className={cn(refMode ? STUDIO_REF_CLASSES.showMore : STUDIO_CLASSES.showMore, "w-full")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function BenchGrid({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.benchGrid, className)}>{children}</div>;
  }
  return <div className={cn(STUDIO_CLASSES.benchGrid, className)}>{children}</div>;
}

export function ConceptGrid({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.conceptGrid, className)}>{children}</div>;
  }
  return <div className={cn(STUDIO_CLASSES.conceptGrid, className)}>{children}</div>;
}

export function ConceptCard({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.conceptCard}>
        <div className={STUDIO_REF_CLASSES.conceptNum}>{index}</div>
        <div className={STUDIO_REF_CLASSES.conceptTitle}>{title}</div>
        {children}
      </div>
    );
  }
  return (
    <div className={STUDIO_CLASSES.conceptCard}>
      <div className="mb-2 flex size-[22px] items-center justify-center rounded-full bg-[#7C3AED] text-[11px] font-bold text-white">
        {index}
      </div>
      <h4 className="mb-2 text-[13px] font-extrabold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

export function ConceptRow({ label, value }: { label: string; value: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <div className={STUDIO_REF_CLASSES.conceptRow}>
        <div className={STUDIO_REF_CLASSES.conceptRowLbl}>{label}</div>
        <div className={STUDIO_REF_CLASSES.conceptRowVal}>{value}</div>
      </div>
    );
  }
  return (
    <div className="mb-2">
      <p className="text-[9px] font-extrabold tracking-[0.4px] text-[#6B7280] uppercase">{label}</p>
      <p className="text-[11.5px] leading-snug text-foreground">{value}</p>
    </div>
  );
}

export function TagRow({ children, className }: { children: ReactNode; className?: string }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return <div className={cn(STUDIO_REF_CLASSES.tagRow, className)}>{children}</div>;
  }
  return <div className={cn("mt-2 flex flex-wrap gap-1.5", className)}>{children}</div>;
}

export function MiniTag({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const refMode = useStudioRefMode();
  if (refMode) {
    return (
      <span className={STUDIO_REF_CLASSES.miniTag} style={style}>
        {children}
      </span>
    );
  }
  return (
    <span className="rounded-md bg-[#EEF1F8] px-2 py-0.5 text-[10px] font-bold text-[#0057FF]">
      {children}
    </span>
  );
}

export function ObjectiveBadge({
  objective,
  bg,
  color,
}: {
  objective: string;
  bg?: string;
  color?: string;
}) {
  const refMode = useStudioRefMode();
  const normalized = objective.trim();

  if (refMode) {
    const fallbackBg = normalized.toLowerCase().includes("awareness")
      ? "#faf5ff"
      : normalized.toLowerCase().includes("engagement")
        ? "#ecfdf5"
        : "#fffbeb";
    const fallbackColor = normalized.toLowerCase().includes("awareness")
      ? "#6b21a8"
      : normalized.toLowerCase().includes("engagement")
        ? "#065f46"
        : "#92400e";

    return (
      <span
        className={STUDIO_REF_CLASSES.objChip}
        style={{ background: bg ?? fallbackBg, color: color ?? fallbackColor }}
      >
        {objective}
      </span>
    );
  }

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
