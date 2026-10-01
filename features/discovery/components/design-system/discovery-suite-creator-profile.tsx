"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { CREATOR_COUNTRY_OPTIONS as COUNTRY_OPTIONS } from "@/lib/creators/country-options";
import { createPortal } from "react-dom";

import { formatDistanceToNow } from "date-fns";

/*
 * The pack's geometry — `.tw-cp__w` grid, `.tw-cp__av` 84px avatar circle,
 * `.tw-scrim` — lives in the frozen foundation sheet, which until now was
 * imported only by `app/(dashboard)/discovery/layout.tsx`. Rendered from any
 * other route (Studio creator details, quotations, campaign match, compare) the
 * markup arrived unstyled: `.tw-cp__av` had no size, so the avatar `<img>` fell
 * back to its intrinsic dimensions and covered the screen. The portal root
 * carries `.discovery-suite` itself, and every rule in the frozen sheet is
 * scoped under that class, so importing it here styles the pack wherever it
 * renders and changes nothing outside it. Same pattern as
 * `home-dashboard-pack`. The legacy suite sheet is deliberately NOT imported:
 * it carries one unscoped `.tip` rule that the app sidebar also uses.
 */
import "@/app/styles/discovery.css";
import "@/app/styles/discovery-suite-creator-profile.css";

import { CountryFlagBadge } from "@/components/creator/country-flag-badge";
import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { AB, F, ini } from "@/lib/discovery/suite/helpers";
import { resolveCountryCode } from "@/lib/creators/country-code";
import {
  formatCreatorCountryLabels,
  normalizeCountryCode,
} from "@/lib/creators/creator-display-utils";
import { resolveCreatorRecencyIso } from "@/lib/creators/creator-hover-details";
import { cn } from "@/lib/utils";

