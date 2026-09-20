"use client";

import { CampaignSummaryMoney } from "@/features/campaigns/components/campaign-money";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import {
  WalletIcon,
  ReceiptIcon,
  TrendingUpIcon,
  PercentIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { CampaignWorkspace } from "@/features/campaigns/types";
import { updateCampaignDisplayCurrencyAction } from "@/features/campaigns/actions";
import { CommercialCurrencySelect } from "@/features/commercial/components/commercial-currency-select";
import { formatPercent } from "@/features/campaigns/utils";
import { fromEgp } from "@/lib/commercial/fx-aggregation";
import { cn } from "@/lib/utils";

type CampaignKpiCardsProps = {
  workspace: CampaignWorkspace;
  className?: string;
};

type KpiCardDef = {
  id: string;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon: ReactNode;
  tint: "blue" | "slate" | "emer" | "violet";
  valueClassName?: string;
};

/** Aurora KPI cards — live financials; ISO currency, KPI precision (no decimals). */
export function CampaignKpiCards({ workspace, className }: CampaignKpiCardsProps) {
  const router = useRouter();
  const { financials, lines } = workspace;
  const displayCurrency = (workspace.currency_code || "EGP").toUpperCase();
  const displayFxRateToEgp = Number(workspace.financials.display_fx_rate_to_egp) || 1;
  const [currencyPending, startCurrencyTransition] = useTransition();


  const revenue = fromEgp(
    Number(financials.revenue_egp ?? financials.revenue ?? 0),
    displayCurrency,
    displayFxRateToEgp
  );
  const cost = fromEgp(
    Number(financials.cost_egp ?? financials.cost ?? 0),
    displayCurrency,
    displayFxRateToEgp
  );
  const gp = fromEgp(
    Number(financials.gp_egp ?? financials.gp ?? 0),
    displayCurrency,
    displayFxRateToEgp
  );
  const marginPercent =
    revenue > 0 ? Math.round((gp / revenue) * 10000) / 100 : financials.margin_percent;
  const marginHealthy = marginPercent >= 20;
  const marginWeak = marginPercent < 10;

  const handleCurrencyChange = (currency: string) => {
    const next = currency.toUpperCase();
    startCurrencyTransition(async () => {
      const saveRes = await updateCampaignDisplayCurrencyAction({ campaignId: workspace.id, currency: next });
      if (!saveRes.ok) {
        toast.error(saveRes.message ?? "Failed to update currency.");
        return;
      }
      router.refresh();
    });
  };

  const cards: KpiCardDef[] = [
    {
      id: "revenue",
      label: "Revenue",
      value: <CampaignSummaryMoney amount={revenue} currency={displayCurrency} metric="revenue" />,
      sub: "Billable campaign value",
      tint: "blue",
      icon: <WalletIcon aria-hidden />,
    },
    {
      id: "cost",
      label: "Cost",
      value: <CampaignSummaryMoney amount={cost} currency={displayCurrency} metric="cost" />,
      sub: "Committed vendor cost",
      tint: "slate",
      icon: <ReceiptIcon aria-hidden />,
    },
    {
      id: "gp",
      label: "Gross Profit",
      value: <CampaignSummaryMoney amount={gp} currency={displayCurrency} metric="gp" />,
      valueClassName:
        gp < 0 ? "text-[var(--camp-red-text)]" : "text-[var(--camp-green-text)]",
      sub: `${formatPercent(marginPercent)} GP`,
      tint: "emer",
      icon: <TrendingUpIcon aria-hidden />,
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(marginPercent),
      sub: (
        <>
          <span
            className={cn(
              "thinkway-aurora-chip-sm",
              marginWeak
                ? "bg-[var(--camp-red-bg)] text-[var(--camp-red-text)]"
                : marginHealthy
                  ? "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]"
                  : "bg-[var(--camp-amber-bg)] text-[var(--camp-amber-text)]"
            )}
          >
            {marginWeak ? "Watch" : marginHealthy ? "Healthy campaign" : "Moderate"}
          </span>
          <span>· {lines.length} creators</span>
        </>
      ),
      tint: "violet",
      icon: <PercentIcon aria-hidden />,
    },
  ];

  return (
    <div className={cn("thinkway-aurora-kpis", className)} role="group" aria-label="Campaign KPIs">
      <article className="thinkway-aurora-kpi thinkway-aurora-kpi--currency">
        <div className="thinkway-aurora-kpi-klab">CCY</div>
        <div className="thinkway-aurora-kpi-kval">
          <CommercialCurrencySelect
            label={null}
            layout="inline"
            value={displayCurrency}
            onChange={handleCurrencyChange}
            disabled={currencyPending}
          />
        </div>
        <div className="thinkway-aurora-kpi-ksub">Invoice and view currency</div>
      </article>
      {cards.map((card) => (
        <article key={card.id} className="thinkway-aurora-kpi">
          <div className="thinkway-aurora-kpi-ktop">
            <div className={cn("thinkway-aurora-kpi-ic", `tint-${card.tint}`)}>{card.icon}</div>
          </div>
          <div className="thinkway-aurora-kpi-klab">{card.label}</div>
          <div className={cn("thinkway-aurora-kpi-kval tabular-nums", card.valueClassName)}>
            {card.value}
          </div>
          <div className="thinkway-aurora-kpi-ksub">{card.sub}</div>
        </article>
      ))}
    </div>
  );
}
