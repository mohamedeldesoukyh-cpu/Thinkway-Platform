"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
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
import { formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { fromEgp } from "@/lib/commercial/fx-aggregation";
import { resolveCommercialRateToEgp } from "@/features/quotations/actions";
import { cn } from "@/lib/utils";

type CampaignKpiCardsProps = {
  workspace: CampaignWorkspace;
  className?: string;
};

type KpiCardDef = {
  id: string;
  label: string;
  value: string;
  sub: ReactNode;
  icon: ReactNode;
  tint: "blue" | "slate" | "emer" | "violet";
  valueClassName?: string;
};

/** Aurora KPI cards — live financials; ISO currency, KPI precision (no decimals). */
export function CampaignKpiCards({ workspace, className }: CampaignKpiCardsProps) {
  const router = useRouter();
  const { financials, lines } = workspace;
  const [displayCurrency, setDisplayCurrency] = useState(
    (workspace.currency_code || "EGP").toUpperCase()
  );
  const [displayFxRateToEgp, setDisplayFxRateToEgp] = useState(
    Number(financials.display_fx_rate_to_egp) > 0
      ? Number(financials.display_fx_rate_to_egp)
      : 1
  );
  const [currencyPending, startCurrencyTransition] = useTransition();

  useEffect(() => {
    setDisplayCurrency((workspace.currency_code || "EGP").toUpperCase());
    setDisplayFxRateToEgp(
      Number(financials.display_fx_rate_to_egp) > 0
        ? Number(financials.display_fx_rate_to_egp)
        : 1
    );
  }, [workspace.currency_code, financials.display_fx_rate_to_egp]);

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
    const previous = displayCurrency;
    setDisplayCurrency(next);
    startCurrencyTransition(async () => {
      const [rateRes, saveRes] = await Promise.all([
        resolveCommercialRateToEgp(next),
        updateCampaignDisplayCurrencyAction({
          campaignId: workspace.id,
          currency: next,
        }),
      ]);
      if (rateRes.ok && rateRes.data) {
        setDisplayFxRateToEgp(rateRes.data.rate);
      }
      if (!saveRes.ok) {
        toast.error(saveRes.message ?? "Failed to update currency.");
        setDisplayCurrency(previous);
        return;
      }
      router.refresh();
    });
  };

  const cards: KpiCardDef[] = [
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoneyCompact(revenue, displayCurrency),
      sub: "Billable campaign value",
      tint: "blue",
      icon: <WalletIcon aria-hidden />,
    },
    {
      id: "cost",
      label: "Cost",
      value: formatMoneyCompact(cost, displayCurrency),
      sub: "Committed vendor cost",
      tint: "slate",
      icon: <ReceiptIcon aria-hidden />,
    },
    {
      id: "gp",
      label: "Gross Profit",
      value: formatMoneyCompact(gp, displayCurrency),
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
