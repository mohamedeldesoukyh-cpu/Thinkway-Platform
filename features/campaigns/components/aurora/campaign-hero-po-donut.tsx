"use client";

import { PO_STATUS_LABELS } from "@/lib/finance/po/status";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

const CIRCUMFERENCE = 2 * Math.PI * 41;

type CampaignHeroPoDonutProps = {
  workspace: CampaignWorkspace;
  className?: string;
};

/** PO utilisation donut — live financials only. */
export function CampaignHeroPoDonut({ workspace, className }: CampaignHeroPoDonutProps) {
  const { financials } = workspace;
  const currency = workspace.currency_code;
  const budget = financials.budget;
  const consumed = Math.max(0, financials.po_banner_consumed);
  const pct = budget > 0 ? Math.min(100, Math.round((consumed / budget) * 100)) : 0;
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  const stroke =
    financials.po_exceeded || financials.po_status === "exceeded"
      ? "var(--camp-red)"
      : financials.po_status === "near_limit"
        ? "#e0a11c"
        : "var(--camp-blue)";

  const statusLabel =
    financials.po_exceeded
      ? "Exceeded"
      : PO_STATUS_LABELS[financials.po_status] ?? financials.po_status;

  const pillClass =
    financials.po_exceeded || financials.po_status === "exceeded"
      ? "thinkway-aurora-pill thinkway-aurora-pill-rose"
      : financials.po_status === "near_limit"
        ? "thinkway-aurora-pill thinkway-aurora-pill-amber"
        : financials.po_status === "active"
          ? "thinkway-aurora-pill thinkway-aurora-pill-green"
          : "thinkway-aurora-pill thinkway-aurora-pill-mut";

  return (
    <div className={cn("thinkway-aurora-donut", className)} aria-label="PO utilisation">
      <div className="thinkway-aurora-donut-num">
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
          <circle
            cx="48"
            cy="48"
            r="41"
            fill="none"
            stroke="var(--camp-progress-track)"
            strokeWidth="9"
          />
          <circle
            cx="48"
            cy="48"
            r="41"
            fill="none"
            stroke={stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="thinkway-aurora-donut-ctr">
          <div>
            <b className="tabular-nums">{pct}%</b>
            <span>PO used</span>
          </div>
        </div>
      </div>
      <div className="thinkway-aurora-donut-side">
        <div className="thinkway-aurora-donut-dk">Budget · PO</div>
        <div className="thinkway-aurora-donut-dv tabular-nums">
          {formatMoney(budget, currency)}
        </div>
        <div className="thinkway-aurora-donut-note">
          <span className={pillClass}>{statusLabel}</span>
        </div>
      </div>
    </div>
  );
}
