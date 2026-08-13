"use client";

import "@/app/commercial-workspace.css";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2Icon, Table2Icon } from "lucide-react";
import { toast } from "sonner";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { UnsavedChangesBar } from "@/components/forms/unsaved-changes-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateAssignmentLineCommercialsAction } from "@/features/campaigns/actions/update-assignment-line-commercials";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { computeAgencyFeeAmount } from "@/lib/assignments/client-billing-commercial";
import { resolveAssignmentCreatorIdentity } from "@/lib/campaigns/resolve-assignment-creator-label";
import { COMMERCIAL_WORKSPACE_TRIGGER_CLASS } from "@/lib/commercial/commercial-workspace-trigger";
import { commercialWorkspaceCreatorCardClass } from "@/lib/quotations/commercial-workspace/creator-card-class";
import {
  profitabilityBandLabel,
  resolveProfitabilityBand,
} from "@/lib/quotations/commercial-workspace/profitability-thresholds";
import { cn } from "@/lib/utils";

const CS = {
  dark: "#0d1220",
  gray: "#6b7280",
  muted: "#9aa3b5",
  line: "#e3e8f2",
  green: "#1D9E75",
  warn: "#EA580C",
  critical: "#DC2626",
} as const;

type CommercialDraft = {
  lineId: string;
  revenue_before_vat: number;
  cost_before_vat: number;
  usage_rights_amount: number;
  usage_rights_cost: number;
  agency_fee_percent: number;
};

type AssignmentCommercialWorkspaceDialogProps = {
  campaignId: string;
  currencyCode: string;
  hierarchy: AssignmentHierarchy;
  canManage?: boolean;
  className?: string;
};

type HealthFilter = "all" | "healthy" | "warning" | "critical";

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function fmtStat(amount: number, currency: string): string {
  return `${money(amount)} ${currency}`;
}

function draftFromLine(line: CampaignLineWorkspace): CommercialDraft {
  return {
    lineId: line.id,
    revenue_before_vat: Number(line.revenue_before_vat ?? line.revenue ?? 0),
    cost_before_vat: Number(line.cost_before_vat ?? line.cost ?? 0),
    usage_rights_amount: Number(line.usage_rights_amount ?? 0),
    usage_rights_cost: Number(line.usage_rights_cost ?? 0),
    agency_fee_percent: Number(line.agency_fee_percent ?? 0),
  };
}

function draftsEqual(a: CommercialDraft, b: CommercialDraft): boolean {
  return (
    a.revenue_before_vat === b.revenue_before_vat &&
    a.cost_before_vat === b.cost_before_vat &&
    a.usage_rights_amount === b.usage_rights_amount &&
    a.usage_rights_cost === b.usage_rights_cost &&
    a.agency_fee_percent === b.agency_fee_percent
  );
}

function lineGp(draft: CommercialDraft) {
  const af = computeAgencyFeeAmount(
    draft.revenue_before_vat,
    draft.usage_rights_amount,
    draft.agency_fee_percent
  );
  const billable = draft.revenue_before_vat + draft.usage_rights_amount + af;
  const gp =
    billable - draft.cost_before_vat - draft.usage_rights_cost;
  const gpPct = billable > 0 ? (gp / billable) * 100 : 0;
  return { af, billable, gp, gpPct };
}

