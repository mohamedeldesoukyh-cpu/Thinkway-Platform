"use client";

import { Suspense } from "react";
import Link from "next/link";

import type {
  DashboardFilterOptions,
  ExecutiveDashboardPayload,
} from "@/features/analytics/load-executive-dashboard";
import { DashboardFilterBar } from "@/features/executive-dashboard/components/dashboard-filter-bar";
import { HomeDashboardMasthead } from "@/features/home/components/home-dashboard-masthead";
import {
  DASH_TABLE_COLS,
  HomeDashboardCard,
  HomeDashboardGrid,
  HomeDashboardRow,
  HomeDashboardSpark,
  HomeDashboardSuite,
  HomeDashboardTileGo,
} from "@/features/home/components/home-dashboard-pack";
import { collectExecutiveConflicts } from "@/features/home/lib/home-dashboard-conflicts";
import type { AnalyticsKpiCard } from "@/lib/analytics/types/outputs";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import type { DashboardTrendPoint } from "@/lib/analytics/queries/dashboard-charts";
import type { FinanceAlert } from "@/lib/analytics/queries/dashboard-alerts";
import { formatPercent } from "@/lib/campaigns/utils";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

type ExecutiveDashboardViewProps = {
  data: ExecutiveDashboardPayload;
  filterOptions: DashboardFilterOptions;
  userHandle: string;
};

const ALERT_GROUP_ORDER: FinanceAlert["group"][] = [
  "collections",
  "billing",
  "po",
  "profitability",
  "vendor",
];

const ALERT_GROUP_LABEL: Record<FinanceAlert["group"], string> = {
  collections: "Collections",
  billing: "Billing",
  po: "Purchase orders",
  profitability: "Profitability",
  vendor: "Vendor payments",
};

const ALERT_TONE: Record<FinanceAlert["group"], "r" | "y" | "b" | "v"> = {
  collections: "r",
  billing: "y",
  po: "b",
  profitability: "r",
  vendor: "v",
};

function card(data: ExecutiveDashboardPayload, id: string): AnalyticsKpiCard | undefined {
  return data.executive_kpis.cards.find((item) => item.id === id);
}

