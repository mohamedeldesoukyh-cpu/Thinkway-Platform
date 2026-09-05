import Link from "next/link";

import type { ExecutiveDashboardPayload } from "@/features/analytics/load-executive-dashboard";
import { HomeDashboardMasthead } from "@/features/home/components/home-dashboard-masthead";
import {
  HomeDashboardCard,
  HomeDashboardGrid,
  HomeDashboardPoRing,
  HomeDashboardQuickAccess,
  HomeDashboardRow,
  HomeDashboardSpark,
  HomeDashboardSuite,
  HomeDashboardTileGo,
  HOME_QUEUE_COLS,
  avatarTone,
  formatCompactCount,
} from "@/features/home/components/home-dashboard-pack";
import {
  collectHomeConflicts,
  overdueFromExecutive,
} from "@/features/home/lib/home-dashboard-conflicts";
import type { HomeDashboardSnapshot } from "@/features/home/queries";
import { formatPercent } from "@/lib/campaigns/utils";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import type { FinanceAlert } from "@/lib/analytics/queries/dashboard-alerts";

type HomePageProps = {
  snapshot: HomeDashboardSnapshot;
  executive?: ExecutiveDashboardPayload | null;
};

const QUEUE_META: Record<
  FinanceAlert["group"],
  { tone: "r" | "y" | "b" | "v"; icon: string; title: string }
> = {
  collections: { tone: "r", icon: "⚠", title: "Overdue invoice" },
  billing: { tone: "y", icon: "◎", title: "Unbilled achieved revenue" },
  vendor: { tone: "v", icon: "◑", title: "Vendor payment exposure" },
  po: { tone: "b", icon: "▦", title: "Purchase orders at limit" },
  profitability: { tone: "r", icon: "▼", title: "Zero-margin campaign" },
};

const GROUP_ORDER: FinanceAlert["group"][] = [
  "collections",
  "billing",
  "vendor",
  "po",
  "profitability",
];

