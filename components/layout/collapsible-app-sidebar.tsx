"use client";

import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  GaugeIcon,
  BrainIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronRightIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  HomeIcon,
  InfoIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  ListIcon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PercentIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  SendIcon,
  TagsIcon,
  TargetIcon,
  UploadIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { UserAccount } from "@/components/layout/user-account";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";
import {
  APP_SIDEBAR_WIDTH_COLLAPSED,
  APP_SIDEBAR_WIDTH_CSS_VAR,
  APP_SIDEBAR_WIDTH_EXPANDED,
  getAppSidebarLayoutWidth,
  resolveAppSidebarExpanded,
} from "@/lib/layout/app-sidebar-width";
import { cn } from "@/lib/utils";

type NavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavSubheaderItem = {
  kind: "subheader";
  label: string;
};

type NavEntry = NavLinkItem | NavSubheaderItem;

type NavGroupIconTone = "blue" | "violet" | "teal" | "amber" | "navy";

type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconTone: NavGroupIconTone;
  items: NavEntry[];
};

type NavRailItem = {
  groupLabel: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const GROUP_ICON_TONE_CLASS: Record<NavGroupIconTone, string> = {
  blue: "thinkway-sidebar-grp-icon",
  violet: "thinkway-sidebar-grp-icon",
  teal: "thinkway-sidebar-grp-icon",
  amber: "thinkway-sidebar-grp-icon",
  navy: "thinkway-sidebar-grp-icon",
};

/** Global nav order — overview, workspace, commercial, finance, insights, admin. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboardIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/", label: "Home", icon: LayoutDashboardIcon },
      { kind: "link", href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    label: "Workspace",
    icon: MegaphoneIcon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { kind: "link", href: "/studio", label: "Studio", icon: LayoutDashboardIcon },
      { kind: "link", href: "/ai", label: "Campaign AI", icon: SparklesIcon },
    ],
  },
  {
    label: "Discovery",
    icon: SearchIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/discovery/search", label: "Search", icon: SearchIcon },
      { kind: "link", href: "/discovery/shortlists", label: "Shortlists", icon: ListIcon },
      {
        kind: "link",
        href: "/discovery/quotations",
        label: "Client Quotations",
        icon: FileTextIcon,
      },
      {
        kind: "link",
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: TargetIcon,
      },
      { kind: "link", href: "/discovery/import", label: "Import Center", icon: UploadIcon },
    ],
  },
  {
    label: "Clients and vendors CRM",
    icon: UsersIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/groups", label: "Holding Groups", icon: LayersIcon },
      { kind: "link", href: "/clients", label: "Clients", icon: Building2Icon },
      { kind: "link", href: "/brands", label: "Brands", icon: SparklesIcon },
      { kind: "link", href: "/vendors", label: "Vendors", icon: UsersIcon },
    ],
  },
  {
    label: "Commercial",
    icon: FileSignatureIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/ios/vendor", label: "Vendor IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/billing", label: "Billing", icon: ReceiptIcon },
      { kind: "link", href: "/finance/po-tracker", label: "PO Tracker", icon: ReceiptIcon },
    ],
  },
  {
    label: "Finance",
    icon: WalletIcon,
    iconTone: "amber",
    items: [
      { kind: "subheader", label: "Billing & documents" },
      { kind: "link", href: "/finance/invoices", label: "Invoices", icon: FileTextIcon },
      {
        kind: "link",
        href: "/finance/client-credit-notes",
        label: "Client credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/client-debit-notes",
        label: "Client debit notes",
        icon: CirclePlusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-credit-notes",
        label: "Vendor credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-debit-notes",
        label: "Vendor debit notes",
        icon: CirclePlusIcon,
      },
      { kind: "subheader", label: "Treasury & cash" },
      { kind: "link", href: "/collections", label: "Collections", icon: CoinsIcon },
      { kind: "link", href: "/treasury", label: "Treasury", icon: WalletIcon },
      { kind: "link", href: "/finance/posting-center", label: "Posting center", icon: SendIcon },
      { kind: "subheader", label: "Compliance & planning" },
      { kind: "link", href: "/finance/vat", label: "VAT & Tax", icon: PercentIcon },
      { kind: "link", href: "/finance/exchange-rates", label: "Exchange rates", icon: RefreshCwIcon },
      { kind: "link", href: "/finance/periods", label: "Periods", icon: CalendarRangeIcon },
      { kind: "link", href: "/planning", label: "Planning", icon: CalendarClockIcon },
      { kind: "subheader", label: "Move from Acc to another" },
      { kind: "link", href: "/operations/move", label: "Move", icon: ArrowRightLeftIcon },
      {
        kind: "link",
        href: "/operations/reassignment",
        label: "Reassignment",
        icon: ArrowRightLeftIcon,
      },
    ],
  },
  {
    label: "Insights",
    icon: BarChart3Icon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/reports", label: "Reports", icon: BarChart3Icon },
      // Intelligence — gated by INTELLIGENCE_ARCHIVED (see docs/INTELLIGENCE_ARCHIVE.md)
      ...(isIntelligenceEnabled()
        ? [{ kind: "link" as const, href: "/intelligence", label: "Intelligence", icon: BrainIcon }]
        : []),
      { kind: "link", href: "/links", label: "Link Generator", icon: Link2Icon },
    ],
  },
  {
    label: "Administration",
    icon: Settings2Icon,
    iconTone: "navy",
    items: [
      {
        kind: "link",
        href: "/operations",
        label: "Operations Center",
        icon: ActivityIcon,
      },
      { kind: "link", href: "/settings/users", label: "Users", icon: Settings2Icon },
      { kind: "link", href: "/settings/security", label: "Security", icon: ShieldIcon },
      { kind: "link", href: "/settings/roles", label: "Roles", icon: UserCogIcon },
      { kind: "link", href: "/settings/permissions", label: "Permissions", icon: ShieldIcon },
      {
        kind: "link",
        href: "/settings/access-control",
        label: "Access Control",
        icon: ShieldIcon,
      },
      { kind: "link", href: "/settings/client-access", label: "Client Access", icon: UsersIcon },
      {
        kind: "link",
        href: "/settings/client-classification-review",
        label: "Classification Review",
        icon: TagsIcon,
      },
      { kind: "link", href: "/settings/email", label: "Email", icon: Settings2Icon },
      { kind: "link", href: "/settings/about", label: "About", icon: InfoIcon },
      { kind: "link", href: "/system/health", label: "System Health", icon: ActivityIcon },
      {
        kind: "link",
        href: "/system/performance",
        label: "Performance",
        icon: GaugeIcon,
      },
    ],
  },
];

const ALL_GROUP_LABELS = navGroups.map((g) => g.label);
const STORAGE_EXPANDED = "thinkway-sidebar-expanded";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups";

const RAIL_PRIMARY_HREF: Record<string, string> = {
  Overview: "/",
  Workspace: "/campaigns",
  Discovery: "/discovery/search",
  "Clients and vendors CRM": "/clients",
  Commercial: "/ios/client",
  Finance: "/finance/invoices",
  Insights: "/reports",
  Administration: "/settings/users",
};

const RAIL_LABEL: Record<string, string> = {
  "Clients and vendors CRM": "Clients & vendors",
};

/** Clearer rail glyphs — aligned to section meaning. */
const RAIL_ICON_OVERRIDE: Partial<
  Record<string, ComponentType<{ className?: string }>>
> = {
  Overview: HomeIcon,
};

/** Legacy section labels from pre-reorg sidebar — map into current groups. */
const LEGACY_COLLAPSED_LABEL_MAP: Record<string, string[]> = {
  Organization: ["Workspace", "Clients and vendors CRM", "Administration"],
  Clients: ["Clients and vendors CRM"],
  Operations: ["Finance"],
  System: ["Administration"],
};

function getNavLinks(group: NavGroup): NavLinkItem[] {
  return group.items.filter((item): item is NavLinkItem => item.kind === "link");
}

function buildNavRailItems(): NavRailItem[] {
  return navGroups.map((group) => ({
    groupLabel: group.label,
    href: RAIL_PRIMARY_HREF[group.label] ?? getNavLinks(group)[0]?.href ?? "/",
    label: RAIL_LABEL[group.label] ?? group.label,
    icon: RAIL_ICON_OVERRIDE[group.label] ?? group.icon,
  }));
}

const navRailItems = buildNavRailItems();

function migrateCollapsedGroups(stored: Set<string>): Set<string> {
  const migrated = new Set<string>();
  let hadLegacy = false;

  for (const label of stored) {
    const mapped = LEGACY_COLLAPSED_LABEL_MAP[label];
    if (mapped) {
      hadLegacy = true;
      for (const next of mapped) migrated.add(next);
    } else if (ALL_GROUP_LABELS.includes(label)) {
      migrated.add(label);
    }
  }

  if (hadLegacy && typeof window !== "undefined") {
    localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...migrated]));
  }

  return migrated;
}

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isRailItemActive(pathname: string, groupLabel: string): boolean {
  const group = navGroups.find((entry) => entry.label === groupLabel);
  if (!group) return false;
  return getNavLinks(group).some((item) => isItemActive(pathname, item.href));
}

function SidebarRailTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="border-[#e2e8f0] bg-[#111827] px-2.5 py-1.5 text-[12px] font-medium text-white"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function findActiveGroupLabel(pathname: string): string | null {
  for (const group of navGroups) {
    if (getNavLinks(group).some((item) => isItemActive(pathname, item.href))) {
      return group.label;
    }
  }
  return null;
}

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set(ALL_GROUP_LABELS);
  try {
    const raw = localStorage.getItem(STORAGE_COLLAPSED_GROUPS);
    if (!raw) return new Set(ALL_GROUP_LABELS);
    const parsed = JSON.parse(raw) as string[];
    return migrateCollapsedGroups(new Set(parsed));
  } catch {
    return new Set(ALL_GROUP_LABELS);
  }
}

function readSidebarExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_EXPANDED);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function initialCollapsedGroups(pathname: string): Set<string> {
  const next = new Set(ALL_GROUP_LABELS);
  const active = findActiveGroupLabel(pathname);
  if (active) next.delete(active);
  return next;
}

export function CollapsibleAppSidebar({ userEmail }: CollapsibleAppSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    initialCollapsedGroups(pathname)
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setExpanded(readSidebarExpanded());
    const hasStored = localStorage.getItem(STORAGE_COLLAPSED_GROUPS) !== null;
    if (hasStored) {
      const stored = readCollapsedGroups();
      const next = new Set(stored);
      const active = findActiveGroupLabel(pathname);
      if (active) next.delete(active);
      setCollapsedGroups(next);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const activeGroup = findActiveGroupLabel(pathname);
    if (!activeGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup);
      localStorage.setItem(
        STORAGE_COLLAPSED_GROUPS,
        JSON.stringify([...next])
      );
      return next;
    });
  }, [pathname, hydrated]);

  const persistExpanded = useCallback((value: boolean) => {
    setExpanded(value);
    localStorage.setItem(STORAGE_EXPANDED, String(value));
  }, []);

  const displayExpanded = resolveAppSidebarExpanded(expanded);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      APP_SIDEBAR_WIDTH_CSS_VAR,
      getAppSidebarLayoutWidth(displayExpanded)
    );
  }, [displayExpanded, hydrated]);

  const sidebarWidth = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const sidebarControlButtonClass =
    "flex size-8 items-center justify-center rounded-lg border-none bg-transparent text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-primary active:scale-95";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="relative hidden shrink-0 self-stretch overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-0 md:block md:h-full md:max-h-full"
        style={{ width: sidebarWidth }}
      >
        <aside
          className={cn(
            "thinkway-app-sidebar absolute flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
            !displayExpanded && "thinkway-app-sidebar--rail"
          )}
          style={{
            left: 0,
            top: 0,
            height: "100%",
            width: sidebarWidth,
          }}
        >
          <div
            className={cn(
              "flex items-center",
              displayExpanded
                ? "gap-3 border-b border-sidebar-border px-5 pb-4 pt-5"
                : "justify-center border-b border-sidebar-border px-2 pb-3 pt-5"
            )}
          >
            <AppNavLink href="/" className="min-w-0 shrink-0" title="Thinkway">
              <ThinkwayLogo showText={displayExpanded} compact className="mb-0" />
            </AppNavLink>
            {displayExpanded ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span aria-hidden className="h-6 w-px shrink-0 bg-[#e2e8f0] dark:bg-border" />
                <SidebarRailTooltip label="Collapse to icons">
                  <button
                    type="button"
                    onClick={() => persistExpanded(false)}
                    className={sidebarControlButtonClass}
                    aria-label="Collapse to icons"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </button>
                </SidebarRailTooltip>
              </div>
            ) : null}
          </div>

          {!displayExpanded ? (
            <nav
              aria-label="Primary"
              className="thinkway-app-sidebar-rail flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-4"
            >
              {navRailItems.map((item) => {
                const active = isRailItemActive(pathname, item.groupLabel);
                const Icon = item.icon;
                return (
                  <SidebarRailTooltip key={item.groupLabel} label={item.label}>
                    <AppNavLink
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "thinkway-app-sidebar-rail-link flex size-10 items-center justify-center rounded-lg transition-colors duration-150",
                        active
                          ? "thinkway-app-sidebar-rail-link--active bg-[var(--sidebar-active-bg)] text-primary dark:text-blue-400"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-primary dark:hover:text-blue-400"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0 stroke-[1.85]" />
                    </AppNavLink>
                  </SidebarRailTooltip>
                );
              })}

              <div className="min-h-3 flex-1" aria-hidden />

              <SidebarRailTooltip label="Expand sidebar">
                <button
                  type="button"
                  onClick={() => persistExpanded(true)}
                  className={sidebarControlButtonClass}
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpenIcon className="size-4" />
                </button>
              </SidebarRailTooltip>
            </nav>
          ) : (
            <nav className="thinkway-app-sidebar-nav flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3">
              {navGroups.map((group, groupIndex) => {
                const groupCollapsed = collapsedGroups.has(group.label);
                const GroupIcon = group.icon;

                return (
                  <div
                    key={group.label}
                    className={cn(
                      "thinkway-app-sidebar-section flex flex-col",
                      groupIndex > 0 && "mt-3 border-t border-sidebar-border pt-3"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="thinkway-app-sidebar-section-head flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
                      aria-expanded={!groupCollapsed}
                      aria-label={`${groupCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                    >
                      <span className={GROUP_ICON_TONE_CLASS[group.iconTone]}>
                        <GroupIcon className="size-4 stroke-[1.75] text-sidebar-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.08em] text-sidebar-muted-foreground uppercase">
                        {group.label}
                      </span>
                      <ChevronRightIcon
                        className={cn(
                          "size-3.5 shrink-0 text-sidebar-muted-foreground/70 transition-transform duration-200",
                          !groupCollapsed && "rotate-90"
                        )}
                      />
                    </button>

                    <div
                      className={cn(
                        "thinkway-app-sidebar-section-items mt-1 ml-3 flex flex-col border-l border-sidebar-border pl-2",
                        groupCollapsed && "hidden"
                      )}
                    >
                      {group.items.map((item) => {
                        if (item.kind === "subheader") {
                          return (
                            <div
                              key={`subheader-${item.label}`}
                              className="px-2 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.07em] text-sidebar-muted-foreground uppercase"
                            >
                              {item.label}
                            </div>
                          );
                        }

                        const active = isItemActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                          <AppNavLink
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={cn(
                              "thinkway-app-sidebar-link flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors duration-150",
                              active
                                ? "thinkway-app-sidebar-link--active bg-[var(--sidebar-active-bg)] text-primary dark:text-blue-400"
                                : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4 shrink-0 stroke-[1.75]",
                                active ? "text-primary dark:text-blue-400" : "text-sidebar-muted-foreground"
                              )}
                            />
                            <span
                              className={cn(
                                "truncate",
                                active && "font-semibold text-primary dark:text-blue-400"
                              )}
                            >
                              {item.label}
                            </span>
                          </AppNavLink>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          )}

          <div
            className={cn(
              "bg-sidebar",
              displayExpanded
                ? "border-t border-sidebar-border px-4 py-3"
                : "flex justify-center border-t border-sidebar-border px-2 pb-4 pt-1"
            )}
          >
            {displayExpanded ? (
              <UserAccount email={userEmail} />
            ) : (
              <UserAccount email={userEmail} compact />
            )}
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
