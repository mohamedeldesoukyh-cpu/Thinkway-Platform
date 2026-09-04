"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { formatDistanceToNow } from "date-fns";

import "@/app/styles/discovery-suite-creator-profile.css";

import { AB, F, ini } from "@/lib/discovery/suite/helpers";
import { countryFlag, formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
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
  flagCode: string | null;
  metaLine: string;
  investmentScore: number | null;
  investmentLabel: string;
  investmentSubline: string | null;
  eciLoading: boolean;
  onSkipEciLoading?: () => void;
  platforms: DiscoverySuiteCreatorProfilePlatformChip[];
  onSelectPlatform: (id: string) => void;
  onAddPlatform: () => void;
  tierLabel: string | null;
  kvRows: KvRow[];
  contextLabel: string;
  headerActions: ReactNode;
  tabs: ReactNode;
  body: ReactNode;
  similar: DiscoverySuiteCreatorProfileSimilarItem[];
  similarLoading: boolean;
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
}: {
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
      {similar.slice(0, 8).map((item) => (
        <div key={item.unifiedId} className="tw-sim">
          <span className="a">{ini(item.displayName)}</span>
          <span style={{ minWidth: 0 }}>
            <b>{item.displayName}</b>
            {item.handle ? <u>@{item.handle.replace(/^@/, "")}</u> : null}
            <u style={{ fontFamily: "Geist, sans-serif", fontSize: "9.5px" }}>
              updated {item.updatedLabel}
            </u>
          </span>
          <span className="sc">{Math.round(item.score)}</span>
        </div>
      ))}
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
  flagCode,
  metaLine,
  investmentScore,
  investmentLabel,
  investmentSubline,
  eciLoading,
  onSkipEciLoading,
  platforms,
  onSelectPlatform,
  onAddPlatform,
  tierLabel,
  kvRows,
  contextLabel,
  headerActions,
  tabs,
  body,
  similar,
  similarLoading,
  onClose,
  blockDismiss,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (blockDismiss) return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, blockDismiss, onClose]);

  if (!open || typeof document === "undefined") return null;

  const flag = countryFlag(flagCode);

  return createPortal(
    <div className="discovery-suite">
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
                // eslint-disable-next-line @next/next/no-img-element -- pack avatar; remote CDN URLs vary
                <img src={avatarUrl} alt="" />
              ) : (
                ini(displayName)
              )}
              {flag ? <span className="fl">{flag}</span> : null}
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
                <button
                  key={platform.id}
                  type="button"
                  className={cn("tw-pchip", platform.selected && "on")}
                  aria-pressed={platform.selected}
                  onClick={() => onSelectPlatform(platform.id)}
                >
                  {platform.label}
                  <em>{AB(platform.followers)}</em>
                </button>
              ))}
              <button type="button" className="tw-pchip add" onClick={onAddPlatform}>
                + Add
              </button>
              {tierLabel ? <span>{tierLabel}</span> : null}
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
            <SimilarRail similar={similar} loading={similarLoading} />
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
