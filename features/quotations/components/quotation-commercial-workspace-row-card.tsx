"use client";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { COMMERCIAL_INPUT_MODE_LABELS } from "@/lib/domains/commercial/quotation-constants";
import type { CommercialInputMode } from "@/lib/commercial/commercial-engine";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { applyCommercialWorkspaceBulkOp } from "@/lib/quotations/commercial-workspace/bulk-transforms";
import { commercialWorkspaceCreatorCardClass } from "@/lib/quotations/commercial-workspace/creator-card-class";
import {
  profitabilityBandLabel,
  resolveProfitabilityBand,
} from "@/lib/quotations/commercial-workspace/profitability-thresholds";
import type { CommercialWorkspaceColumnId } from "@/lib/quotations/commercial-workspace/column-preferences";
import { resolveQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { resolveCreatorLineCostDualLabel } from "@/lib/quotations/quotation-line-creator-commercial-sync";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { cn } from "@/lib/utils";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";

const MODE_OPTIONS = Object.entries(COMMERCIAL_INPUT_MODE_LABELS) as [
  CommercialInputMode,
  string,
][];

function fmtCell(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtGpPct(gp: number, revenue: number, rowGpPct: number): string {
  if (!Number.isFinite(revenue) || revenue <= 0) return "0.0%";
  const pct = revenue > 0 ? (gp / revenue) * 100 : rowGpPct;
  return `${pct.toFixed(1)}%`;
}

function formatHandle(handle: string | null | undefined): string | null {
  const trimmed = handle?.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : null;
}

export type CommercialWorkspaceRowCardModel = {
  itemId: string;
  item: QuotationItemRow;
  influencerName: string;
  optionLabel: string | null;
  revenueEgp: number;
  costEgp: number;
  gpValueEgp: number;
  gpPct: number;
  draft: QuotationRowDraft;
};

type Props = {
  row: CommercialWorkspaceRowCardModel;
  selected: boolean;
  canManage: boolean;
  show: (id: CommercialWorkspaceColumnId) => boolean;
  onToggleSelected: () => void;
  onStageDraft: (next: QuotationRowDraft) => void;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};

export function QuotationCommercialWorkspaceRowCard({
  row,
  selected,
  canManage,
  show,
  onToggleSelected,
  onStageDraft,
  displayCurrency = "EGP",
  displayFxRateToEgp = 1,
}: Props) {
  const band = resolveProfitabilityBand(row.gpPct);
  const profile = resolveQuotationCreatorProfileSource(
    row.item,
    row.item.platform ? [row.item.platform] : []
  );
  const profileUrl = resolveCreatorProfileUrl(profile);
  const handleLabel = formatHandle(profile.handle ?? row.item.handle);
  const displayName =
    profile.displayName?.trim() ||
    row.item.creator_name?.trim() ||
    handleLabel?.replace(/^@/, "") ||
    row.influencerName;
  const categories = row.item.creator_categories ?? [];
  const costDual = resolveCreatorLineCostDualLabel(row.draft, {
    displayCurrency,
    displayFxRateToEgp,
  });

  return (
    <div
      className={cn(
        "cgroup quotation-creator-card",
        commercialWorkspaceCreatorCardClass(band),
        !selected && "cw-card-row--dimmed"
      )}
    >
      <div className="cw-card-row">
        <Checkbox checked={selected} onCheckedChange={onToggleSelected} aria-label={`Select ${displayName}`} />

        <div className="shortlist-creator-exact-root shrink-0">
          <div className="discovery-search-exact-photo-wrap">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${displayName} profile`}
                className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40"
                onClick={(event) => event.stopPropagation()}
              >
                <CreatorAvatarImage
                  avatarUrl={profile.avatarUrl}
                  profileUrl={profileUrl}
                  alt={displayName}
                  sizeClassName="size-[64px]"
                  className="border-0 bg-[var(--surface,#f3f6fc)]"
                />
              </a>
            ) : (
              <CreatorAvatarImage
                avatarUrl={profile.avatarUrl}
                profileUrl={null}
                alt={displayName}
                sizeClassName="size-[64px]"
                className="border-0 bg-[var(--surface,#f3f6fc)]"
              />
            )}
          </div>
        </div>

        <div className="cg-id min-w-[140px] max-w-[220px] shrink-0 self-center">
          <div className="cg-name">
            <span className="truncate font-bold text-[var(--text,#0d1220)]">{displayName}</span>
          </div>
          {handleLabel ? <div className="cg-handle truncate">{handleLabel}</div> : null}
          {categories.length > 0 ? (
            <div className="cg-cats mt-1">
              <InterestChips interests={categories} variant="icat" maxVisible={2} />
            </div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="shortlist-creator-status-pill inline-flex h-[21px] items-center rounded-full bg-[#f1f4fa] px-2.5 text-[10.5px] font-bold text-[#727d92]">
              {profitabilityBandLabel(band)}
            </span>
            {row.optionLabel ? (
              <span className="shortlist-creator-status-pill inline-flex h-[21px] items-center rounded-full bg-[#f1f4fa] px-2.5 text-[10.5px] font-bold text-[#727d92]">
                {row.optionLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="cw-card-fields">
          {show("mode") ? (
            <div className="cw-field min-w-[128px]">
              <span className="cw-field-label">Mode</span>
              {canManage ? (
                <select
                  className="h-8 w-full max-w-[150px] rounded-[9px] border border-[#e3e8f2] bg-white px-2 text-[11px] font-medium"
                  value={row.draft.mode}
                  onChange={(e) => {
                    const mode = e.target.value as CommercialInputMode;
                    const next = applyCommercialWorkspaceBulkOp(
                      { ...row.draft, mode },
                      mode === "cost_markup_pct"
                        ? { kind: "apply_markup_pct", pct: row.draft.gpPct }
                        : { kind: "set_gp_pct", pct: row.draft.gpPct }
                    );
                    if (mode === "cost_revenue") {
                      onStageDraft({
                        ...row.draft,
                        mode,
                        gpValue: row.draft.revenue - row.draft.cost,
                        gpPct:
                          row.draft.revenue > 0
                            ? ((row.draft.revenue - row.draft.cost) / row.draft.revenue) * 100
                            : 0,
                      });
                    } else {
                      onStageDraft({ ...next, mode: next.mode });
                    }
                  }}
                >
                  {MODE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] font-semibold text-[#0d1220]">
                  {COMMERCIAL_INPUT_MODE_LABELS[row.draft.mode]}
                </span>
              )}
            </div>
          ) : null}

          {show("cost") ? (
            <div className="cw-field">
              <span className="cw-field-label">Cost</span>
              {canManage ? (
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-8 w-[96px] text-right text-xs"
                      value={row.draft.cost}
                      onChange={(e) => {
                        const cost = Number.isFinite(Number(e.target.value))
                          ? Number(e.target.value)
                          : 0;
                        const revenue = row.draft.revenue;
                        onStageDraft({
                          ...row.draft,
                          mode: "cost_revenue",
                          cost,
                          gpValue: revenue - cost,
                          gpPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
                        });
                      }}
                    />
                    <span className="text-[10px] font-semibold uppercase text-[#727d92]">
                      {row.draft.costCurrency || "EGP"}
                    </span>
                  </div>
                  {costDual.secondary ? (
                    <span className="text-[10.5px] tabular-nums text-[#8b93a7]">
                      {costDual.secondary}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[12px] font-semibold tabular-nums text-[#0d1220]">
                    {costDual.primary}
                  </span>
                  {costDual.secondary ? (
                    <span className="text-[10.5px] tabular-nums text-[#8b93a7]">
                      {costDual.secondary}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {show("revenue") ? (
            <div className="cw-field">
              <span className="cw-field-label">Revenue</span>
              {canManage ? (
                <Input
                  type="number"
                  className="h-8 w-[96px] text-right text-xs"
                  value={row.draft.revenue}
                  onChange={(e) => {
                    const revenue = Number(e.target.value);
                    onStageDraft({
                      ...row.draft,
                      mode: "cost_revenue",
                      revenue: Number.isFinite(revenue) ? revenue : 0,
                      gpValue: (Number.isFinite(revenue) ? revenue : 0) - row.draft.cost,
                      gpPct:
                        revenue > 0
                          ? ((revenue - row.draft.cost) / revenue) * 100
                          : 0,
                    });
                  }}
                />
              ) : (
                <span className="text-[12px] font-semibold tabular-nums text-[#0d1220]">
                  {fmtCell(row.revenueEgp)}
                </span>
              )}
            </div>
          ) : null}

          {show("gpPctInput") ? (
            <div className="cw-field">
              <span className="cw-field-label">GP % in</span>
              {canManage ? (
                <Input
                  type="number"
                  className="h-8 w-[80px] text-right text-xs"
                  value={row.draft.gpPct}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    onStageDraft(
                      applyCommercialWorkspaceBulkOp(row.draft, {
                        kind: "set_gp_pct",
                        pct: Number.isFinite(pct) ? pct : 0,
                      })
                    );
                  }}
                />
              ) : (
                <span className="text-[12px] font-semibold tabular-nums text-[#0d1220]">
                  {row.draft.gpPct.toFixed(1)}
                </span>
              )}
            </div>
          ) : null}

          {show("gp") ? (
            <div className="cw-field">
              <span className="cw-field-label">GP</span>
              <span className="cw-field-value">{fmtCell(row.gpValueEgp)}</span>
            </div>
          ) : null}

          {show("gpPct") ? (
            <div className="cw-field">
              <span className="cw-field-label">GP %</span>
              <span className="cw-field-value">
                {fmtGpPct(row.gpValueEgp, row.revenueEgp, row.gpPct)}
              </span>
            </div>
          ) : null}

          {show("afPct") ? (
            <div className="cw-field">
              <span className="cw-field-label">AF %</span>
              {canManage ? (
                <Input
                  type="number"
                  className="h-8 w-[72px] text-right text-xs"
                  value={row.draft.afPct}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    onStageDraft({
                      ...row.draft,
                      afPct: Number.isFinite(pct) ? pct : 0,
                    });
                  }}
                />
              ) : (
                <span className="text-[12px] font-semibold tabular-nums text-[#0d1220]">
                  {row.draft.afPct.toFixed(1)}
                </span>
              )}
            </div>
          ) : null}

          {show("currency") ? (
            <div className="cw-field">
              <span className="cw-field-label">Currency</span>
              {canManage ? (
                <select
                  className="h-8 w-[84px] rounded-[9px] border border-[#e3e8f2] bg-white px-1.5 text-[11px] font-semibold uppercase"
                  value={(row.draft.costCurrency || "EGP").toUpperCase()}
                  aria-label="Currency"
                  onChange={(e) => {
                    onStageDraft(
                      applyCommercialWorkspaceBulkOp(row.draft, {
                        kind: "set_currency",
                        currency: e.target.value || "EGP",
                      })
                    );
                  }}
                >
                  {COMMERCIAL_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] font-semibold text-[#0d1220]">
                  {row.draft.costCurrency}
                </span>
              )}
            </div>
          ) : null}

          {show("fx") ? (
            <div className="cw-field">
              <span className="cw-field-label">FX</span>
              {canManage ? (
                <Input
                  type="number"
                  className="h-8 w-[72px] text-right text-xs"
                  value={row.draft.fxRateToEgp}
                  onChange={(e) => {
                    const fx = Number(e.target.value);
                    onStageDraft(
                      applyCommercialWorkspaceBulkOp(row.draft, {
                        kind: "set_fx",
                        fxRateToEgp: Number.isFinite(fx) ? fx : 1,
                      })
                    );
                  }}
                />
              ) : (
                <span className="text-[12px] font-semibold tabular-nums text-[#0d1220]">
                  {row.draft.fxRateToEgp}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