export function formatDiscoveryPackRelativeAge(
  lastEnrichedAt?: string | null,
  updatedAt?: string | null
): string {
  const iso = resolveCreatorRecencyIso(lastEnrichedAt, updatedAt);
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

export type DiscoverySuiteCreatorProfileSimilarItem = {
  unifiedId: string;
  displayName: string;
  handle: string | null;
  score: number;
  updatedLabel: string;
  avatarUrl?: string | null;
  profileUrl?: string | null;
};

export type DiscoverySuiteCreatorProfilePlatformChip = {
  id: string;
  label: string;
  followers: number | null;
  selected: boolean;
};

type KvRow = { label: string; value: string };

type Props = {
  open: boolean;
  title: string;
  displayName: string;
  handleLabel: string | null;
  avatarUrl: string | null;
  profileUrl?: string | null;
  flagCode: string | null;
  metaLine: string;
  investmentScore: number | null;
  investmentLabel: string;
  investmentSubline: string | null;
  eciLoading: boolean;
  onSkipEciLoading?: () => void;
  platforms: DiscoverySuiteCreatorProfilePlatformChip[];
  onSelectPlatform: (id: string) => void;
  onRemovePlatform?: (id: string) => void;
  onAddPlatform: () => void;
  tierLabel: string | null;
  /** Canonical PR category — stored on influencers.categories. */
  countryCode?: string;
  countryBusy?: boolean;
  onCountryChange?: (country: string) => void;
  prChecked?: boolean;
  prBusy?: boolean;
  canEditPr?: boolean;
  onTogglePr?: (enabled: boolean) => void;
  kvRows: KvRow[];
  contextLabel: string;
  headerActions: ReactNode;
  tabs: ReactNode;
  body: ReactNode;
  similar: DiscoverySuiteCreatorProfileSimilarItem[];
  similarLoading: boolean;
  renderSimilarAction?: (id: string, content: ReactNode) => ReactNode;
  stackDepth?: number;
  onClose: () => void;
  /** When true, scrim / Escape must not dismiss (nested dialogs open). */
  blockDismiss: boolean;
};

function InvestmentScoreBlock({
  score,
  label,
  subline,
  loading,
  onSkip,
}: {
  score: number | null;
  label: string;
  subline: string | null;
  loading: boolean;
  onSkip?: () => void;
}) {
  if (loading) {
    return (
      <div className="tw-score">
        <span className="tw-spin" aria-hidden />
        <span>
          <i>Investment score</i>
          <b>Loading…</b>
          <span
            style={{
              fontSize: "10.5px",
              color: "rgba(255,255,255,.7)",
              display: "block",
              marginTop: 2,
            }}
          >
            Enterprise Creator Intelligence
          </span>
        </span>
        {onSkip ? (
          <button
            type="button"
            className="tw-b sm"
            style={{
              marginLeft: "auto",
              background: "rgba(255,255,255,.16)",
              borderColor: "rgba(255,255,255,.3)",
              color: "#fff",
            }}
            onClick={onSkip}
          >
            Skip
          </button>
        ) : null}
      </div>
    );
  }

  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div className="tw-score">
      <span
        className="tw-ring2"
        style={{
          background: `conic-gradient(#fff 0 ${pct}%, rgba(255,255,255,.22) ${pct}% 100%)`,
        }}
      >
        <span>{score != null ? score : "—"}</span>
      </span>
      <span>
        <i>Investment score</i>
        <b>{label}</b>
        {subline ? (
          <span
            style={{
              fontSize: "10.5px",
              color: "rgba(255,255,255,.7)",
              display: "block",
              marginTop: 2,
            }}
          >
            {subline}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function SimilarRail({
  similar,
  loading,
  renderAction,
}: {
  renderAction?: (id: string, content: ReactNode) => ReactNode;
  similar: DiscoverySuiteCreatorProfileSimilarItem[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="tw-cp__sim-loading">Finding similar creators…</div>;
  }
  if (similar.length === 0) {
    return <div className="tw-cp__sim-empty">No similar creators found.</div>;
  }
  return (
    <>
      {similar.slice(0, 8).map((item) => { const content = (
        <div className="tw-sim">
          {item.avatarUrl ? (
            <CreatorAvatarImage
              avatarUrl={item.avatarUrl}
              profileUrl={item.profileUrl}
              alt=""
              size="xs"
              sizeClassName="size-[30px]"
              className="a border-border/60"
            />
          ) : (
            <span className="a">{ini(item.displayName)}</span>
          )}
          <span style={{ minWidth: 0 }}>
            <b>{item.displayName}</b>
            {item.handle ? <u>@{item.handle.replace(/^@/, "")}</u> : null}
            <u style={{ fontFamily: "Geist, sans-serif", fontSize: "9.5px" }}>
              updated {item.updatedLabel}
            </u>
          </span>
          <span className="sc">{Math.round(item.score)}</span>
        </div>
      ); return <div key={item.unifiedId}>{renderAction ? renderAction(item.unifiedId, content) : content}</div>; })}
      <div className="tw-hint">
        Similarity is audience overlap plus category. Each row carries its own refresh date.
      </div>
    </>
  );
}

/**
 * Pack Overlay A — centered `.tw-scrim` + `.tw-cp` / `.tw-cp__w` (320 / flex / 232).
 * Must sit under `.discovery-suite` for frozen discovery.css selectors.
 */
export function DiscoverySuiteCreatorProfile({
  open,
  title,
  displayName,
  handleLabel,
  avatarUrl,
  profileUrl = null,
  flagCode,
  metaLine,
  investmentScore,
  investmentLabel,
  investmentSubline,
  eciLoading,
  onSkipEciLoading,
  platforms,
  onSelectPlatform,
  onRemovePlatform,
  onAddPlatform,
  tierLabel,
  countryCode = "",
  countryBusy = false,
  onCountryChange,
  prChecked = false,
  prBusy = false,
  canEditPr = false,
  onTogglePr,
  kvRows,
  contextLabel,
  headerActions,
  tabs,
  body,
  similar,
  similarLoading,
  renderSimilarAction,
  stackDepth = 0,
  onClose,
  blockDismiss,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (blockDismiss || event.defaultPrevented) return;
      const roots = document.querySelectorAll(".tw-cp-root");
      if (roots[roots.length - 1] !== rootRef.current) return;
      if (document.querySelector('[role="menu"][data-state="open"]')) return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, blockDismiss, onClose]);

  if (!open || typeof document === "undefined") return null;

  const resolvedFlag =
    normalizeCountryCode(resolveCountryCode(flagCode)) ??
    normalizeCountryCode(resolveCountryCode(metaLine.split("·")[0]));

  return createPortal(
    <div ref={rootRef} className="discovery-suite tw-cp-root" data-creator-stack-depth={stackDepth} style={{ "--creator-stack-offset": `${Math.min(stackDepth, 5) * 24}px`, zIndex: 92 + stackDepth } as CSSProperties}>
      <div
        className="tw-scrim"
        onClick={() => {
          if (!blockDismiss) onClose();
        }}
      />
      <div
        className="tw-cp"
        onClick={(event) => {
          if (event.target === event.currentTarget && !blockDismiss) onClose();
        }}
      >
        <div className="tw-cp__w" role="dialog" aria-modal="true" aria-label={title}>
          <div className="tw-cp__l">
            <div className="tw-cp__av">
              {avatarUrl ? (
                <CreatorAvatarImage
                  avatarUrl={avatarUrl}
                  profileUrl={profileUrl}
                  alt=""
                  sizeClassName="size-full"
                  className="!size-full border-0 bg-transparent"
                />
              ) : (
                ini(displayName)
              )}
              {resolvedFlag ? (
                <span className="fl">
                  <CountryFlagBadge
                    countryCode={resolvedFlag}
                    size="sm"
                    className="size-full border-0 shadow-none"
                  />
                </span>
              ) : null}
            </div>
            <h2>{displayName}</h2>
            {handleLabel ? <div className="hd">{handleLabel}</div> : null}
            <div className="mt">{metaLine}</div>

            <InvestmentScoreBlock
              score={investmentScore}
              label={investmentLabel}
              subline={investmentSubline}
              loading={eciLoading}
              onSkip={onSkipEciLoading}
            />

            <div className="tw-chips2">
              {platforms.map((platform) => (
                <div key={platform.id} className={cn("tw-platform-chip", platform.selected && "on")}>
                <button
                  type="button"
                  className={cn("tw-pchip", platform.selected && "on")}
                  aria-pressed={platform.selected}
                  onClick={() => onSelectPlatform(platform.id)}
                >
                  {platform.label}
                  <em>{AB(platform.followers)}</em>
                </button>
                {onRemovePlatform ? (
                  <button
                    type="button"
                    className="tw-platform-chip__remove"
                    aria-label={`Remove ${platform.label} profile`}
                    title={platforms.length < 2 ? "Keep at least one platform for this creator" : `Remove ${platform.label} profile`}
                    disabled={platforms.length < 2}
                    onClick={() => onRemovePlatform(platform.id)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
                </div>
              ))}
              <button type="button" className="tw-pchip add" onClick={onAddPlatform}>
                + Add
              </button>
              {tierLabel ? <span>{tierLabel}</span> : null}
              {canEditPr && onCountryChange ? (
                <label className="tw-country-edit">
                  <span>Country</span>
                  <select aria-label="Creator country" value={countryCode} disabled={countryBusy} onChange={event => onCountryChange(event.target.value)} title="Provider country data replaces this selection on refresh; otherwise it is kept.">
                    <option value="" disabled>Choose country</option>
                    {countryCode && !COUNTRY_OPTIONS.some(option => option.value === countryCode) ? <option value={countryCode}>{countryCode}</option> : null}
                    {COUNTRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {countryBusy ? <span role="status">Saving…</span> : null}
                </label>
              ) : null}
              {canEditPr ? (
                <label className="tw-pr-check" data-busy={prBusy ? "true" : undefined}>
                  <input
                    type="checkbox"
                    checked={prChecked}
                    disabled={prBusy}
                    onChange={(event) => onTogglePr?.(event.target.checked)}
                    aria-label="Mark as PR page"
                  />
                  PR
                </label>
              ) : prChecked ? (
                <span className="tw-pr-tag">PR</span>
              ) : null}
            </div>

            <div className="tw-cp__kv">
              {kvRows.map((row) => (
                <div key={row.label}>
                  <i>{row.label}</i>
                  <b>{row.value}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="tw-cp__m">
            <div className="tw-cp__h">
              <span className="tw-cs">{contextLabel}</span>
              <span className="tw-sp" />
              {headerActions}
              <button
                type="button"
                className="tw-dr__x"
                aria-label="Close"
                onClick={() => {
                  if (!blockDismiss) onClose();
                }}
              >
                &#10005;
              </button>
            </div>
            <div className="tw-cp__t">{tabs}</div>
            <div className="tw-cp__b">{body}</div>
          </div>

          <div className="tw-cp__r">
            <div className="tw-lbl" style={{ marginBottom: 8 }}>
              Similar creators
            </div>
            <SimilarRail similar={similar} loading={similarLoading} renderAction={renderSimilarAction} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Build the left-rail meta line (country · collabs · updated). */
export function buildDiscoveryPackCreatorMetaLine(input: {
  creator: Parameters<typeof formatCreatorCountryLabels>[0];
  lastEnrichedAt?: string | null;
  updatedAt?: string | null;
}): string {
  const country = formatCreatorCountryLabels(input.creator);
  const countryPart = country !== "—" ? country : "Unknown";
  const updated = formatDiscoveryPackRelativeAge(input.lastEnrichedAt, input.updatedAt);
  return `${countryPart} · 0 collaborations · 0 with you · updated ${updated}`;
}

export function formatDiscoveryPackQuoteReference(input: {
  currency?: string | null;
  amount?: number | null;
}): string {
  if (input.amount == null || Number.isNaN(Number(input.amount))) return "—";
  const ccy = input.currency?.trim() || "EGP";
  return `${ccy} ${F(input.amount)}`;
}
