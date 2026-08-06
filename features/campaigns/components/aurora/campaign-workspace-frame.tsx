"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

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
  /** Primary actions — always top-right */
  tools?: ReactNode;
  stats?: WorkspaceSummaryStat[];
  /** Optional secondary strip (flow, sync health). Keep short. */
  banner?: ReactNode;
  /**
   * Collapsed-by-default detail panels (document meta, charts, etc.)
   * to keep above-the-fold focus on title → KPIs → actions → register.
   */
  details?: ReactNode;
  detailsLabel?: string;
  children?: ReactNode;
  className?: string;
  /** Quiet label above operational content */
  registerLabel?: string;
  /** When set, replaces children with a guided empty state */
  empty?: ReactNode;
  /**
   * Progressive disclosure for large registers — header + KPIs stay visible;
   * table/body renders only after expand (lazy).
   */
  collapseRegister?: boolean;
  /** Record count shown in the expand control — e.g. 32 */
  registerCount?: number;
  /** sessionStorage key suffix — defaults to title */
  registerStorageKey?: string;
  /** Force register open (deep-link to a row). */
  forceRegisterOpen?: boolean;
  defaultRegisterOpen?: boolean;
  /** When false, do not remember expand state in sessionStorage. */
  persistRegisterOpen?: boolean;
};

function toneClass(tone: WorkspaceSummaryStat["tone"]): string | undefined {
  if (tone === "blue") return "text-[var(--camp-blue-text)]";
  if (tone === "pos") return "text-[var(--camp-green-text)]";
  if (tone === "amber") return "text-[var(--camp-amber-text)]";
  if (tone === "mut") return "text-[var(--camp-text-4,var(--camp-text-3))]";
  return undefined;
}

function registerSessionKey(storageKey: string): string {
  return `thinkway:ws-register:${storageKey}`;
}

function readRegisterOpen(storageKey: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(registerSessionKey(storageKey));
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Shared Aurora workspace chrome — title → status → KPIs → actions → content.
 * Presentation only. Large registers collapse by default when requested.
 */
export function CampaignWorkspaceFrame({
  title,
  subtitle,
  status,
  tools,
  stats,
  banner,
  details,
  detailsLabel = "More details",
  children,
  className,
  registerLabel,
  empty,
  collapseRegister = false,
  registerCount,
  registerStorageKey,
  forceRegisterOpen = false,
  defaultRegisterOpen = false,
  persistRegisterOpen = true,
}: CampaignWorkspaceFrameProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const storageKey = registerStorageKey ?? title.toLowerCase().replace(/\s+/g, "-");
  const [registerOpen, setRegisterOpen] = useState(
    () => forceRegisterOpen || defaultRegisterOpen
  );
  const [registerHydrated, setRegisterHydrated] = useState(false);

  useEffect(() => {
    if (!collapseRegister) return;
    if (forceRegisterOpen) {
      setRegisterOpen(true);
      setRegisterHydrated(true);
      return;
    }
    if (!persistRegisterOpen) {
      setRegisterOpen(defaultRegisterOpen);
      setRegisterHydrated(true);
      return;
    }
    setRegisterOpen(readRegisterOpen(storageKey, defaultRegisterOpen));
    setRegisterHydrated(true);
  }, [
    collapseRegister,
    forceRegisterOpen,
    storageKey,
    defaultRegisterOpen,
    persistRegisterOpen,
  ]);

  useEffect(() => {
    if (
      !collapseRegister ||
      !persistRegisterOpen ||
      !registerHydrated ||
      typeof window === "undefined"
    ) {
      return;
    }
    try {
      window.sessionStorage.setItem(
        registerSessionKey(storageKey),
        registerOpen ? "1" : "0"
      );
    } catch {
      /* ignore */
    }
  }, [
    collapseRegister,
    persistRegisterOpen,
    registerHydrated,
    registerOpen,
    storageKey,
  ]);

  const showRegister = !empty && children != null;
  const registerVisible =
    showRegister && (!collapseRegister || registerOpen || forceRegisterOpen);
  const countLabel =
    registerCount != null ? `${registerCount} record${registerCount === 1 ? "" : "s"}` : null;

  return (
    <div className={cn("thinkway-aurora-ws", className)}>
      <header className="thinkway-aurora-ws-head">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="thinkway-aurora-ws-title">{title}</h2>
            {status}
          </div>
          {subtitle ? <p className="thinkway-aurora-ws-sub">{subtitle}</p> : null}
        </div>
        {tools ? (
          <div className="thinkway-aurora-ws-tools" aria-label={`${title} actions`}>
            {tools}
          </div>
        ) : null}
      </header>

      {stats && stats.length > 0 ? (
        <div
          className={cn(
            "thinkway-aurora-statrow",
            stats.length >= 7 && "c7",
            stats.length === 6 && "c6",
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

      {details ? (
        <div className="thinkway-aurora-ws-details">
          <button
            type="button"
            className="thinkway-aurora-disclose"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span>{detailsLabel}</span>
            <ChevronDownIcon
              className={cn("size-4 transition-transform duration-200", detailsOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {detailsOpen ? <div className="thinkway-aurora-ws-details-body">{details}</div> : null}
        </div>
      ) : null}

      {empty ? <div className="thinkway-aurora-ws-empty-slot">{empty}</div> : null}

      {showRegister && collapseRegister ? (
        <div className="thinkway-aurora-ws-register-toggle">
          <button
            type="button"
            className="thinkway-aurora-disclose thinkway-aurora-register-disclose"
            aria-expanded={registerVisible}
            onClick={() => setRegisterOpen((open) => !open)}
          >
            <span>
              {registerVisible ? "▼" : "▶"}{" "}
              {registerLabel ?? title}
              {countLabel ? ` (${countLabel})` : null}
            </span>
            <span className="thinkway-aurora-register-disclose-hint">
              {registerVisible ? "Collapse table" : "Expand table"}
            </span>
          </button>
        </div>
      ) : null}

      {registerVisible ? (
        <div className="thinkway-aurora-ws-register">
          {!collapseRegister && registerLabel ? (
            <div className="thinkway-aurora-ws-register-label">{registerLabel}</div>
          ) : null}
          <div className="thinkway-aurora-ws-register-body">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function AuroraStatusPill({
  tone,
  children,
  className,
}: {
  tone: "green" | "blue" | "amber" | "rose" | "mut";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "thinkway-aurora-pill h-5 text-[10.5px]",
        tone === "green" && "thinkway-aurora-pill-green",
        tone === "blue" && "thinkway-aurora-pill-blue",
        tone === "amber" && "thinkway-aurora-pill-amber",
        tone === "rose" && "thinkway-aurora-pill-rose",
        tone === "mut" && "thinkway-aurora-pill-mut",
        className
      )}
    >
      {children}
    </span>
  );
}

type AuroraEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Guided empty state — always pair with a next action when possible. */
export function AuroraEmptyState({
  title,
  description,
  action,
  className,
}: AuroraEmptyStateProps) {
  return (
    <div className={cn("thinkway-aurora-empty", className)} role="status">
      <div className="thinkway-aurora-empty-ic" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      </div>
      <p className="thinkway-aurora-empty-title">{title}</p>
      {description ? <p className="thinkway-aurora-empty-desc">{description}</p> : null}
      {action ? <div className="thinkway-aurora-empty-action">{action}</div> : null}
    </div>
  );
}