function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function HomePage({ snapshot, executive = null }: HomePageProps) {
  const now = new Date();
  const currency = snapshot.currency_code;
  const money = (value: number) => formatMoneyKpi(value, currency);
  const alerts = executive?.alerts;
  const alertCount = alerts?.alerts.length ?? 0;
  const unbilled = executive?.meta.unbilled_achieved_revenue ?? 0;
  const overdue = overdueFromExecutive(executive);
  const moneyAtRisk = unbilled + overdue.amount;
  const liveCampaigns =
    snapshot.recent_campaigns.filter((campaign) => campaign.status === "active")
      .length || snapshot.active_campaigns;
  const poHeadroom = Math.max(0, snapshot.po_total - snapshot.po_consumed);
  const conflicts = collectHomeConflicts({ snapshot, executive });
  const pendingInvoiceCount = alerts?.by_group.billing.length ?? 0;

  const queue = GROUP_ORDER.map((group) => {
    const items = alerts?.by_group[group] ?? [];
    if (items.length === 0) return null;
    const meta = QUEUE_META[group];
    const exposure = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const first = items[0];
    return {
      group,
      tone: meta.tone,
      icon: meta.icon,
      title: first?.title ?? meta.title,
      detail: first?.description ?? `${items.length} signals`,
      href: first?.href ?? "/dashboard",
      exposure: exposure > 0 ? exposure : null,
      count: items.length,
    };
  }).filter((row): row is NonNullable<typeof row> => row != null);

  const queueExposure = queue.reduce((sum, row) => sum + (row.exposure ?? 0), 0);

  const focusMessage =
    unbilled > 0
      ? `${money(unbilled)} is earned but not billed`
      : snapshot.outstanding_revenue > 0
        ? `${money(snapshot.outstanding_revenue)} outstanding`
        : "Books are current";
  const focusSub =
    pendingInvoiceCount > 0
      ? `${pendingInvoiceCount} campaign${pendingInvoiceCount === 1 ? "" : "s"} pending invoice${
          overdue.count > 0
            ? ` · ${overdue.count} invoice${overdue.count === 1 ? "" : "s"} past 60 days`
            : ""
        }`
      : overdue.count > 0
        ? `${overdue.count} invoice${overdue.count === 1 ? "" : "s"} past 60 days`
        : `${snapshot.active_campaigns} live campaigns`;

  return (
    <HomeDashboardSuite>
      <HomeDashboardMasthead
        page="home"
        id="HOME"
        subtitle={`${formatDateLabel(now)} · ${formatPeriodLabel(now)} period · MENA`}
        badgeLabel="Live"
        userHandle={snapshot.userHandle}
        metrics={[
          { label: "Needs action", value: alertCount, tone: alertCount > 0 ? "r" : undefined },
          {
            label: "Money at risk",
            value: money(moneyAtRisk || snapshot.outstanding_revenue),
            tone: moneyAtRisk > 0 || snapshot.outstanding_revenue > 0 ? "r" : undefined,
          },
          { label: "Revenue", value: money(snapshot.total_revenue) },
          { label: "Gross profit", value: money(snapshot.gross_profit) },
          {
            label: "Margin",
            value: formatPercent(snapshot.margin_percent),
            tone: snapshot.margin_percent >= 20 ? "g" : undefined,
          },
          {
            label: "Outstanding",
            value: money(snapshot.outstanding_revenue),
            tone: snapshot.outstanding_revenue > 0 ? "r" : undefined,
          },
          { label: "Vendors", value: snapshot.active_vendors },
          { label: "Assignments", value: snapshot.assignments_count },
          {
            label: "PO consumed",
            value: `${snapshot.po_consumed_percent}%`,
            tone: snapshot.po_consumed_percent >= 90 ? "r" : undefined,
          },
          {
            label: "Campaigns live",
            value: snapshot.active_campaigns,
            tone: snapshot.active_campaigns > 0 ? "g" : undefined,
          },
        ]}
        bandMessage={focusMessage}
        bandSub={focusSub}
        bandHref="/dashboard"
        bandCta="Open dashboard"
        actions={
          <>
            <Link className="tw-b sm pri" href="/campaigns">
              + New campaign
            </Link>
            <Link className="tw-b sm" href="/billing">
              Review billing
            </Link>
            <Link className="tw-b sm" href="/collections">
              Chase collections
            </Link>
            <Link className="tw-b sm" href="/studio">
              Open Studio
            </Link>
          </>
        }
        jumps={[
          { href: "#needs-action", label: "Needs action", count: alertCount },
          { href: "#conflicts", label: "Conflicts", count: conflicts.length },
          { href: "#position", label: "Position" },
          { href: "#campaigns", label: "Campaigns" },
          { href: "#vendors", label: "Vendors" },
          { href: "#quick-access", label: "Quick access" },
        ]}
      />

      <div className="tw-main">
        <div className="tw-tiles" style={{ marginBottom: 14 }}>
          <Link className="tw-tile" href="/billing">
            <button type="button" className="tw-star" tabIndex={-1} aria-hidden>
              ★
            </button>
            <div className="tw-tl">
              <i>Money at risk</i>
              <span className="tw-big">{money(moneyAtRisk || snapshot.outstanding_revenue)}</span>
              <p>
                Unbilled {money(unbilled)}
                {overdue.amount > 0 ? ` + overdue ${money(overdue.amount)}` : ""}
              </p>
              <HomeDashboardSpark
                values={[18, 24, 31, 40, 52, 66, 81, 100]}
                highlightFrom={5}
              />
              <HomeDashboardTileGo>Review billing queue</HomeDashboardTileGo>
            </div>
          </Link>

          <Link className="tw-tile alt" href="/dashboard">
            <div className="tw-tl">
              <i>Needs action</i>
              <span className="tw-big">{alertCount}</span>
              <p>
                Across {queue.length || 0} alert group
                {queue.length === 1 ? "" : "s"}
                {overdue.count > 0 ? ` · oldest past 60 days` : ""}
              </p>
              <HomeDashboardTileGo>Open dashboard</HomeDashboardTileGo>
            </div>
          </Link>

          <Link className="tw-tile" href="/finance/po-tracker">
            <div className="tw-tl">
              <i>PO consumption</i>
              <div
                style={{
                  display: "flex",
                  gap: 13,
                  alignItems: "center",
                  margin: "6px 0 2px",
                }}
              >
                <HomeDashboardPoRing percent={snapshot.po_consumed_percent} />
                <p style={{ flex: 1 }}>
                  {money(snapshot.po_consumed)} of {money(snapshot.po_total)}.
                  <br />
                  {snapshot.po_consumed_percent >= 90 ? (
                    <>
                      Only <b>{money(poHeadroom)}</b> headroom — renewal required.
                    </>
                  ) : (
                    <>{money(poHeadroom)} remaining on approved PO.</>
                  )}
                </p>
              </div>
              <HomeDashboardTileGo>Open PO tracker</HomeDashboardTileGo>
            </div>
          </Link>

          <Link className="tw-tile soft" href="/campaigns">
            <div className="tw-tl">
              <i>Live campaigns</i>
              <span className="tw-big">{liveCampaigns}</span>
              <p>
                {snapshot.active_campaigns} active · {snapshot.assignments_count}{" "}
                assignments · {snapshot.active_vendors} vendors
              </p>
              <HomeDashboardSpark
                values={[40, 55, 48, 70, 62, 88, 74, 100]}
                highlightFrom={6}
              />
              <HomeDashboardTileGo>All campaigns</HomeDashboardTileGo>
            </div>
          </Link>
        </div>

        <div className="tw-two">
          <div>
            <HomeDashboardCard
              id="needs-action"
              title="Needs you today"
              subtitle="ranked by exposure, not by date"
              right={
                <>
                  <span className="tw-p p-r">{alertCount} open</span>
                  <Link className="tw-b sm" href="/dashboard">
                    All alerts
                  </Link>
                </>
              }
            >
              {queue.length > 0 ? (
                <HomeDashboardGrid
                  cols={HOME_QUEUE_COLS}
                  minWidth={600}
                  header={
                    <>
                      <span />
                      <span>Signal</span>
                      <span style={{ textAlign: "right" }}>Exposure</span>
                      <span style={{ textAlign: "right" }}>Act</span>
                    </>
                  }
                  footer={
                    <>
                      <span />
                      <span>
                        {queue.length} group{queue.length === 1 ? "" : "s"} · {alertCount}{" "}
                        signals
                      </span>
                      <span className="tw-v neg">{money(queueExposure)}</span>
                      <span />
                    </>
                  }
                >
                  {queue.map((row) => (
                    <HomeDashboardRow
                      key={row.group}
                      cols={HOME_QUEUE_COLS}
                      tone={row.tone === "r" ? "bad" : "wrn"}
                    >
                      <span>
                        <span className={`tw-qi ${row.tone}`}>{row.icon}</span>
                      </span>
                      <span>
                        <span className="tw-nm">
                          {row.title}
                          <span className={`tw-n ${row.tone}`}>{row.count}</span>
                        </span>
                        <span className="tw-qd">{row.detail}</span>
                      </span>
                      <span className={row.exposure ? "tw-v neg" : "tw-v z"}>
                        {row.exposure == null ? "—" : money(row.exposure)}
                      </span>
                      <span className="tw-act">
                        <Link className="tw-b sm" href={row.href}>
                          Review
                        </Link>
                      </span>
                    </HomeDashboardRow>
                  ))}
                </HomeDashboardGrid>
              ) : (
                <div className="tw-pad">
                  <p className="tw-cs">No open finance alerts in this window.</p>
                </div>
              )}
            </HomeDashboardCard>

            {conflicts.length > 0 ? (
              <HomeDashboardCard
                id="conflicts"
                title="These numbers disagree"
                subtitle="resolve before reporting"
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
              id="position"
              title="Position"
              subtitle={`${formatPeriodLabel(now)} · ${currency}`}
            >
              <div className="tw-pad">
                <div className="tw-jr">
                  <div className="tw-jn ok">
                    <i>Revenue</i>
                    <b>{money(snapshot.total_revenue)}</b>
                    <u>↑ {formatPercent(snapshot.margin_percent)}</u>
                  </div>
                  <div className="tw-jn ok">
                    <i>Gross profit</i>
                    <b>{money(snapshot.gross_profit)}</b>
                    <u>{formatPercent(snapshot.margin_percent)} margin</u>
                  </div>
                  <div
                    className={
                      snapshot.outstanding_revenue > 0 ? "tw-jn miss" : "tw-jn"
                    }
                  >
                    <i>Outstanding</i>
                    <b>{money(snapshot.outstanding_revenue)}</b>
                    <u>
                      {snapshot.outstanding_revenue > 0 ? "needs action" : "clear"}
                    </u>
                  </div>
                  <div className="tw-jn">
                    <i>Active vendors</i>
                    <b>{snapshot.active_vendors}</b>
                    <u>across campaigns</u>
                  </div>
                  <div className="tw-jn">
                    <i>Assignments</i>
                    <b>{snapshot.assignments_count}</b>
                    <u>this period</u>
                  </div>
                  <div
                    className={
                      snapshot.po_consumed_percent >= 90 ? "tw-jn miss" : "tw-jn"
                    }
                  >
                    <i>PO consumed</i>
                    <b>{snapshot.po_consumed_percent}%</b>
                    <u>{money(poHeadroom)} left</u>
                  </div>
                </div>
              </div>
            </HomeDashboardCard>
          </div>

          <div>
            <HomeDashboardCard
              id="campaigns"
              title="Recent campaigns"
              subtitle={`${liveCampaigns} live`}
              right={
                <>
                  <span className="tw-live on" />
                  <Link className="tw-b sm" href="/campaigns">
                    View all
                  </Link>
                </>
              }
            >
              {snapshot.recent_campaigns.length > 0 ? (
                snapshot.recent_campaigns.map((campaign, index) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="tw-lr"
                  >
                    <span className={`tw-av ${avatarTone(index)}`}>
                      {campaign.client_initials}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="tw-nm">{campaign.name}</span>
                      <span className="tw-d">
                        {campaign.document_number} · {campaign.status_label}
                      </span>
                    </span>
                    <span className="tw-lv">
                      <b>{formatMoneyKpi(campaign.revenue, campaign.currency_code)}</b>
                      <u>{formatPercent(campaign.margin_percent)} margin</u>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="tw-pad">
                  <p className="tw-cs">No campaigns yet.</p>
                </div>
              )}
            </HomeDashboardCard>

            <HomeDashboardCard
              id="vendors"
              title="Top vendors"
              subtitle="by reach"
              right={
                <Link className="tw-b sm" href="/vendors">
                  View all
                </Link>
              }
            >
              {snapshot.top_vendors.length > 0 ? (
                snapshot.top_vendors.map((vendor, index) => (
                  <Link
                    key={vendor.id}
                    href={`/vendors/${vendor.id}`}
                    className="tw-lr"
                  >
                    <span className={`tw-av ${avatarTone(index)}`}>
                      {vendor.initials}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="tw-nm">{vendor.display_name}</span>
                      <span className="tw-d">
                        {vendor.document_number} · {vendor.platform}
                        {vendor.country_label ? ` · ${vendor.country_label}` : ""}
                      </span>
                    </span>
                    <span className="tw-lv">
                      <b>{formatCompactCount(vendor.follower_count)}</b>
                      <u>followers</u>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="tw-pad">
                  <p className="tw-cs">No vendors yet.</p>
                </div>
              )}
            </HomeDashboardCard>

            <HomeDashboardCard id="quick-access" title="Quick access">
              <HomeDashboardQuickAccess />
            </HomeDashboardCard>
          </div>
        </div>
      </div>
    </HomeDashboardSuite>
  );
}
