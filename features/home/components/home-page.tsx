import { CampaignSerialNavigation } from "@/features/campaigns/components/campaign-serial-navigation";

import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import Link from "next/link";
import {HomeVatCard} from "./home-vat-card";
import type {VatLedger} from "@/features/finance/vat/ledger-model";

import type { ExecutiveDashboardPayload } from "@/features/analytics/load-executive-dashboard";
import { HomeDashboardMasthead } from "@/features/home/components/home-dashboard-masthead";
import {
  HomeDashboardCard,
  HomeDashboardGrid,
  HomeDashboardQuickAccess,
  HomeDashboardRow,
  HomeDashboardSuite,
  HOME_QUEUE_COLS,
  avatarTone,
  formatCompactCount,
} from "@/features/home/components/home-dashboard-pack";
import {
  collectHomeConflicts,
} from "@/features/home/lib/home-dashboard-conflicts";
import type { HomeDashboardSnapshot } from "@/features/home/queries";
import { formatPercent } from "@/lib/campaigns/utils";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import type { FinanceAlert } from "@/lib/analytics/queries/dashboard-alerts";

type HomePageProps = {
  snapshot: HomeDashboardSnapshot;
  vat?:VatLedger|null;
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
    timeZone: "Africa/Cairo",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function HomePage({ snapshot, executive = null, vat }: HomePageProps) {
  const now = new Date();
  const currency = snapshot.currency_code;
  const money = (value: number) => `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  const alerts = snapshot.alerts;
  const alertCount = alerts?.alerts.length ?? 0;
  const unbilled = snapshot.unbilled;
  const overdue = snapshot.overdue;
  const actualCost = snapshot.total_revenue - snapshot.gross_profit;
  const liveCampaigns = snapshot.active_campaigns;
  const poHeadroom = Math.max(0, snapshot.po_total - snapshot.po_consumed);
  const conflicts: ReturnType<typeof collectHomeConflicts> = [];
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



  const focusMessage =
    unbilled > 0
      ? "Went-live revenue is ready for billing"
      : snapshot.outstanding_revenue > 0
        ? "Client invoices are awaiting payment"
        : "No unbilled or outstanding client balance";
  const focusSub =
    pendingInvoiceCount > 0
      ? `${pendingInvoiceCount} campaign${pendingInvoiceCount === 1 ? "" : "s"} pending invoice${
          overdue.count > 0
            ? ` · ${overdue.count} invoice${overdue.count === 1 ? "" : "s"} past due`
            : ""
        }`
      : overdue.count > 0
        ? `${overdue.count} invoice${overdue.count === 1 ? "" : "s"} past due`
        : `${snapshot.active_campaigns} active campaigns`;

  return (
    <HomeDashboardSuite className="home-overview">
      <div className="sticky top-0 z-[75] bg-[#0055ff] px-5 py-2"><CampaignSerialNavigation /></div>
      <HomeDashboardMasthead
        page="home"
        id="HOME"
        subtitle={`${formatDateLabel(now)} · All-time · Amounts in ${currency}`}
        badgeLabel="Current records"
        userHandle={snapshot.userHandle}
        metrics={[
          { label: "Went-live revenue", value: money(snapshot.total_revenue), description: "Published activity through today · before VAT" },
          { label: "Actual cost", value: money(actualCost), description: "Costs matching went-live activity · before VAT" },
          { label: "Actual gross profit", value: money(snapshot.gross_profit), description: "Actual revenue − actual cost · before revenue share" },
          { label: "Gross margin", value: formatPercent(snapshot.margin_percent), description: "Actual gross profit ÷ actual revenue", tone: snapshot.margin_percent >= 20 ? "g" : undefined },
          { label: "Unbilled revenue", value: money(unbilled), description: "Earned revenue less invoiced revenue · before VAT" },
          { label: "Unpaid client invoices", value: money(snapshot.outstanding_revenue), description: "Issued invoices less payments · including VAT", tone: snapshot.outstanding_revenue > 0 ? "r" : undefined },
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
            <Link className="tw-b sm" href={`/reports/overview?currency=${currency}`}>Reports Overview</Link>
            <Link className="tw-b sm" href="/studio">
              Open Studio
            </Link>
          </>
        }
        jumps={[
          { href: "#needs-action", label: "Needs action", count: alertCount },
          { href: "#revenue-basis", label: "Revenue basis" },
          { href: "#campaigns", label: "Campaigns" },
          { href: "#vendors", label: "Vendors" },
          { href: "#quick-access", label: "Quick access" },
        ]}
      />

      <div className="tw-main">
        {vat && <HomeVatCard data={vat}/>}
        <div className="home-summary-grid">
          <HomeDashboardCard title="Overdue invoices" subtitle="Part of unpaid client invoices" right={<Link className="tw-b sm" href="/collections?tab=overdue">Review</Link>}>
            <div className="home-summary-body"><strong className="home-summary-value">{money(overdue.amount)}</strong><p>{overdue.count} invoices past due · including VAT</p></div>
          </HomeDashboardCard>
          <HomeDashboardCard title="PO / budget used" subtitle="Commercial commitments" right={<Link className="tw-b sm" href="/finance/po-tracker">PO tracker</Link>}>
            <div className="home-summary-body"><strong className="home-summary-value">{snapshot.po_consumed_percent}%</strong><p>{money(snapshot.po_consumed)} used of {money(snapshot.po_total)} · {money(poHeadroom)} remaining.</p><p>{snapshot.missing_po} campaigns have no header PO; campaign budgets are used.</p></div>
          </HomeDashboardCard>
          <HomeDashboardCard title="Active campaigns" subtitle="Campaign operations" right={<Link className="tw-b sm" href="/campaigns">View all</Link>}>
            <div className="home-summary-body"><strong className="home-summary-value">{liveCampaigns}</strong><p>{snapshot.assignments_count} assignments · {snapshot.active_vendors} assigned vendors across non-cancelled campaigns.</p></div>
          </HomeDashboardCard>
          <HomeDashboardCard title="Approved pipeline" subtitle="Approved client IOs · not yet live" right={<Link className="tw-b sm" href="/dashboard#pipeline">View details</Link>}>
            <div className="home-summary-body"><strong className="home-summary-value">{money(snapshot.pipeline_revenue)}</strong><p>{snapshot.pipeline_campaigns} campaigns · before VAT. Approval-based pipeline is a different scope from all not-yet-live campaign value.</p></div>
          </HomeDashboardCard>
        </div>
        <HomeDashboardCard id="revenue-basis" title="How revenue is counted" subtitle="Before VAT" right={<Link className="tw-b sm" href={`/reports/overview?currency=${currency}`}>Reports Overview</Link>}>
          <div className="home-revenue-basis">
            <p><b>Went live (actual)</b> Revenue allocated to posts marked posted, published, live or verified, with a live date through today. A schedule, invoice or payment alone does not count.</p>
            <p><b>Not yet live (Acc.)</b> Reports Overview calls this “accrued”: total campaign value minus went-live value. It is not earned-but-unbilled revenue. Total = went live + not yet live.</p>
            <p><b>Unbilled</b> Went-live revenue less issued invoice revenue, calculated per campaign. It has already gone live.</p>
          </div>
        </HomeDashboardCard>

        <div className="tw-two">
          <div>
            <HomeDashboardCard
              id="needs-action"
              title="Needs you today"
              subtitle={`Grouped by action · converted to ${currency}`}
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
                      <span className="tw-v neg">Related amounts overlap</span>
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


          </div>

          <div>
            <HomeDashboardCard
              id="campaigns"
              title="Recent campaigns"
              subtitle="Went-live revenue · campaign currency"
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
                        {formatDocumentNumberForDisplay(campaign.document_number)} · {campaign.status_label}
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
              subtitle="by reach · assigned creators"
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
                        {formatDocumentNumberForDisplay(vendor.document_number)} · {vendor.platform}
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
