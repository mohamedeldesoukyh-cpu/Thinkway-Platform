"use client";

import { Suspense, useState } from "react";
import "@/app/styles/executive-dashboard.css";
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
  HomeDashboardSuite,
} from "@/features/home/components/home-dashboard-pack";
import { collectExecutiveConflicts } from "@/features/home/lib/home-dashboard-conflicts";
import type { AnalyticsKpiCard } from "@/lib/analytics/types/outputs";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import type { DashboardTrendPoint } from "@/lib/analytics/queries/dashboard-charts";
import type { FinanceAlert } from "@/lib/analytics/queries/dashboard-alerts";
import { formatPercent } from "@/lib/campaigns/utils";
import { formatMoneyKpi, formatMoneyDetail } from "@/lib/finance/currency-format";

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
  const [active, setActive] = useState<number | null>(null);
  const points = series.slice(-12);
  const high = Math.max(1, ...points.map(p => p.value));
  const low = Math.min(0, ...points.map(p => p.value));
  const y = (value: number) => 154 - ((value - low) / (high - low)) * 132;
  const step = 316 / Math.max(1, points.length);
  const colors = { "": "#145cf5", v: "#7960ca", g: "#12866e", y: "#b67b16", c: "#16849b" };
  const selected = active == null ? null : points[active];
  return <section className="ed-chart" aria-label={title}>
    <div className="ed-chart-heading"><h3>{title}</h3><span className="ed-chart-key" style={{ background: colors[tone] }} /></div>
    <p>{hint} · up to 12 periods</p>
    {points.length ? <>
      <div className="ed-chart-readout" aria-live="polite">{selected ? `${selected.label} · ${selected.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "Hover or focus a bar for its value"}</div>
      <svg viewBox="0 0 380 190" role="img" aria-label={`${title}: ${points.map(p => `${p.label}: ${p.value}`).join(", ")}`}>
        {[low, (high + low) / 2, high].map((value, i) => <g key={i}><line x1="52" x2="370" y1={y(value)} y2={y(value)} stroke="#e5ebf4" /><text x="46" y={y(value) + 4} textAnchor="end">{formatCompactMillions(value)}</text></g>)}
        <line x1="52" x2="370" y1={y(0)} y2={y(0)} stroke="#aab8cd" />
        {points.map((point, i) => <g key={`${point.period}-${i}`} tabIndex={0} role="button" aria-label={`${point.label}: ${point.value.toLocaleString("en-US")}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)}>
          <title>{point.label}: {point.value.toLocaleString("en-US")}</title>
          <rect x={54 + i * step} y="18" width={Math.max(2, step - 4)} height="140" fill="transparent" />
          <rect x={54 + i * step} y={Math.min(y(0), y(point.value))} width={Math.max(2, step - 5)} height={Math.abs(y(point.value) - y(0))} rx="2" fill={colors[tone]} opacity={active == null || active === i ? 1 : .45} />
          {(points.length <= 6 || i % 2 === 0 || i === points.length - 1) && <text x={54 + i * step + (step - 5) / 2} y="177" textAnchor="middle">{/^\d{4}-\d{2}$/.test(point.label) ? new Date(`${point.label}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }) : point.label === "unscheduled" ? "No date" : point.label}</text>}
        </g>)}
      </svg>
      <details className="ed-chart-data"><summary>View data</summary><table><thead><tr><th>Period</th><th>Amount</th></tr></thead><tbody>{points.map((p, i) => <tr key={i}><td>{p.label}</td><td>{p.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></details>
    </> : <div className="ed-chart-empty">No activity in the selected period</div>}
  </section>;
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
  const grossInvoiced = card(data, "invoiced_gross_current")?.value ?? 0;
  const collectedExceeds =
    (collected?.value ?? 0) > grossInvoiced * 1.05 &&
    grossInvoiced > 0;
  const mixCodes = currency.currencies.join(", ");
  const period = data.period_label ?? "All time";
  const money = (value: number) => formatAmount(value, mixed, ccy);

  const focusMessage = collectedExceeds
    ? `Collected exceeds invoiced by ${formatCompactMillions(
        (collected?.value ?? 0) - grossInvoiced
      )}`
    : (unbilled?.value ?? 0) > 0
      ? `${money(unbilled?.value ?? 0)} earned but not billed`
      : "No recognized revenue pending invoice";
  const focusSub = mixed
    ? `totals mix ${mixCodes} without FX conversion`
    : `${period} · ${ccy ?? "book"}`;

  return (
    <HomeDashboardSuite className="executive-redesign">
      <HomeDashboardMasthead
        page="dash"
        id={`FIN-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
        subtitle={`Financial overview · ${period}${
          mixed ? " · all currencies" : ccy ? ` · ${ccy}` : ""
        }`}
        badgeLabel={mixed ? "Mixed" : "Live"}
        badgeTone={mixed ? "r" : ""}
        userHandle={userHandle}
        metrics={[
          { label: "Recognized revenue", value: money(revenue?.value ?? 0) },
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
            value: data.meta.currency_count ?? currency.currencies.length,
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
          { href: "#trends", label: "Overview" },
          { href: "#pipeline", label: "Pipeline" },
          { href: "#conflicts", label: "Data checks", count: conflicts.length },
          { href: "#clients", label: "Clients" },
          { href: "#campaigns", label: "Campaigns" },
          { href: "#markets", label: "Markets" },
          { href: "#alerts", label: "Alerts", count: alertCount },
        ]}
      />

      <div className="tw-main">
        <HomeDashboardCard
          title="Filters"
          subtitle="Live-date revenue and GP · invoice issue dates · current balances"
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
            ) : (
              <div className="tw-note">
                Revenue and matching costs are recognized when ads are confirmed live, excluding VAT.
                Planned revenue: {money(card(data, "planned")?.value ?? 0)}.
                Recognized cost: {money(card(data, "recognized_cost")?.value ?? 0)}.
                Date filters apply to ad live dates and invoice issue dates. Collections, outstanding,
                unbilled and vendor payable show current balances; collections and payables include applicable VAT.
              </div>
            )
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

        {conflicts.length > 0 ? (
          <HomeDashboardCard
            id="conflicts"
            title="Data checks"
            subtitle="Review these differences before reporting"
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
          id="trends"
          title="Performance trends"
          subtitle={`${mixed ? "Mixed currencies · select one currency for comparison" : ccy ?? "Book currency"} · each chart uses its own scale`}
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
            <div className="ed-charts">
              <TrendBars
                title="Recognized revenue"
                hint="recognized by ad live month"
                tone=""
                series={data.charts.revenue_trend}
              />
              <TrendBars
                title="Gross profit"
                hint="recognized by ad live month"
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
                hint="collected to date, grouped by invoice month"
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
                invoiced={grossInvoiced}
                collected={collected?.value ?? 0}
                unbilled={unbilled?.value ?? 0}
                money={money}
              />
            </div>
          </div>
        </HomeDashboardCard>

        <HomeDashboardCard id="pipeline" title="Pipeline revenue" subtitle="Current approved client IOs · ads not yet live · excluding VAT">
          <div className="tw-pad">
            <strong className="tw-big">{money((data.pipeline ?? []).reduce((sum, row) => sum + row.pipeline_revenue, 0))}</strong>
            <p className="ed-pipeline-note">Approved work awaiting go-live. Current balance, excluding recognized revenue.</p>
            {(data.pipeline ?? []).length ? (
              <div style={{ overflowX: "auto" }}><table className="ed-pipeline-table">
                <thead><tr>{["Campaign / client", "Approved IO", "Approved revenue", "Already live", "Pipeline"].map(label => <th key={label} style={{ padding: 12 }}>{label}</th>)}</tr></thead>
                <tbody>{[...(data.pipeline ?? [])].sort((a, b) => b.pipeline_revenue - a.pipeline_revenue).map(row => <tr key={row.io_id}>
                  <td style={{ padding: 12 }}><a href={"/campaigns/" + row.campaign_header_id}>{row.campaign_name}</a><div>{row.client_name}</div></td>
                  <td style={{ padding: 12 }}><a href={"/ios/client/" + row.io_id + "/preview"}>{row.io_number}</a></td>
                  <td style={{ padding: 12 }}>{money(row.approved_revenue)}</td>
                  <td style={{ padding: 12 }}>{money(row.recognized_revenue)}</td>
                  <td style={{ padding: 12 }}><strong>{money(row.pipeline_revenue)}</strong><span className="ed-pipeline-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, row.pipeline_revenue) / Math.max(1, ...(data.pipeline ?? []).map(p => p.pipeline_revenue)) * 100}%` }} /></span></td>
                </tr>)}</tbody>
              </table></div>
            ) : <p>No approved client IO revenue awaiting go-live.</p>}
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
              subtitle="Clients ordered by lowest margin"
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
                                {mixed ? formatAmount(alert.amount, mixed, ccy) : formatMoneyDetail(alert.amount, ccy)}
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
    ["Invoiced incl. VAT", invoiced, "var(--tw-blue)"],
    ["Collected incl. VAT", collected, "var(--tw-ok)"],
    ["Unbilled excl. VAT", unbilled, "#B4780A"],
  ];
  return (
    <div className="ed-chart ed-balances">
      <div className="tw-ct" style={{ fontSize: 12 }}>
        Billing & collection position
      </div>
      <div className="tw-cs">Current balances · all dates for selected campaigns</div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>
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
                height: 10,
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