function sumDrafts(drafts: CommercialDraft[]) {
  return drafts.reduce(
    (acc, draft) => {
      const { af, billable, gp } = lineGp(draft);
      acc.revenue += draft.revenue_before_vat;
      acc.cost += draft.cost_before_vat;
      acc.af += af;
      acc.ur += draft.usage_rights_amount;
      acc.billable += billable;
      acc.gp += gp;
      return acc;
    },
    { revenue: 0, cost: 0, af: 0, ur: 0, billable: 0, gp: 0 }
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "warn" | "critical";
}) {
  return (
    <div className="discovery-search-exact-stat-box">
      <p className="discovery-search-exact-stat-col-label uppercase tracking-[0.03em]">
        {label}
      </p>
      <p
        className="discovery-search-exact-stat-value mt-1"
        style={{
          color:
            tone === "green"
              ? CS.green
              : tone === "warn"
                ? CS.warn
                : tone === "critical"
                  ? CS.critical
                  : CS.dark,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Quotation-style Commercial Workspace for Assignments.
 * Edits creator-line commercial masters and saves through updateCampaignLine.
 */
export function AssignmentCommercialWorkspaceDialog({
  campaignId,
  currencyCode,
  hierarchy,
  canManage = true,
  className,
}: AssignmentCommercialWorkspaceDialogProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<string, CommercialDraft>>({});
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");

  const lines = useMemo(
    () => hierarchy.groups.map((group) => group.line),
    [hierarchy.groups]
  );

  const baseline = useMemo(() => {
    const map: Record<string, CommercialDraft> = {};
    for (const line of lines) map[line.id] = draftFromLine(line);
    return map;
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    setDrafts(baseline);
    setSelected(new Set(lines.map((line) => line.id)));
    setSearch("");
    setHealthFilter("all");
  }, [open, baseline, lines]);

  const dirtyLines = useMemo(() => {
    return lines.filter((line) => {
      const draft = drafts[line.id];
      const base = baseline[line.id];
      if (!draft || !base) return false;
      return !draftsEqual(draft, base);
    });
  }, [lines, drafts, baseline]);

  const enriched = useMemo(() => {
    return lines.map((line) => {
      const draft = drafts[line.id] ?? baseline[line.id]!;
      const { af, billable, gp, gpPct } = lineGp(draft);
      const band = resolveProfitabilityBand(gpPct);
      return { line, draft, af, billable, gp, gpPct, band };
    });
  }, [lines, drafts, baseline]);

  const health = useMemo(() => {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    for (const row of enriched) {
      if (row.band === "healthy") healthy += 1;
      else if (row.band === "warning") warning += 1;
      else critical += 1;
    }
    return { healthy, warning, critical };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((row) => {
      if (healthFilter !== "all" && row.band !== healthFilter) return false;
      if (!q) return true;
      const identity = resolveAssignmentCreatorIdentity(row.line);
      const hay =
        `${identity.name} ${identity.handle ?? ""} ${row.line.document_number}`.toLowerCase();
      return hay.includes(q);
    });
  }, [enriched, search, healthFilter]);

  const selectionTotals = useMemo(() => {
    const selectedDrafts = enriched
      .filter((row) => selected.has(row.line.id))
      .map((row) => row.draft);
    return sumDrafts(selectedDrafts);
  }, [enriched, selected]);

  const assignmentTotals = useMemo(
    () => sumDrafts(enriched.map((row) => row.draft)),
    [enriched]
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selected.has(row.line.id));

  function patchDraft(lineId: string, patch: Partial<CommercialDraft>) {
    setDrafts((prev) => {
      const current = prev[lineId] ?? baseline[lineId];
      if (!current) return prev;
      return { ...prev, [lineId]: { ...current, ...patch, lineId } };
    });
  }

  function handleDiscard() {
    setDrafts(baseline);
  }

  function handleSave() {
    if (!canManage || dirtyLines.length === 0) return;
    startTransition(async () => {
      try {
        const result = await updateAssignmentLineCommercialsAction({
          campaignId,
          lines: dirtyLines.map((line) => {
            const draft = drafts[line.id]!;
            return {
              lineId: line.id,
              revenue_before_vat: draft.revenue_before_vat,
              cost_before_vat: draft.cost_before_vat,
              usage_rights_amount: draft.usage_rights_amount,
              usage_rights_cost: draft.usage_rights_cost,
              agency_fee_percent: draft.agency_fee_percent,
            };
          }),
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        refreshAfterOperationalMutation();
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save assignment commercials."
        );
      }
    });
  }

  const currency = (currencyCode || hierarchy.currency_code || "EGP").toUpperCase();
  const selectionGpPct =
    selectionTotals.billable > 0
      ? (selectionTotals.gp / selectionTotals.billable) * 100
      : 0;
  const assignmentGpPct =
    assignmentTotals.billable > 0
      ? (assignmentTotals.gp / assignmentTotals.billable) * 100
      : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(COMMERCIAL_WORKSPACE_TRIGGER_CLASS, className)}
          disabled={lines.length === 0}
        >
          <Table2Icon className="size-3.5" />
          Commercial Workspace
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="commercial-workspace-dialog flex h-[min(92vh,820px)] max-h-[min(92vh,820px)] min-h-0 w-[min(98vw,1280px)] max-w-[min(98vw,1280px)] flex-col gap-0 overflow-hidden rounded-xl border-[0.5px] p-0 sm:max-w-[min(98vw,1280px)]"
        style={{ borderColor: CS.line, backgroundColor: "#fff", color: CS.dark }}
      >
        <div
          className="shrink-0 px-5 py-3"
          style={{ borderBottom: `0.5px solid ${CS.line}` }}
        >
          <DialogTitle className="m-0 text-base font-semibold" style={{ color: CS.dark }}>
            Commercial Workspace
          </DialogTitle>
          <p className="m-0 mt-0.5 text-xs" style={{ color: CS.gray }}>
            {lines.length} creator lines · linked to Assignments grid · explicit Save
            {!canManage ? " · read-only" : null}
          </p>
        </div>

        <div
          className="shrink-0 space-y-3 px-5 py-3"
          style={{ borderBottom: `0.5px solid ${CS.line}`, background: "#fff" }}
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="cgroup quotation-creator-card">
              <div className="cw-kpi-inner">
                <p className="cw-kpi-title">Selection · {selected.size}</p>
                <div className="cw-stat-grid">
                  <StatCard
                    label="Revenue"
                    value={fmtStat(selectionTotals.revenue, currency)}
                  />
                  <StatCard
                    label="Cost"
                    value={fmtStat(selectionTotals.cost, currency)}
                  />
                  <StatCard
                    label="GP"
                    value={fmtStat(selectionTotals.gp, currency)}
                    tone="green"
                  />
                  <StatCard
                    label="GP %"
                    value={`${selectionGpPct.toFixed(1)}%`}
                    tone="green"
                  />
                </div>
              </div>
            </div>
            <div className="cgroup quotation-creator-card">
              <div className="cw-kpi-inner">
                <p className="cw-kpi-title">Assignments · {lines.length}</p>
                <div className="cw-stat-grid">
                  <StatCard
                    label="Revenue"
                    value={fmtStat(assignmentTotals.revenue, currency)}
                  />
                  <StatCard
                    label="Cost"
                    value={fmtStat(assignmentTotals.cost, currency)}
                  />
                  <StatCard
                    label="GP"
                    value={fmtStat(assignmentTotals.gp, currency)}
                    tone="green"
                  />
                  <StatCard
                    label="GP %"
                    value={`${assignmentGpPct.toFixed(1)}%`}
                    tone="green"
                  />
                </div>
              </div>
            </div>
            <div className="cgroup quotation-creator-card min-w-[148px]">
              <div className="cw-kpi-inner">
                <p className="cw-kpi-title">Commercial Health</p>
                <div className="cw-health-stack">
                  {(
                    [
                      ["healthy", "Healthy", health.healthy, "quotation-creator-card--green"],
                      ["warning", "Warning", health.warning, "quotation-creator-card--orange"],
                      [
                        "critical",
                        "Critical",
                        health.critical,
                        "quotation-creator-card--missing-cost",
                      ],
                    ] as const
                  ).map(([filter, label, count, cardClass]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() =>
                        setHealthFilter((prev) => (prev === filter ? "all" : filter))
                      }
                      className={cn(
                        "cgroup quotation-creator-card flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold",
                        cardClass,
                        healthFilter === filter && "ring-2 ring-[#0057FF]/30"
                      )}
                    >
                      <span>{label}</span>
                      <span className="tabular-nums">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter influencers…"
              className="h-8 w-[180px] text-xs"
            />
            <span className="text-[11px] text-muted-foreground">
              {dirtyLines.length} unsaved · {filtered.length} shown
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-2">
          <div
            className="mb-2 flex shrink-0 items-center gap-3 py-1"
            style={{ borderBottom: `0.5px solid ${CS.line}` }}
          >
            <Checkbox
              checked={allFilteredSelected}
              onCheckedChange={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allFilteredSelected) {
                    filtered.forEach((row) => next.delete(row.line.id));
                  } else {
                    filtered.forEach((row) => next.add(row.line.id));
                  }
                  return next;
                });
              }}
              aria-label="Select filtered"
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: CS.muted }}
            >
              Creators · {filtered.length}
            </span>
          </div>

          <div className="cw-card-list min-h-0 flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="cgroup quotation-creator-card">
                <div
                  className="cw-kpi-inner py-10 text-center text-sm"
                  style={{ color: CS.muted }}
                >
                  No lines match this filter.
                </div>
              </div>
            ) : (
              filtered.map(({ line, draft, gp, gpPct, band }) => {
                const identity = resolveAssignmentCreatorIdentity(line);
                const locked = line.revenue_locked || line.cost_locked;
                const isSelected = selected.has(line.id);
                const avatarUrl =
                  line.creator_avatar_url ??
                  line.influencer_avatar_url ??
                  line.creator_profile_image_url;

                return (
                  <div
                    key={line.id}
                    className={cn(
                      "cgroup quotation-creator-card",
                      commercialWorkspaceCreatorCardClass(band),
                      !isSelected && "cw-card-row--dimmed"
                    )}
                  >
                    <div className="cw-card-row">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(line.id)) next.delete(line.id);
                            else next.add(line.id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${identity.name}`}
                      />

                      <div
                        className="cw-avatar-wrap relative shrink-0 overflow-hidden rounded-full"
                        style={{ width: 64, height: 64 }}
                      >
                        <CreatorAvatarImage
                          avatarUrl={avatarUrl}
                          profileUrl={null}
                          alt={identity.name}
                          sizeClassName="!size-full"
                          className="!size-full border-0 bg-[var(--surface,#f3f6fc)] [&_img]:!size-full [&_img]:object-cover [&_img]:object-center"
                        />
                      </div>

                      <div className="cg-id min-w-[140px] max-w-[220px] shrink-0 self-center">
                        <div className="cg-name">
                          <span className="truncate font-bold text-[var(--text,#0d1220)]">
                            {identity.name}
                          </span>
                        </div>
                        <div className="cg-handle truncate">
                          {identity.handle ? `@${identity.handle} · ` : ""}
                          {line.document_number}
                          {line.assignment?.pricing_mode === "per_deliverable"
                            ? " · Per deliverable"
                            : " · Package"}
                          {locked ? " · Locked" : ""}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="shortlist-creator-status-pill inline-flex h-[21px] items-center rounded-full bg-[#f1f4fa] px-2.5 text-[10.5px] font-bold text-[#727d92]">
                            {profitabilityBandLabel(band)}
                          </span>
                        </div>
                      </div>

                      <div className="cw-card-fields">
                        <div className="cw-field">
                          <span className="cw-field-label">Cost</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-[120px] text-right text-xs tabular-nums"
                            value={draft.cost_before_vat}
                            disabled={!canManage || line.cost_locked || pending}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              patchDraft(line.id, {
                                cost_before_vat:
                                  Number.isFinite(next) && next >= 0 ? next : 0,
                              });
                            }}
                          />
                        </div>
                        <div className="cw-field">
                          <span className="cw-field-label">Revenue</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-[120px] text-right text-xs tabular-nums"
                            value={draft.revenue_before_vat}
                            disabled={!canManage || line.revenue_locked || pending}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              patchDraft(line.id, {
                                revenue_before_vat:
                                  Number.isFinite(next) && next >= 0 ? next : 0,
                              });
                            }}
                          />
                        </div>
                        <div className="cw-field">
                          <span className="cw-field-label">AF %</span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className="h-8 w-[72px] text-right text-xs"
                            value={draft.agency_fee_percent}
                            disabled={!canManage || pending}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              patchDraft(line.id, {
                                agency_fee_percent:
                                  Number.isFinite(next) && next >= 0 ? next : 0,
                              });
                            }}
                          />
                        </div>
                        <div className="cw-field">
                          <span className="cw-field-label">UR Rev</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-[100px] text-right text-xs tabular-nums"
                            value={draft.usage_rights_amount}
                            disabled={!canManage || pending}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              patchDraft(line.id, {
                                usage_rights_amount:
                                  Number.isFinite(next) && next >= 0 ? next : 0,
                              });
                            }}
                          />
                        </div>
                        <div className="cw-field">
                          <span className="cw-field-label">UR Cost</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-[100px] text-right text-xs tabular-nums"
                            value={draft.usage_rights_cost}
                            disabled={!canManage || pending}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              patchDraft(line.id, {
                                usage_rights_cost:
                                  Number.isFinite(next) && next >= 0 ? next : 0,
                              });
                            }}
                          />
                        </div>
                        <div className="cw-field">
                          <span className="cw-field-label">GP</span>
                          <span className="cw-field-value">{money(gp)}</span>
                        </div>
                        <div className="cw-field">
                          <span className="cw-field-label">GP %</span>
                          <span className="cw-field-value">{gpPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {canManage ? (
          <div
            className="shrink-0 px-5 pb-3 pt-1"
            style={{ borderTop: `0.5px solid ${CS.line}` }}
          >
            <UnsavedChangesBar
              isDirty={dirtyLines.length > 0}
              isSaving={pending}
              onSave={handleSave}
              onCancel={() => setOpen(false)}
              onReset={handleDiscard}
              cancelLabel="Close"
              resetLabel="Discard"
              saveLabel={
                dirtyLines.length > 0
                  ? `Save (${dirtyLines.length})`
                  : "Save"
              }
              enableLeaveGuard={false}
              status={
                pending ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3 animate-spin" /> Saving assignment
                    commercials…
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Changes apply to creator lines in Assignments
                  </span>
                )
              }
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
