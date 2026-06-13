import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  CalendarDaysIcon,
  CoinsIcon,
  LineChartIcon,
  PercentIcon,
  ReceiptIcon,
  TablePropertiesIcon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export const REPORT_HUB_LINK_IDS = [
  "pnl",
  "vr",
  "client-profitability",
  "revenue-by-function",
  "top-clients",
  "top-influencers",
  "statements",
  "unsettled",
  "daily",
  "executive-dashboard",
  "collections",
  "treasury",
  "planning",
  "po-tracker",
  "billing",
] as const;

export type ReportHubLinkId = (typeof REPORT_HUB_LINK_IDS)[number];

export type ReportHubLink = {
  id: ReportHubLinkId;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tint: string;
};

export const REPORT_HUB_LINKS: readonly ReportHubLink[] = [
  {
    id: "pnl",
    href: "/reports/pnl",
    title: "P&L report",
    description:
      "Monthly revenue, COGS, and gross profit with client drill-down. Export as HTML, PDF, or Excel.",
    icon: TablePropertiesIcon,
    tint: "text-brand-blue",
  },
  {
    id: "vr",
    href: "/reports/vr",
    title: "VR report",
    description:
      "Vendor rebate by legal entity with monthly VR amounts. Filter by year, period, and currency. Export as HTML, PDF, or Excel.",
    icon: PercentIcon,
    tint: "text-teal-600 dark:text-teal-400",
  },
  {
    id: "client-profitability",
    href: "/reports/client-profitability",
    title: "Profitability by client",
    description:
      "GP and margin % for all legal entities. Compare up to three clients. Export as HTML, PDF, or Excel.",
    icon: TrendingUpIcon,
    tint: "text-success",
  },
  {
    id: "revenue-by-function",
    href: "/reports/revenue-by-function",
    title: "Revenue by function",
    description:
      "Revenue and GP by OPS and Sales teams. Filter by function, user, and client type. Export as HTML, PDF, or Excel.",
    icon: UsersIcon,
    tint: "text-brand-blue",
  },
  {
    id: "top-clients",
    href: "/reports/top-clients",
    title: "Top clients",
    description:
      "Rank legal entities by revenue or GP. Filter agency vs direct. Export as HTML, PDF, or Excel.",
    icon: BarChart3Icon,
    tint: "text-brand-blue",
  },
  {
    id: "top-influencers",
    href: "/reports/top-influencers",
    title: "Top influencers",
    description:
      "Rank vendors by spending, revenue, or GP. Filter agency vs direct. Export as HTML, PDF, or Excel.",
    icon: UserRoundIcon,
    tint: "text-brand-pink",
  },
  {
    id: "statements",
    href: "/reports/statements",
    title: "Statements",
    description:
      "Client and vendor ledger statements with invoice and payment activity. Export as HTML, PDF, or Excel.",
    icon: ReceiptIcon,
    tint: "text-brand-purple",
  },
  {
    id: "unsettled",
    href: "/reports/unsettled",
    title: "Statement of Unsettled",
    description:
      "Open client AR invoices with outstanding balance only. No payment credits. Export as HTML, PDF, or Excel.",
    icon: WalletIcon,
    tint: "text-warning",
  },
  {
    id: "daily",
    href: "/reports/daily",
    title: "Daily report",
    description:
      "Day-by-day revenue and GP with monthly sub-totals, run rate, and VR adjustments.",
    icon: CalendarDaysIcon,
    tint: "text-success",
  },
  {
    id: "executive-dashboard",
    href: "/dashboard",
    title: "Executive dashboard",
    description: "CFO-grade KPIs, profitability trends, and finance alerts.",
    icon: LineChartIcon,
    tint: "text-brand-blue",
  },
  {
    id: "collections",
    href: "/collections",
    title: "Collections",
    description: "Aging, receivables, and collection performance.",
    icon: CoinsIcon,
    tint: "text-brand-purple",
  },
  {
    id: "treasury",
    href: "/treasury",
    title: "Treasury",
    description: "Cashflow position and liquidity forecasting.",
    icon: WalletIcon,
    tint: "text-brand-pink",
  },
  {
    id: "planning",
    href: "/planning",
    title: "Planning",
    description: "Budgets, forecasts, and variance analysis.",
    icon: BarChart3Icon,
    tint: "text-success",
  },
  {
    id: "po-tracker",
    href: "/finance/po-tracker",
    title: "PO tracker",
    description: "Purchase-order consumption and remaining budget.",
    icon: ReceiptIcon,
    tint: "text-brand-blue",
  },
  {
    id: "billing",
    href: "/billing",
    title: "Billing",
    description: "Invoice lifecycle, queue, and operational billing.",
    icon: ReceiptIcon,
    tint: "text-brand-purple",
  },
] as const;

export const REPORT_HUB_LINKS_BY_ID = Object.fromEntries(
  REPORT_HUB_LINKS.map((link) => [link.id, link])
) as Record<ReportHubLinkId, ReportHubLink>;

export function isReportHubLinkId(id: string): id is ReportHubLinkId {
  return (REPORT_HUB_LINK_IDS as readonly string[]).includes(id);
}
