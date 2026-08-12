import Link from "next/link";
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  Building2Icon,
  LayoutGridIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { formatMoneyCompact, formatPercent } from "@/lib/campaigns/utils";
import { HomeCanvas } from "@/features/home/components/home-canvas";
import { HomeKpiCounter } from "@/features/home/components/home-kpi-counter";
import { HomePoRing } from "@/features/home/components/home-po-ring";
import { HomeWorkspaceNavTabs } from "@/features/home/components/home-workspace-nav-tabs";
import type { HomeDashboardSnapshot } from "@/features/home/queries";

type HomePageProps = {
  snapshot: HomeDashboardSnapshot;
};

function resolveGreetingWord(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const MODULES = [
  {
    id: "finance",
    href: "/dashboard",
    title: "Finance",
    description: "KPIs, trends, billing alerts",
    borderColor: "var(--border)",
    iconBg: "var(--blue-light)",
    iconColor: "#0057FF",
    icon: TrendingUpIcon,
  },
  {
    id: "campaigns",
    href: "/campaigns",
    title: "Campaigns",
    description: "Plans, IO, performance",
    borderColor: "var(--border)",
    iconBg: "var(--green-bg)",
    iconColor: "#10b981",
    icon: ActivityIcon,
  },
  {
    id: "clients",
    href: "/clients",
    title: "Clients",
    description: "Accounts, legal, brands",
    borderColor: "var(--border)",
    iconBg: "var(--purple-bg)",
    iconColor: "#a855f7",
    icon: Building2Icon,
  },
  {
    id: "vendors",
    href: "/vendors",
    title: "Vendors",
    description: "Creators, payouts, stats",
    borderColor: "var(--border)",
    iconBg: "var(--amber-bg)",
    iconColor: "#f59e0b",
    icon: UsersIcon,
  },
] as const;

export function HomePage({ snapshot }: HomePageProps) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const greetingWord = resolveGreetingWord(now);
  const currency = snapshot.currency_code;

  const formatMoney = (value: number) => formatMoneyCompact(value, currency);

  const tickerItems = [
    {
      label: "REVENUE",
      value: formatMoney(snapshot.total_revenue),
      badge: snapshot.margin_percent > 0 ? `↑ ${formatPercent(snapshot.margin_percent)}` : null,
      badgeClass: "platform-v6-hs-badge-up",
    },
    {
      label: "GROSS PROFIT",
      value: formatMoney(snapshot.gross_profit),
    },
    {
      label: "ACTIVE CAMPAIGNS",
      value: String(snapshot.active_campaigns),
    },
    {
      label: "VENDORS",
      value: String(snapshot.active_vendors),
    },
    {
      label: "OUTSTANDING",
      value: formatMoney(snapshot.outstanding_revenue),
      badgeClass:
        snapshot.outstanding_revenue > 0 ? "platform-v6-hs-badge-dn" : undefined,
    },
    {
      label: "PO CONSUMED",
      value: `${snapshot.po_consumed_percent}%`,
    },
    {
      label: "MARGIN",
      value: formatPercent(snapshot.margin_percent),
    },
    {
      label: "ASSIGNMENTS",
      value: String(snapshot.assignments_count),
    },
  ];

  const liveCampaignCount = snapshot.recent_campaigns.filter(
    (campaign) => campaign.status === "active"
  ).length;

  return (
    <div className="platform-v6-hs-root">
      <HomeCanvas />
      <div className="platform-v6-hs-aurora" aria-hidden />
      <div className="platform-v6-hs-aurora-2" aria-hidden />
      <div className="platform-v6-hs-grid" aria-hidden />

      <nav className="platform-v6-hs-nav">
        <div className="platform-v6-hs-nav-left">
          <Link href="/" title="Thinkway">
            <ThinkwayLogo compact showText className="mb-0" />
          </Link>
        </div>
        <HomeWorkspaceNavTabs active="overview" />
        <div className="platform-v6-hs-nav-right">
          <Link className="platform-v6-hs-cta-btn" href="/campaigns">
            + New Campaign
          </Link>
          <div className="platform-v6-hs-nav-av">{snapshot.userInitials}</div>
          <span className="platform-v6-hs-nav-name">{snapshot.userHandle}</span>
        </div>
      </nav>

      <div className="platform-v6-hs-ticker">
        <div className="platform-v6-hs-ticker-inner">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <div key={`${item.label}-${index}`} className="platform-v6-hs-tick-item">
              {item.label}{" "}
              <span
                className={
                  item.badgeClass ? `platform-v6-hs-tick-val ${item.badgeClass}` : "platform-v6-hs-tick-val"
                }
              >
                {item.value}
              </span>
              {item.badge ? (
                <span className={item.badgeClass ?? "platform-v6-hs-badge-up"}>{item.badge}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="platform-v6-hs-main">
        <div className="platform-v6-hs-left">
          <div className="platform-v6-hs-greeting-meta">{dateLabel}</div>
          <h1 className="platform-v6-hs-heading">
            <span>{greetingWord}</span>
            <br />
            <span className="platform-v6-hs-heading-accent">{snapshot.displayName}</span>
            <span className="platform-v6-hs-heading-cursor" aria-hidden />
          </h1>
          <p className="platform-v6-hs-tagline">
            Your influencer ops platform. Revenue, creators, campaigns and clients — all in one
            view.
          </p>

          <div className="platform-v6-hs-kpis">
            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "var(--blue-light)" }}
              >
                <WalletIcon aria-hidden stroke="#0057FF" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Revenue</div>
              <div className="platform-v6-hs-kpi-val">
                <HomeKpiCounter value={snapshot.total_revenue} currency={currency} />
              </div>
              <div className="platform-v6-hs-kpi-sub">
                {snapshot.margin_percent > 0 ? (
                  <span className="platform-v6-hs-badge-up">
                    ↑ {formatPercent(snapshot.margin_percent)}
                  </span>
                ) : null}{" "}
                gross profit
              </div>
            </div>

            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "var(--green-bg)" }}
              >
                <TrendingUpIcon aria-hidden stroke="#10b981" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Gross Profit</div>
              <div className="platform-v6-hs-kpi-val">
                <HomeKpiCounter
                  value={snapshot.gross_profit}
                  currency={currency}
                  durationMs={1500}
                />
              </div>
              <div className="platform-v6-hs-kpi-sub">{formatPercent(snapshot.margin_percent)} margin</div>
            </div>

            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "var(--amber-bg)" }}
              >
                <AlertCircleIcon aria-hidden stroke="#f59e0b" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Outstanding</div>
              <div className="platform-v6-hs-kpi-val platform-v6-hs-kpi-val-warn">
                <HomeKpiCounter
                  value={snapshot.outstanding_revenue}
                  currency={currency}
                  durationMs={2000}
                />
              </div>
              <div className="platform-v6-hs-kpi-sub">
                {snapshot.outstanding_revenue > 0 ? (
                  <span className="platform-v6-hs-badge-dn">⚠ Needs action</span>
                ) : (
                  "All clear"
                )}
              </div>
            </div>

            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "var(--purple-bg)" }}
              >
                <UsersIcon aria-hidden stroke="#a855f7" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Active vendors</div>
              <div className="platform-v6-hs-kpi-val">{snapshot.active_vendors}</div>
              <div className="platform-v6-hs-kpi-sub">across active campaigns</div>
            </div>
          </div>

          <div className="platform-v6-hs-actions">
            <Link className="platform-v6-hs-btn-primary" href="/dashboard">
              <LayoutGridIcon aria-hidden strokeWidth={2} />
              Executive dashboard
            </Link>
            <Link className="platform-v6-hs-btn-ghost" href="/campaigns">
              <ActivityIcon aria-hidden strokeWidth={2} />
              Campaigns
            </Link>
            <Link className="platform-v6-hs-btn-ghost" href="/clients">
              <Building2Icon aria-hidden strokeWidth={2} />
              Clients
            </Link>
          </div>

          <div className="platform-v6-hs-modules-label">Quick access</div>
          <div className="platform-v6-hs-modules">
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.id}
                  href={module.href}
                  className="platform-v6-hs-mod"
                  style={{ borderColor: module.borderColor }}
                >
                  <div
                    className="platform-v6-hs-mod-icon"
                    style={{ background: module.iconBg }}
                  >
                    <Icon aria-hidden stroke={module.iconColor} strokeWidth={2} />
                  </div>
                  <div className="platform-v6-hs-mod-body">
                    <div className="platform-v6-hs-mod-title">{module.title}</div>
                    <div className="platform-v6-hs-mod-desc">{module.description}</div>
                  </div>
                  <div className="platform-v6-hs-mod-arrow">
                    <ArrowRightIcon aria-hidden size={14} strokeWidth={2} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="platform-v6-hs-right">
          {snapshot.billing_alert ? (
            <div className="platform-v6-hs-alert">
              <div className="platform-v6-hs-alert-icon">
                <AlertCircleIcon aria-hidden strokeWidth={2} />
              </div>
              <div>
                <div className="platform-v6-hs-alert-title">{snapshot.billing_alert.title}</div>
                <div className="platform-v6-hs-alert-desc">{snapshot.billing_alert.description}</div>
                <Link className="platform-v6-hs-alert-link" href="/dashboard">
                  Review in dashboard →
                </Link>
              </div>
            </div>
          ) : null}

          <div className="platform-v6-hs-ring-panel">
            <HomePoRing percent={snapshot.po_consumed_percent} />
            <div>
              <div className="platform-v6-hs-ring-info-title">PO Consumption</div>
              <div className="platform-v6-hs-ring-info-desc">
                {formatMoney(snapshot.po_consumed)} of {formatMoney(snapshot.po_total)} consumed.
                {snapshot.po_consumed_percent >= 90 ? (
                  <>
                    <br />
                    Near limit — renewal required.
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="platform-v6-hs-panel platform-v6-hs-panel-delay-300">
            <div className="platform-v6-hs-panel-head">
              <span className="platform-v6-hs-panel-title">
                <ActivityIcon aria-hidden strokeWidth={2} />
                Recent campaigns
              </span>
              <Link className="platform-v6-hs-panel-link" href="/campaigns">
                VIEW ALL
              </Link>
            </div>
            {snapshot.recent_campaigns.length > 0 ? (
              <>
                <div className="platform-v6-hs-live">
                  <div className="platform-v6-hs-live-dot" aria-hidden />
                  Live · {liveCampaignCount || snapshot.recent_campaigns.length}{" "}
                  {liveCampaignCount === 1 ? "campaign" : "campaigns"}
                </div>
                {snapshot.recent_campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="platform-v6-hs-panel-row"
                  >
                    <div className="platform-v6-hs-pr-left">
                      <div className="platform-v6-hs-pr-av">{campaign.client_initials}</div>
                      <div>
                        <div className="platform-v6-hs-pr-name">{campaign.name}</div>
                        <div className="platform-v6-hs-pr-meta">
                          {campaign.document_number} · {campaign.status_label}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="platform-v6-hs-pr-val">
                        {formatMoneyCompact(campaign.revenue, campaign.currency_code)}
                      </div>
                      <div className="platform-v6-hs-pr-sub">
                        {formatPercent(campaign.margin_percent)} margin
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <div className="platform-v6-hs-panel-empty">No campaigns yet.</div>
            )}
          </div>

          <div className="platform-v6-hs-panel platform-v6-hs-panel-delay-400">
            <div className="platform-v6-hs-panel-head">
              <span className="platform-v6-hs-panel-title">
                <UsersIcon aria-hidden strokeWidth={2} />
                Top vendors
              </span>
              <Link className="platform-v6-hs-panel-link" href="/vendors">
                VIEW ALL
              </Link>
            </div>
            {snapshot.top_vendors.length > 0 ? (
              snapshot.top_vendors.map((vendor) => (
                <Link
                  key={vendor.id}
                  href={`/vendors/${vendor.id}`}
                  className="platform-v6-hs-panel-row"
                >
                  <div className="platform-v6-hs-pr-left">
                    <div className="platform-v6-hs-pr-av">
                      {vendor.initials}
                    </div>
                    <div>
                      <div className="platform-v6-hs-pr-name">{vendor.display_name}</div>
                      <div className="platform-v6-hs-pr-meta">
                        {vendor.document_number} · {vendor.platform}
                        {vendor.country_label ? ` · ${vendor.country_label}` : ""}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="platform-v6-hs-pr-val">
                      {formatFollowerCount(vendor.follower_count)}
                    </div>
                    <div className="platform-v6-hs-pr-sub">followers</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="platform-v6-hs-panel-empty">No vendors yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="platform-v6-hs-footer-strip">
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Platform</div>
          <div className="platform-v6-hs-fs-val">Thinkway v2.6</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Last sync</div>
          <div className="platform-v6-hs-fs-val">Just now</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Period</div>
          <div className="platform-v6-hs-fs-val">{formatPeriodLabel(now)}</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Currency</div>
          <div className="platform-v6-hs-fs-val">{currency}</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Region</div>
          <div className="platform-v6-hs-fs-val">MENA</div>
        </div>
        <div className="platform-v6-hs-footer-live">
          <div className="platform-v6-hs-live-dot" aria-hidden />
          <span>LIVE</span>
        </div>
      </div>
    </div>
  );
}
