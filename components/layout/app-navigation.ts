import type { SidebarIconKey } from "@/components/layout/sidebar-suite-icons";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";

type NavLinkDef = {
  href: string;
  label: string;
  icon: SidebarIconKey;
  /** Optional badge; never render 0 (spec). */
  count?: number;
};

type NavSection = {
  group?: string;
  subgroup?: string;
  items: NavLinkDef[];
};

/** Exact destination order from docs/architecture/sidebar.html NAV. */
export const NAV_SECTIONS: NavSection[] = [
  {
    group: "Home",
    items: [
      { href: "/", label: "Home", icon: "home" },
      { href: "/dashboard", label: "Executive", icon: "exec" },
    ],
  },
  {
    group: "Campaign workspace",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: "camp" },
      { href: "/studio", label: "Studio", icon: "studio" },
      { href: "/ai", label: "Campaign AI", icon: "ai" },
    ],
  },
  {
    group: "Discovery",
    items: [
      { href: "/discovery/search", label: "Search", icon: "search" },
      { href: "/discovery/shortlists", label: "Shortlists", icon: "list" },
      { href: "/discovery/quotations", label: "Quotations", icon: "quote" },
      {
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: "match",
      },
      { href: "/discovery/import", label: "Import Center", icon: "imp" },
    ],
  },
  {
    group: "Clients & brands",
    items: [
      { href: "/groups", label: "Holding Groups", icon: "grp" },
      { href: "/clients", label: "Clients", icon: "client" },
      { href: "/brands", label: "Brands", icon: "brand" },
      { href: "/rate-cards", label: "Client Rate Card", icon: "quote" },
      { href: "/ios/client", label: "Client IOs", icon: "doc" },
    ],
  },
  {
    group: "Vendors",
    items: [
      { href: "/vendors", label: "Vendors", icon: "vendor" },
      { href: "/ios/vendor", label: "Vendor IO register", icon: "doc" },
    ],
  },
  {
    group: "Finance",
    subgroup: "Billing & documents",
    items: [
      { href: "/billing", label: "Billing", icon: "bill" },
      { href: "/finance/po-tracker", label: "PO tracker", icon: "po" },
      { href: "/finance/invoices", label: "Invoices", icon: "doc" },
      {
        href: "/finance/client-credit-notes",
        label: "Client credit notes",
        icon: "cn",
      },
      {
        href: "/finance/client-debit-notes",
        label: "Client debit notes",
        icon: "dn",
      },
      {
        href: "/finance/vendor-credit-notes",
        label: "Vendor credit notes",
        icon: "cn",
      },
      {
        href: "/finance/vendor-debit-notes",
        label: "Vendor debit notes",
        icon: "dn",
      },
    ],
  },
  {
    subgroup: "Treasury & cash",
    items: [
      { href: "/collections", label: "Collections", icon: "coll" },
      { href: "/treasury", label: "Treasury", icon: "trez" },
      { href: "/finance/posting-center", label: "Posting center", icon: "post" },
    ],
  },
  {
    subgroup: "Compliance & planning",
    items: [
      { href: "/finance/vat", label: "VAT", icon: "vat" },
      { href: "/finance/exchange-rates", label: "Exchange rates", icon: "fx" },
      { href: "/finance/periods", label: "Periods", icon: "per" },
      { href: "/planning", label: "Planning", icon: "plan" },
    ],
  },
  {
    group: "Operations",
    items: [
      {
        href: "/operations/move",
        label: "Move between accounts",
        icon: "move",
      },
      {
        href: "/operations/reassignment",
        label: "Reassignment center",
        icon: "reas",
      },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: "rep" },
      ...(isIntelligenceEnabled()
        ? [
            {
              href: "/intelligence",
              label: "Intelligence",
              icon: "ai" as const,
            },
          ]
        : []),
      { href: "/links", label: "Link generator", icon: "link" },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/operations", label: "Operations Center", icon: "ops" },
      { href: "/settings/users", label: "Users", icon: "users" },
      { href: "/settings/security", label: "Security", icon: "sec" },
      { href: "/settings/roles", label: "Roles", icon: "role" },
      { href: "/settings/permissions", label: "Permissions", icon: "perm" },
      { href: "/settings/access-control", label: "Access Control", icon: "acc" },
      { href: "/settings/client-access", label: "Client Access", icon: "acc" },
      {
        href: "/settings/client-classification-review",
        label: "Classification Review",
        icon: "list",
      },
      { href: "/settings/email", label: "Email", icon: "mail" },
      { href: "/settings/about", label: "About", icon: "info" },
      { href: "/system/health", label: "System Health", icon: "heart" },
      { href: "/system/performance", label: "Performance", icon: "gauge" },
    ],
  },
];


/** Stable, always-visible destinations for the main daily workflow. */
export const DAILY_NAV_ITEMS = [
  { href: "/campaigns", label: "Campaigns", description: "Manage campaigns & assignments", icon: "camp", tone: "campaigns" },
  { href: "/discovery/quotations", label: "Quotations", description: "Prepare client quotations", icon: "quote", tone: "quotations" },
  { href: "/discovery/shortlists", label: "Shortlists", description: "Select & compare creators", icon: "list", tone: "shortlists" },
] satisfies (NavLinkDef & { description: string; tone: string })[];

/** Canonical destinations remain in their groups; pins are shortcuts only. */
export const SECONDARY_NAV_SECTIONS = NAV_SECTIONS;

export function activeNavigationHref(pathname: string): string | undefined {
  return NAV_SECTIONS.flatMap(section => section.items)
    .filter(item => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
