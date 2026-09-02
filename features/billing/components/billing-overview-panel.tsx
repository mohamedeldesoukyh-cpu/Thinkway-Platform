"use client";

import { useMemo } from "react";

import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { labelForBillingStatus } from "@/features/billing/constants";
import type { CampaignBillingQueueRow, CampaignLineBillingStatus } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type BillingOverviewPanelProps = {
  campaigns: CampaignBillingQueueRow[];
};

type ClientSummary = {
  name: string;
  campaigns: number;
  currency: string | "mixed";
  value: number;
  invoiced: number;
};

export function BillingOverviewPanel({ campaigns }: BillingOverviewPanelProps) {
  const { byClient, byCurrency, byStatus, totalValue } = useMemo(() => {
    const clients = new Map<string, ClientSummary>();
    const currencies = new Map<string, number>();
    const statuses = new Map<CampaignLineBillingStatus, number>();

    for (const row of campaigns) {
      const existing = clients.get(row.client_name);
      if (!existing) {
        clients.set(row.client_name, {
          name: row.client_name,
          campaigns: 1,
          currency: row.currency_code,
          value: row.total_campaign_amount,
          invoiced: row.already_invoiced,
        });
      } else {
        existing.campaigns += 1;
        existing.value += row.total_campaign_amount;
        existing.invoiced += row.already_invoiced;
        if (existing.currency !== row.currency_code) existing.currency = "mixed";
      }

      currencies.set(
        row.currency_code,
        (currencies.get(row.currency_code) ?? 0) + row.total_campaign_amount
      );
      statuses.set(row.billing_status, (statuses.get(row.billing_status) ?? 0) + 1);
    }

    const byClient = [...clients.values()].sort((a, b) => b.value - a.value);
    const totalValue = byClient.reduce((sum, row) => sum + row.value, 0);

    return {
      byClient,
      byCurrency: [...currencies.entries()].sort((a, b) => b[1] - a[1]),
      byStatus: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
      totalValue,
    };
  }, [campaigns]);

  if (campaigns.length === 0) {
    return (
      <div className="bq-card">
        <div className="bq-card__h">
          <span className="bq-card__t">Overview</span>
        </div>
        <p className="px-4 py-8 text-[11px] text-muted-foreground">
          No campaigns in the billing queue yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bq-two">
      <div className="bq-card">
        <div className="bq-card__h">
          <span className="bq-card__t">By client</span>
          <span className="bq-card__s">native amounts — mixed currencies are not converted</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_74px_128px_128px_112px] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Client
          </span>
          <span className="text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Campaigns
          </span>
          <span className="text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Value
          </span>
          <span className="text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Invoiced
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Share
          </span>
        </div>
        {byClient.map((row) => {
          const share = totalValue > 0 ? Math.round((row.value / totalValue) * 100) : 0;
          return (
            <div
              key={row.name}
              className="grid grid-cols-[minmax(0,1fr)_74px_128px_128px_112px] items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-b-0"
            >
              <span className="truncate text-[13px] font-medium">{row.name}</span>
              <span className="bq-n text-right text-xs">{row.campaigns}</span>
              <span className="bq-n text-right text-xs">
                {row.currency === "mixed"
                  ? row.value.toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : formatBillingMoney(row.value, row.currency)}
              </span>
              <span
                className={`bq-n text-right text-xs ${row.invoiced > 0 ? "bq-v-pos" : "bq-v-z"}`}
              >
                {row.currency === "mixed"
                  ? row.invoiced.toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : formatBillingMoney(row.invoiced, row.currency)}
              </span>
              <span className="bq-bar" title={`${share}%`}>
                <i style={{ width: `${share}%` }} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="bq-card">
          <div className="bq-card__h">
            <span className="bq-card__t">By currency</span>
            <span className="bq-card__s">native, unconverted</span>
          </div>
          <div className="space-y-1 px-4 py-3">
            {byCurrency.map(([code, amount]) => (
              <div key={code} className="flex items-center gap-2 py-1.5">
                <span className="bq-cc">{code}</span>
                <span className="flex-1" />
                <span className="bq-n text-xs font-semibold">{formatBillingMoney(amount, code)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bq-card">
          <div className="bq-card__h">
            <span className="bq-card__t">By status</span>
          </div>
          <div className="space-y-1 px-4 py-3">
            {byStatus.map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 py-1.5">
                <BillingStatusBadge status={status} />
                <span className="sr-only">{labelForBillingStatus(status)}</span>
                <span className="flex-1" />
                <span className="bq-n text-xs font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
