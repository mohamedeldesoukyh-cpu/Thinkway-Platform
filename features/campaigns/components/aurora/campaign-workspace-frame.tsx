"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type WorkspaceSummaryStat = {
  key: string;
  label: string;
  value: ReactNode;
  tone?: "default" | "blue" | "pos" | "amber" | "mut";
};

type CampaignWorkspaceFrameProps = {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  tools?: ReactNode;
  stats?: WorkspaceSummaryStat[];
  /** Optional banner/status strip under stats */
  banner?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Label above the detailed register section */
  registerLabel?: string;
};

function toneClass(tone: WorkspaceSummaryStat["tone"]): string | undefined {
  if (tone === "blue") return "text-[var(--camp-blue-text)]";
  if (tone === "pos") return "text-[var(--camp-green-text)]";
  if (tone === "amber") return "text-[var(--camp-amber-text)]";
  if (tone === "mut") return "text-[var(--camp-text-4,var(--camp-text-3))]";
  return undefined;
}

/**
 * Shared Aurora workspace chrome — header + summary stats + register body.
 * Presentation only; children keep existing business UI.
 */
export function CampaignWorkspaceFrame({
  title,
  subtitle,
  status,
  tools,
  stats,
  banner,
  children,
  className,
  registerLabel = "Register",
}: CampaignWorkspaceFrameProps) {
  return (
    <div className={cn("thinkway-aurora-ws", className)}>
      <header className="thinkway-aurora-ws-head">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="thinkway-aurora-ws-title">{title}</h2>
            {status}
          </div>
          {subtitle ? <p className="thinkway-aurora-ws-sub">{subtitle}</p> : null}
        </div>
        {tools ? <div className="thinkway-aurora-ws-tools">{tools}</div> : null}
      </header>

      {stats && stats.length > 0 ? (
        <div
          className={cn(
            "thinkway-aurora-statrow",
            stats.length >= 6 && "c6",
            stats.length === 5 && "c5",
            stats.length === 4 && "c4"
          )}
          role="group"
          aria-label={`${title} summary`}
        >
          {stats.map((stat) => (
            <div key={stat.key} className="thinkway-aurora-scard">
              <div className="thinkway-aurora-scard-k">{stat.label}</div>
              <div className={cn("thinkway-aurora-scard-v tabular-nums", toneClass(stat.tone))}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {banner}

      <div className="thinkway-aurora-ws-register">
        <div className="thinkway-aurora-ws-register-label">{registerLabel}</div>
        <div className="thinkway-aurora-ws-register-body">{children}</div>
      </div>
    </div>
  );
}

export function AuroraStatusPill({
  tone,
  children,
}: {
  tone: "green" | "blue" | "amber" | "rose" | "mut";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "thinkway-aurora-pill h-5 text-[10.5px]",
        tone === "green" && "thinkway-aurora-pill-green",
        tone === "blue" && "thinkway-aurora-pill-blue",
        tone === "amber" && "thinkway-aurora-pill-amber",
        tone === "rose" && "thinkway-aurora-pill-rose",
        tone === "mut" && "thinkway-aurora-pill-mut"
      )}
    >
      {children}
    </span>
  );
}