function formatAmount(
  amount: number,
  mixed: boolean,
  currency: string | null
): string {
  if (mixed) {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return formatMoneyKpi(amount, currency);
}

function MixMark({ mixed }: { mixed: boolean }) {
  if (!mixed) return null;
  return <span className="tw-mx"> MIX</span>;
}

function periodLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function ProfitRow({
  node,
  mixedBook,
}: {
  node: AnalyticsRollupNode;
  mixedBook: boolean;
}) {
  const mixed = mixedBook || node.currency.is_mixed_currency;
  const ccy = node.currency.primary_currency;
  const mg = node.metrics.margin_percent;
  return (
    <HomeDashboardRow cols={DASH_TABLE_COLS} tone={mg === 0 ? "bad" : ""}>
      <span className="tw-nm" title={node.label}>
        {node.label}
      </span>
      <span className="tw-v">
        {formatAmount(node.metrics.revenue, mixed, ccy)}
        <MixMark mixed={mixed} />
      </span>
      <span className={node.metrics.gp === 0 ? "tw-v z" : "tw-v"}>
        {formatAmount(node.metrics.gp, mixed, ccy)}
      </span>
      <span
        className={`tw-v ${mg >= 25 ? "pos" : mg < 15 ? "neg" : ""}`}
      >
        {mg.toFixed(1)}%
      </span>
    </HomeDashboardRow>
  );
}

function TrendBars({
  title,
  hint,
  tone,
  series,
}: {
  title: string;
  hint: string;
  tone: "" | "v" | "g" | "y" | "c";
  series: DashboardTrendPoint[];
}) {
  const points = series.slice(-8);
  const max = Math.max(1, ...points.map((point) => point.value));
  const first = points[0]?.label ?? "";
  const mid = points[Math.floor(points.length / 2)]?.label ?? "";
  const last = points[points.length - 1]?.label ?? "";
  return (
    <div>
      <div className="tw-ct" style={{ fontSize: 12 }}>
        {title}
      </div>
      <div className="tw-cs">{hint}</div>
      <div className="tw-bars">
        {points.map((point, index) => (
          <span
            key={`${point.period}-${index}`}
            className={tone ? `tw-bar ${tone}` : "tw-bar"}
            data-v={formatCompactMillions(point.value)}
            style={{
              height: `${Math.max(3, (point.value / max) * 100)}%`,
              animationDelay: `${240 + index * 60}ms`,
            }}
          />
        ))}
      </div>
      <div className="tw-ax">
        <span>{first}</span>
        <span>{mid}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

function formatCompactMillions(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function TableHeader() {
  return (
    <>
      <span>Name</span>
      <span style={{ textAlign: "right" }}>Revenue</span>
      <span style={{ textAlign: "right" }}>GP</span>
      <span style={{ textAlign: "right" }}>Margin</span>
    </>
  );
}

export function ExecutiveDashboardView({
  data,
  filterOptions,
  userHandle,
}: ExecutiveDashboardViewProps) {
  const currency = data.executive_kpis.currency;
  const mixed = currency.is_mixed_currency;
  const ccy = currency.primary_currency;
  const revenue = card(data, "revenue");
  const gp = card(data, "gp");
  const margin = card(data, "margin");
  const invoiced = card(data, "invoiced");
  const collected = card(data, "collected");
  const outstanding = card(data, "outstanding");
  const vendor = card(data, "vendor");
  const unbilled = card(data, "unbilled");
  const alertCount = data.alerts.alerts.length;
  const conflicts = collectExecutiveConflicts(data);
  const topClient = data.profitability_tables.top_clients[0] ?? null;
  const concentration =
    revenue && revenue.value > 0 && topClient
      ? Math.round((topClient.metrics.revenue / revenue.value) * 100)
      : 0;
  const unknownCountry = data.profitability_tables.country_profitability.find(
    (node) => !node.label || node.label.toLowerCase() === "unknown"
  );
  const zeroGpCampaign = data.profitability_tables.top_campaigns.find(
    (node) => node.metrics.revenue > 0 && node.metrics.gp === 0
  );
  const collectedExceeds =
    (collected?.value ?? 0) > (invoiced?.value ?? 0) * 1.05 &&
    (invoiced?.value ?? 0) > 0;
  const mixCodes = currency.currencies.join(", ");
  const period = periodLabel();
  const money = (value: number) => formatAmount(value, mixed, ccy);

  const pendingInvoiceCount = data.alerts.by_group.billing.length;
  const focusMessage = collectedExceeds
    ? `Collected exceeds invoiced by ${formatCompactMillions(
        (collected?.value ?? 0) - (invoiced?.value ?? 0)
      )}`
    : (unbilled?.value ?? 0) > 0
      ? `${money(unbilled?.value ?? 0)} earned but not billed`
      : "Books are current in this window";
  const focusSub = mixed
    ? `totals mix ${mixCodes} without FX conversion`
    : `${period} · ${ccy ?? "book"}`;

  return (
    <HomeDashboardSuite>
      <HomeDashboardMasthead
        page="dash"
        id={`FIN-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
        subtitle={`CFO-grade finance monitoring · ${period}${
          mixed ? " · all currencies" : ccy ? ` · ${ccy}` : ""
        }`}
        badgeLabel={mixed ? "Mixed" : "Live"}
        badgeTone={mixed ? "r" : ""}
        userHandle={userHandle}
        metrics={[
          { label: "Revenue", value: money(revenue?.value ?? 0) },
          { label: "GP", value: money(gp?.value ?? 0) },
          {
            label: "Margin",
            value: formatPercent(margin?.value ?? 0),
            tone: (margin?.value ?? 0) >= 20 ? "g" : undefined,
          },
          { label: "Invoiced", value: money(invoiced?.value ?? 0) },
          {
            label: "Collected",
            value: money(collected?.value ?? 0),
            tone: "g",
          },
          {
            label: "Outstanding",
            value: money(outstanding?.value ?? 0),
            tone: (outstanding?.value ?? 0) > 0 ? "r" : undefined,
          },
          {
            label: "Vendor payable",
            value: money(vendor?.value ?? 0),
            tone: (vendor?.value ?? 0) > 0 ? "r" : undefined,
          },
          {
            label: "Unbilled",
            value: money(unbilled?.value ?? 0),
            tone: (unbilled?.value ?? 0) > 0 ? "r" : undefined,
          },
          {
            label: "Alerts",
            value: alertCount,
            tone: alertCount > 0 ? "r" : undefined,
          },
          {
            label: "Currencies",
            value: currency.currencies.length || 1,
            tone: mixed ? "s" : undefined,
          },
        ]}
        bandMessage={focusMessage}
        bandSub={focusSub}
        bandHref="/"
        bandCta="Back to home"
        actions={
          <>
            <Link className="tw-b sm pri" href="/dashboard">
              Share snapshot
            </Link>
            <Link className="tw-b sm" href="/reports/pnl">
              Export
            </Link>
            <Link className="tw-b sm" href="/dashboard">
              Reset filters
            </Link>
          </>
        }
        jumps={[
          { href: "#conflicts", label: "Conflicts", count: conflicts.length },
          { href: "#trends", label: "Trends" },
          { href: "#clients", label: "Clients" },
          { href: "#campaigns", label: "Campaigns" },
          { href: "#markets", label: "Markets" },
          { href: "#alerts", label: "Alerts", count: alertCount },
        ]}
      />

      <div className="tw-main">
        <HomeDashboardCard
          title="Filters"
          subtitle="country, client, brand, currency, status"
          right={
            <Link className="tw-b sm" href="/dashboard">
              Reset
            </Link>
          }
          note={
            mixed ? (
              <div className="tw-note wrn">
                <b>Currency is “All currencies”.</b> Every total below is a
                mixed-unit sum. Pick {currency.currencies.join(", ")} to get a
                figure you can report.
              </div>
            ) : null
          }
        >
          <div className="tw-pad">
            <Suspense
              fallback={
                <div className="tw-cs">Loading filters…</div>
              }
            >
              <DashboardFilterBar options={filterOptions} variant="pack" />
            </Suspense>
          </div>
        </HomeDashboardCard>

        <div className="tw-tiles" style={{ marginBottom: 14 }}>
          <a className="tw-tile" href="#clients">
            <div className="tw-tl">
              <i>Revenue · {period}</i>
              <span className="tw-big">{money(revenue?.value ?? 0)}</span>
              <p>
                {mixed
                  ? `Mixed ${mixCodes} · not FX-converted`
                  : `${ccy ?? "Book"} · this window`}
              </p>
              <HomeDashboardSpark
                values={sparkFromSeries(data.charts.revenue_trend)}
                highlightFrom={0}
              />
              <HomeDashboardTileGo>
                {mixed ? "Set a single currency" : "Top clients"}
              </HomeDashboardTileGo>
            </div>
          </a>
          <a className="tw-tile soft" href="#clients">
            <div className="tw-tl">
              <i>Margin</i>
              <span className="tw-big">{formatPercent(margin?.value ?? 0)}</span>
              <p>
                {money(gp?.value ?? 0)} gross profit on {money(revenue?.value ?? 0)}
              </p>
              <HomeDashboardTileGo>Profitability breakdown</HomeDashboardTileGo>
            </div>
          </a>
          <a className="tw-tile alt" href="#alerts">
            <div className="tw-tl">
              <i>Unbilled achieved revenue</i>
              <span className="tw-big">{money(unbilled?.value ?? 0)}</span>
              <p>
                {(invoiced?.value ?? 0) > 0
                  ? `${(((unbilled?.value ?? 0) / (invoiced?.value ?? 1))).toFixed(1)}× what has actually been invoiced (${money(invoiced?.value ?? 0)})`
                  : "No invoices in this window"}
              </p>
              <HomeDashboardTileGo>
                {pendingInvoiceCount > 0
                  ? `${pendingInvoiceCount} campaigns pending`
                  : "Review billing"}
              </HomeDashboardTileGo>
            </div>
          </a>
          <a className="tw-tile" href="#clients">
            <div className="tw-tl">
              <i>Client concentration</i>
              <span className="tw-big">{concentration}%</span>
              <p>
                {topClient
                  ? `${topClient.label} · ${money(topClient.metrics.revenue)} of the book`
                  : "No client rollup in this window"}
              </p>
              <HomeDashboardSpark
                values={concentrationSpark(data.profitability_tables.top_clients)}
                highlightFrom={0}
              />
              <HomeDashboardTileGo>Top clients</HomeDashboardTileGo>
            </div>
          </a>
        </div>

        {conflicts.length > 0 ? (
          <HomeDashboardCard
            id="conflicts"
            title="Read this before quoting any total"
            subtitle="figures on this page contradict each other"
            right={<span className="tw-p p-r">{conflicts.length} conflicts</span>}
          >
            <div className="tw-pad" style={{ background: "var(--tw-badb)" }}>
              {conflicts.map((conflict, index) => (
                <div key={conflict.id} className="tw-cfi">
                  <span className="tw-cfn">{index + 1}</span>
                  <span>{conflict.body}</span>
                </div>
              ))}
            </div>
          </HomeDashboardCard>
        ) : (
          <div id="conflicts" />
        )}

        <HomeDashboardCard
          title="Position"
          subtitle={mixed ? `all currencies · ${period}` : `${ccy} · ${period}`}
        >
          <div className="tw-pad">
            <div className="tw-jr">
              <div className="tw-jn">
                <i>Revenue</i>
                <b>{money(revenue?.value ?? 0)}</b>
                <u>{mixed ? "MIX" : ccy}</u>
              </div>
              <div className="tw-jn">
                <i>GP</i>
                <b>{money(gp?.value ?? 0)}</b>
                <u>{mixed ? "MIX" : ccy}</u>
              </div>
              <div className={(margin?.value ?? 0) >= 20 ? "tw-jn ok" : "tw-jn"}>
                <i>Margin</i>
                <b>{formatPercent(margin?.value ?? 0)}</b>
                <u>{(margin?.value ?? 0) >= 20 ? "healthy" : "watch"}</u>
              </div>
              <div className="tw-jn">
                <i>Total invoiced</i>
                <b>{money(invoiced?.value ?? 0)}</b>
                <u>{mixed ? "MIX" : ccy}</u>
              </div>
              <div className={collectedExceeds ? "tw-jn miss" : "tw-jn"}>
                <i>Collected</i>
                <b>{money(collected?.value ?? 0)}</b>
                <u>{collectedExceeds ? "exceeds invoiced" : mixed ? "MIX" : ccy}</u>
              </div>
              <div className={(outstanding?.value ?? 0) > 0 ? "tw-jn miss" : "tw-jn"}>
                <i>Outstanding</i>
                <b>{money(outstanding?.value ?? 0)}</b>
                <u>{mixed ? "MIX" : ccy}</u>
              </div>
              <div className={(vendor?.value ?? 0) > 0 ? "tw-jn miss" : "tw-jn"}>
                <i>Vendor payable</i>
                <b>{money(vendor?.value ?? 0)}</b>
                <u>{mixed ? "MIX" : ccy}</u>
              </div>
              <div className={(unbilled?.value ?? 0) > 0 ? "tw-jn miss" : "tw-jn"}>
                <i>Unbilled achieved</i>
                <b>{money(unbilled?.value ?? 0)}</b>
                <u>{mixed ? "MIX" : ccy}</u>
              </div>
            </div>
          </div>
        </HomeDashboardCard>

        <HomeDashboardCard
          id="trends"
          title="Performance trends"
          subtitle="revenue, GP, billing, collections and PO by period"
          note={
            collectedExceeds ? (
              <div className="tw-note bad">
                Collected exceeds invoiced — these bars are drawn from two figures
                that cannot both be true.
              </div>
            ) : null
          }
        >
          <div className="tw-pad">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
                gap: 13,
              }}
            >
              <TrendBars
                title="Revenue"
                hint="planned by campaign start month"
                tone=""
                series={data.charts.revenue_trend}
              />
              <TrendBars
                title="Gross profit"
                hint="by campaign start month"
                tone="v"
                series={data.charts.gp_trend}
              />
              <TrendBars
                title="Billing"
                hint="invoiced by issue month"
                tone="g"
                series={data.charts.billing_trend}
              />
              <TrendBars
                title="Collections"
                hint="cash collected by payment month"
                tone="c"
                series={data.charts.collections_trend}
              />
              <TrendBars
                title="PO consumption"
                hint="consumed by campaign start month"
                tone="y"
                series={data.charts.po_consumption_trend}
              />
              <BillingVsCollections
                invoiced={invoiced?.value ?? 0}
                collected={collected?.value ?? 0}
                unbilled={unbilled?.value ?? 0}
                money={money}
              />
            </div>
          </div>
        </HomeDashboardCard>

        <div className="tw-two">
          <div>
            <HomeDashboardCard
              id="clients"
              title="Top clients"
              subtitle={`${data.profitability_tables.top_clients.length} clients · highest revenue`}
              note={
                concentration >= 40 && topClient ? (
                  <div className="tw-note">
                    <b>
                      {topClient.label} is {concentration}% of total revenue.
                    </b>
                  </div>
                ) : null
              }
            >
              <HomeDashboardGrid
                cols={DASH_TABLE_COLS}
                minWidth={560}
                header={<TableHeader />}
              >
                {data.profitability_tables.top_clients.slice(0, 8).map((node) => (
                  <ProfitRow key={node.key} node={node} mixedBook={mixed} />
                ))}
              </HomeDashboardGrid>
            </HomeDashboardCard>

            <HomeDashboardCard
              id="campaigns"
              title="Top campaigns"
              subtitle={`${data.profitability_tables.top_campaigns.length} campaigns`}
              note={
                zeroGpCampaign ? (
                  <div className="tw-note bad">
                    <b>{zeroGpCampaign.label}</b> returns zero gross profit on{" "}
                    {formatAmount(
                      zeroGpCampaign.metrics.revenue,
                      mixed || zeroGpCampaign.currency.is_mixed_currency,
                      zeroGpCampaign.currency.primary_currency
                    )}
                    .
                  </div>
                ) : null
              }
            >
              <HomeDashboardGrid
                cols={DASH_TABLE_COLS}
                minWidth={560}
                header={<TableHeader />}
              >
                {data.profitability_tables.top_campaigns.map((node) => (
                  <ProfitRow key={node.key} node={node} mixedBook={mixed} />
                ))}
              </HomeDashboardGrid>
            </HomeDashboardCard>

            <HomeDashboardCard
              title="Brand profitability"
              subtitle={`${data.profitability_tables.brand_profitability.length} brands`}
            >
              <HomeDashboardGrid
                cols={DASH_TABLE_COLS}
                minWidth={560}
                header={<TableHeader />}
              >
                {data.profitability_tables.brand_profitability.map((node) => (
                  <ProfitRow key={node.key} node={node} mixedBook={mixed} />
                ))}
              </HomeDashboardGrid>
            </HomeDashboardCard>
          </div>

          <div>
            <HomeDashboardCard
              title="Lowest margin clients"
              subtitle="same book, reversed"
            >
              <HomeDashboardGrid
                cols={DASH_TABLE_COLS}
                minWidth={460}
                header={<TableHeader />}
              >
                {data.profitability_tables.lowest_margin_clients
                  .slice(0, 8)
                  .map((node) => (
                    <ProfitRow key={node.key} node={node} mixedBook={mixed} />
                  ))}
              </HomeDashboardGrid>
            </HomeDashboardCard>

            <HomeDashboardCard
              id="markets"
              title="Country profitability"
              subtitle="GP by market"
              note={
                unknownCountry ? (
                  <div className="tw-note wrn">
                    <b>“Unknown” is a country.</b>{" "}
                    {formatAmount(
                      unknownCountry.metrics.revenue,
                      mixed || unknownCountry.currency.is_mixed_currency,
                      unknownCountry.currency.primary_currency
                    )}{" "}
                    has no market attached, so the country filter silently drops
                    it.
                  </div>
                ) : null
              }
            >
              <HomeDashboardGrid
                cols={DASH_TABLE_COLS}
                minWidth={460}
                header={<TableHeader />}
              >
                {data.profitability_tables.country_profitability.map((node) => (
                  <ProfitRow key={node.key} node={node} mixedBook={mixed} />
                ))}
              </HomeDashboardGrid>
            </HomeDashboardCard>

            <HomeDashboardCard
              id="alerts"
              title="Finance alerts"
              subtitle={`${alertCount} signals · grouped`}
            >
              <div className="tw-alw">
                {ALERT_GROUP_ORDER.map((group) => {
                  const items = data.alerts.by_group[group];
                  if (items.length === 0) return null;
                  const tone = ALERT_TONE[group];
                  const shown = items.slice(0, 8);
                  return (
                    <div key={group}>
                      <div className="tw-alg">
                        <span className={tone === "r" ? "tw-live" : "tw-live on"} />
                        {ALERT_GROUP_LABEL[group]}
                        <span className={`tw-n ${tone}`}>{items.length}</span>
                        <span style={{ flex: 1 }} />
                        {shown.length < items.length ? (
                          <span
                            className="tw-cs"
                            style={{
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          >
                            {shown.length} of {items.length} shown
                          </span>
                        ) : null}
                      </div>
                      {shown.map((alert) => (
                        <Link key={alert.id} href={alert.href} className="tw-ai2">
                          <span className={`dt ${tone}`} />
                          <span>
                            <h5>{alert.title}</h5>
                            <p>{alert.description}</p>
                            {alert.amount != null ? (
                              <b>
                                {formatAmount(alert.amount, mixed, ccy)}
                                {mixed ? (
                                  <span className="tw-mx"> currency label unreliable</span>
                                ) : null}
                              </b>
                            ) : null}
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
                {alertCount === 0 ? (
                  <div className="tw-pad">
                    <p className="tw-cs">No active alerts for the current filter set.</p>
                  </div>
                ) : null}
              </div>
            </HomeDashboardCard>
          </div>
        </div>
      </div>
    </HomeDashboardSuite>
  );
}

function sparkFromSeries(series: DashboardTrendPoint[]): number[] {
  const points = series.slice(-8);
  if (points.length === 0) return [20, 28, 24, 36, 40, 48, 44, 60];
  const max = Math.max(1, ...points.map((point) => point.value));
  const values = points.map((point) => Math.max(4, Math.round((point.value / max) * 100)));
  while (values.length < 8) values.unshift(values[0] ?? 8);
  return values.slice(-8);
}

function concentrationSpark(clients: AnalyticsRollupNode[]): number[] {
  const top = clients.slice(0, 8);
  const max = Math.max(1, ...top.map((node) => node.metrics.revenue));
  const values = top.map((node) =>
    Math.max(4, Math.round((node.metrics.revenue / max) * 100))
  );
  while (values.length < 8) values.push(4);
  return values;
}

function BillingVsCollections({
  invoiced,
  collected,
  unbilled,
  money,
}: {
  invoiced: number;
  collected: number;
  unbilled: number;
  money: (value: number) => string;
}) {
  const max = Math.max(1, invoiced, collected, unbilled);
  const rows: [string, number, string][] = [
    ["Invoiced", invoiced, "var(--tw-blue)"],
    ["Collected", collected, "var(--tw-ok)"],
    ["Unbilled", unbilled, "#B4780A"],
  ];
  return (
    <div>
      <div className="tw-ct" style={{ fontSize: 12 }}>
        Billing vs collections
      </div>
      <div className="tw-cs">invoiced, collected, unbilled</div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([label, value, color], index) => (
          <div key={label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10.5,
                marginBottom: 3,
              }}
            >
              <span className="tw-cs">{label}</span>
              <span className="tw-v" style={{ fontSize: 11 }}>
                {money(value)}
              </span>
            </div>
            <div
              style={{
                height: 7,
                borderRadius: 4,
                background: "var(--tw-hair)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 4,
                  background: color,
                  width: `${((value / max) * 100).toFixed(1)}%`,
                  transformOrigin: "left",
                  animation: `home-dash-grow .7s var(--tw-ez) ${260 + index * 100}ms both`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
