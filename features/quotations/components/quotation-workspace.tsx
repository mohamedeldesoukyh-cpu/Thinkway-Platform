"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeCommercials,
  type CommercialInputMode,
} from "@/lib/commercial/commercial-engine";
import {
  COMMERCIAL_CURRENCIES,
  formatDualCurrency,
  toEgp,
} from "@/lib/commercial/fx-aggregation";
import { useDebouncedAutosave, type AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import {
  creatorProfileSourceFromPlatformAccount,
  CreatorIdentityCell,
} from "@/components/creator/creator-profile-link";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import {
  COMMERCIAL_INPUT_MODE_LABELS,
  QUOTATION_STATUS_LABELS,
} from "@/features/quotations/constants";
import { AddCreatorsToQuotationButton } from "@/features/quotations/components/add-creators-to-quotation-modal";
import {
  removeQuotationItem,
  updateQuotationHeader,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";

function egp(n: number, decimals = 0): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary">
        <CheckIcon className="size-3" /> Saved
      </span>
    );
  if (status === "error")
    return <span className="text-xs text-destructive">Save failed</span>;
  return null;
}

type Totals = {
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
};

export function QuotationWorkspace({ detail }: { detail: QuotationDetail }) {
  const router = useRouter();
  const [totals, setTotals] = useState<Totals>({
    totalCostEgp: detail.total_cost_egp,
    totalRevenueEgp: detail.total_revenue_egp,
    totalGpValueEgp: detail.total_gp_value_egp,
    totalGpPct: detail.total_gp_pct,
  });

  const exportHref = useCallback(
    (format: string, download = true) =>
      `/api/quotations/${detail.id}/export?format=${format}${download ? "&download=1" : ""}`,
    [detail.id]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold tracking-tight">
                {detail.name}
              </h1>
              <Badge variant="secondary">
                {QUOTATION_STATUS_LABELS[detail.status]}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {detail.serial_number ?? "QT-PENDING"} ·{" "}
              {[detail.client_name, detail.brand_name, detail.campaign_name]
                .filter(Boolean)
                .join(" · ") || "No client linked"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddCreatorsToQuotationButton
              quotationId={detail.id}
              onAdded={() => router.refresh()}
            />
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("preview", false)} target="_blank" rel="noreferrer">
                <FileTextIcon className="size-4" /> Preview
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("excel")}>
                <FileSpreadsheetIcon className="size-4" /> Excel
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("word")}>
                <DownloadIcon className="size-4" /> Word
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref("pdf")}>
                <DownloadIcon className="size-4" /> PDF
              </a>
            </Button>
          </div>
        </div>

        {/* Totals strip (EGP) */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total Cost" value={egp(totals.totalCostEgp)} />
          <Stat label="Total Revenue" value={egp(totals.totalRevenueEgp)} />
          <Stat label="Gross Profit" value={egp(totals.totalGpValueEgp)} accent />
          <Stat label="GP %" value={`${totals.totalGpPct.toFixed(1)}%`} accent />
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
        {detail.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm font-medium">No creators yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add creators from a shortlist, Discovery selection, campaign, or manual entry.
            </p>
            <div className="mt-4 flex justify-center">
              <AddCreatorsToQuotationButton
                quotationId={detail.id}
                onAdded={() => router.refresh()}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Creator</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Followers</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Cost EGP</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead className="text-right">GP%</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((item) => (
                  <CommercialRow
                    key={item.id}
                    quotationId={detail.id}
                    item={item}
                    onTotals={setTotals}
                    onRemoved={() => router.refresh()}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <HeaderNotes detail={detail} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-base font-semibold tabular-nums ${accent ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function CommercialRow({
  quotationId,
  item,
  onTotals,
  onRemoved,
}: {
  quotationId: string;
  item: QuotationItemRow;
  onTotals: (t: Totals) => void;
  onRemoved: () => void;
}) {
  const [mode, setMode] = useState<CommercialInputMode>(item.commercial_input_mode);
  const [cost, setCost] = useState(String(item.cost || ""));
  const [currency, setCurrency] = useState(item.cost_currency || "EGP");
  const [gpPct, setGpPct] = useState(String(item.gp_pct || ""));
  const [revenue, setRevenue] = useState(String(item.revenue || ""));
  const [gpValue, setGpValue] = useState(String(item.gp_value || ""));
  const [rate, setRate] = useState(item.fx_rate_to_egp || 1);
  const [pending, startTransition] = useTransition();

  const { status, schedule } = useDebouncedAutosave<{
    mode: CommercialInputMode;
    cost: number | null;
    cost_currency: string;
    gp_pct?: number | null;
    revenue?: number | null;
    gp_value?: number | null;
  }>(async (payload) => {
    const res = await updateQuotationItemCommercials({
      item_id: item.id,
      quotation_id: quotationId,
      ...payload,
    });
    if (res.ok && res.data?.totals) {
      onTotals(res.data.totals);
    }
    return res;
  });

  // Instant client-side preview (EGP uses last known rate; server reconverts on save).
  const preview = useMemo(() => {
    const c = computeCommercials({
      mode,
      cost: Number(cost) || 0,
      gpPct: Number(gpPct) || 0,
      revenue: Number(revenue) || 0,
      gpValue: Number(gpValue) || 0,
    });
    return c;
  }, [mode, cost, gpPct, revenue, gpValue]);

  const effectiveRate = currency === "EGP" ? 1 : rate;

  function triggerSave(next: Partial<{ mode: CommercialInputMode; currency: string }>) {
    if (next.currency && next.currency !== "EGP" && next.currency !== currency) {
      // Optimistically reset rate to 1 until the server responds with the real one.
      setRate(1);
    }
    schedule({
      mode: next.mode ?? mode,
      cost: Number(cost) || 0,
      cost_currency: next.currency ?? currency,
      gp_pct: Number(gpPct) || 0,
      revenue: Number(revenue) || 0,
      gp_value: Number(gpValue) || 0,
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await removeQuotationItem({ item_id: item.id, quotation_id: quotationId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Creator removed.");
      onRemoved();
    });
  }

  return (
    <TableRow>
      <TableCell className="align-top">
        <CreatorIdentityCell
          source={creatorProfileSourceFromPlatformAccount(
            item.creator_name ?? item.handle ?? "Creator",
            item.platform
              ? {
                  platform: item.platform,
                  handle: item.handle ?? "",
                }
              : null
          )}
          size="sm"
          showName={false}
          showHandle={false}
        />
      </TableCell>
      <TableCell className="align-top">
        <CreatorIdentityCell
          source={creatorProfileSourceFromPlatformAccount(
            item.creator_name ?? item.handle ?? "Creator",
            item.platform
              ? {
                  platform: item.platform,
                  handle: item.handle ?? "",
                }
              : null
          )}
          size="sm"
          showAvatar={false}
          showName
          showHandle
        />
        <div className="mt-1">
          <SaveIndicator status={status} />
        </div>
      </TableCell>
      <TableCell className="align-top">
        {item.platform ? (
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <PlatformIcon platform={item.platform} size="xs" className="size-4 rounded-full" />
            <span className="truncate capitalize">{platformLabel(item.platform)}</span>
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="align-top text-right tabular-nums text-sm">
        {formatCreatorCount(item.followers)}
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-1">
          <Input
            className="w-24"
            inputMode="decimal"
            value={cost}
            onChange={(e) => {
              setCost(e.target.value);
              triggerSave({});
            }}
          />
          <Select
            value={mode}
            onValueChange={(v) => {
              const m = v as CommercialInputMode;
              setMode(m);
              triggerSave({ mode: m });
            }}
          >
            <SelectTrigger className="h-7 w-[130px] text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COMMERCIAL_INPUT_MODE_LABELS) as CommercialInputMode[]).map(
                (m) => (
                  <SelectItem key={m} value={m}>
                    {COMMERCIAL_INPUT_MODE_LABELS[m]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Select
          value={currency}
          onValueChange={(v) => {
            setCurrency(v);
            triggerSave({ currency: v });
          }}
        >
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMERCIAL_CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top text-right tabular-nums text-sm">
        {egp(toEgp(Number(cost) || 0, effectiveRate))}
      </TableCell>
      <TableCell className="align-top text-right">
        {mode === "cost_revenue" ? (
          <Input
            className="ml-auto w-24"
            inputMode="decimal"
            value={revenue}
            onChange={(e) => {
              setRevenue(e.target.value);
              triggerSave({});
            }}
          />
        ) : (
          <span className="tabular-nums text-sm">
            {formatDualCurrency({
              amount: preview.revenue,
              currency,
              egpAmount: toEgp(preview.revenue, effectiveRate),
            })}
          </span>
        )}
      </TableCell>
      <TableCell className="align-top text-right">
        {mode === "cost_gp_value" ? (
          <Input
            className="ml-auto w-24"
            inputMode="decimal"
            value={gpValue}
            onChange={(e) => {
              setGpValue(e.target.value);
              triggerSave({});
            }}
          />
        ) : (
          <span className="tabular-nums text-sm">
            {egp(toEgp(preview.gpValue, effectiveRate))}
          </span>
        )}
      </TableCell>
      <TableCell className="align-top text-right">
        {mode === "cost_gp_pct" ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              className="w-20"
              inputMode="decimal"
              value={gpPct}
              onChange={(e) => {
                setGpPct(e.target.value);
                triggerSave({});
              }}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        ) : (
          <span className="tabular-nums text-sm">{preview.gpPct.toFixed(1)}%</span>
        )}
        {preview.warning ? (
          <p className="mt-1 text-[11px] text-amber-600">{preview.warning}</p>
        ) : null}
      </TableCell>
      <TableCell className="align-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={pending}
          aria-label="Remove creator"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function HeaderNotes({ detail }: { detail: QuotationDetail }) {
  const [notes, setNotes] = useState(detail.notes ?? "");
  const [terms, setTerms] = useState(detail.terms ?? "");

  const { status, schedule } = useDebouncedAutosave<{
    notes?: string;
    terms?: string;
  }>(async (payload) => updateQuotationHeader({ id: detail.id, ...payload }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="quotation-notes">Quotation notes</Label>
          <SaveIndicator status={status} />
        </div>
        <Textarea
          id="quotation-notes"
          rows={5}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            schedule({ notes: e.target.value, terms });
          }}
          placeholder="Internal or client-facing notes for this quotation…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="quotation-terms">Terms &amp; conditions</Label>
        <Textarea
          id="quotation-terms"
          rows={5}
          value={terms}
          onChange={(e) => {
            setTerms(e.target.value);
            schedule({ notes, terms: e.target.value });
          }}
          placeholder="Payment terms, validity, usage rights…"
        />
      </div>
    </div>
  );
}
