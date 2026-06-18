"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BrainIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  MegaphoneIcon,
  RadarIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PinIcon,
  PinOffIcon,
  PercentIcon,
  ReceiptIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  SendIcon,
  TagsIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { UserAccount } from "@/components/layout/user-account";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";
import {
  APP_SIDEBAR_MARGIN,
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

type NavGroup = {
  label: string;
  items: NavEntry[];
};

/** Global nav order — overview, workspace, commercial, finance, insights, admin. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { kind: "link", href: "/", label: "Home", icon: LayoutDashboardIcon },
      { kind: "link", href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    label: "Workspace",
    items: [
      { kind: "link", href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { kind: "link", href: "/discovery", label: "Discovery", icon: RadarIcon },
    ],
  },
  {
    label: "Clients and vendors CRM",
    items: [
      { kind: "link", href: "/groups", label: "Holding Groups", icon: LayersIcon },
      { kind: "link", href: "/clients", label: "Clients", icon: Building2Icon },
      { kind: "link", href: "/brands", label: "Brands", icon: SparklesIcon },
      { kind: "link", href: "/vendors", label: "Vendors", icon: UsersIcon },
    ],
  },
  {
    label: "Commercial",
    items: [
      { kind: "link", href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/ios/vendor", label: "Vendor IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/billing", label: "Billing", icon: ReceiptIcon },
      { kind: "link", href: "/finance/po-tracker", label: "PO Tracker", icon: ReceiptIcon },
    ],
  },
  {
    label: "Finance",
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
    items: [
      { kind: "link", href: "/reports", label: "Reports", icon: BarChart3Icon },
      // Intelligence — gated by INTELLIGENCE_ARCHIVED (see docs/INTELLIGENCE_ARCHIVE.md)
      ...(isIntelligenceEnabled()
        ? [{ kind: "link" as const, href: "/intelligence", label: "Intelligence", icon: BrainIcon }]
        : []),
      { kind: "link", href: "/ai", label: "AI Analyst", icon: SparklesIcon },
      { kind: "link", href: "/links", label: "Link Generator", icon: Link2Icon },
    ],
  },
  {
    label: "Administration",
    items: [
      { kind: "link", href: "/settings/users", label: "Users", icon: Settings2Icon },
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
      { kind: "link", href: "/system/health", label: "System Health", icon: ActivityIcon },
    ],
  },
];

const ALL_GROUP_LABELS = navGroups.map((g) => g.label);
const STORAGE_EXPANDED = "thinkway-sidebar-expanded";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups";
const SIDEBAR_HIDE_DELAY_MS = 200;
const HOVER_TRIGGER_WIDTH = "0.75rem";

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
  const [revealed, setRevealed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    initialCollapsedGroups(pathname)
  );
  const [hydrated, setHydrated] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (pinned) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setRevealed(false);
      hideTimerRef.current = null;
    }, SIDEBAR_HIDE_DELAY_MS);
  }, [clearHideTimer, pinned]);

  const handleReveal = useCallback(() => {
    clearHideTimer();
    setRevealed(true);
  }, [clearHideTimer]);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      if (next) {
        clearHideTimer();
        setRevealed(true);
      }
      return next;
    });
  }, [clearHideTimer]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  const isVisible = pinned || revealed;
  const displayExpanded = resolveAppSidebarExpanded(isVisible, pinned, expanded);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      APP_SIDEBAR_WIDTH_CSS_VAR,
      getAppSidebarLayoutWidth(isVisible, displayExpanded)
    );
  }, [displayExpanded, hydrated, isVisible]);

  const sidebarWidth = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  const slotWidth = isVisible
    ? `calc(${sidebarWidth} + ${APP_SIDEBAR_MARGIN})`
    : "0px";

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
    "rounded-lg p-1.5 text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  return (
    <>
      {!isVisible ? (
        <div
          aria-hidden
          className="fixed inset-y-0 left-0 z-50 hidden md:block"
          style={{ width: HOVER_TRIGGER_WIDTH }}
          onMouseEnter={handleReveal}
        />
      ) : null}

      <div
        className="relative hidden shrink-0 self-start overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-0 md:block md:h-svh md:max-h-svh"
        style={{ width: slotWidth }}
        onMouseEnter={handleReveal}
        onMouseLeave={scheduleHide}
      >
        <aside
          className={cn(
            "absolute flex flex-col overflow-hidden rounded-r-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--card-shadow)] transition-all duration-300 ease-in-out",
            isVisible
              ? "pointer-events-auto translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-2 opacity-0"
          )}
          style={{
            left: APP_SIDEBAR_MARGIN,
            top: APP_SIDEBAR_MARGIN,
            height: `calc(100svh - 2 * ${APP_SIDEBAR_MARGIN})`,
            width: sidebarWidth,
          }}
        >
      <div
        className={cn(
          "flex h-16 items-center border-b",
          displayExpanded
            ? "justify-between border-sidebar-border px-4"
            : "justify-center border-sidebar-border px-1.5"
        )}
      >
        <Link href="/" className="min-w-0" title="Thinkway">
          <ThinkwayLogo showText={displayExpanded} compact={!displayExpanded} className="mb-0" />
        </Link>
            {displayExpanded ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={togglePin}
                  className={sidebarControlButtonClass}
                  title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                  aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                  aria-pressed={pinned}
                >
                  {pinned ? (
                    <PinOffIcon className="size-4" />
                  ) : (
                    <PinIcon className="size-4" />
                  )}
                </button>
                {pinned ? (
                  <button
                    type="button"
                    onClick={() => persistExpanded(false)}
                    className={sidebarControlButtonClass}
                    title="Collapse sidebar"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
      </div>

          {!displayExpanded ? (
            <div className="flex justify-center gap-1 border-b border-sidebar-border py-1">
              <button
                type="button"
                onClick={togglePin}
                className={sidebarControlButtonClass}
                title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                aria-pressed={pinned}
              >
                {pinned ? (
                  <PinOffIcon className="size-4" />
                ) : (
                  <PinIcon className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => persistExpanded(true)}
                className={sidebarControlButtonClass}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpenIcon className="size-4" />
              </button>
            </div>
          ) : null}

      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden",
          displayExpanded ? "p-3" : "px-1 py-2"
        )}
      >
        {navGroups.map((group, groupIndex) => {
          const groupCollapsed = collapsedGroups.has(group.label);

          return (
            <div key={group.label} className="flex flex-col">
              {groupIndex > 0 && !displayExpanded ? (
                <div className="mx-auto my-0.5 h-px w-6 bg-sidebar-border" />
              ) : null}

              {displayExpanded ? (
                <div className="flex items-center gap-1 rounded-lg px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-bold tracking-tight text-primary transition-colors hover:text-primary/80"
                    aria-expanded={!groupCollapsed}
                    aria-label={`${groupCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-4 shrink-0 text-primary/70 transition-transform",
                        !groupCollapsed && "rotate-90"
                      )}
                    />
                    <span className="truncate">{group.label}</span>
                  </button>
                </div>
              ) : null}

              <div
                className={cn(
                  "flex flex-col gap-0.5",
                  displayExpanded && groupCollapsed && "hidden"
                )}
              >
                {group.items.map((item) => {
                  if (item.kind === "subheader") {
                    if (!displayExpanded) return null;
                    return (
                      <div
                        key={`subheader-${item.label}`}
                        className="px-3 pt-2 pb-0.5 text-[9px] font-medium uppercase tracking-wider text-sidebar-muted-foreground/70 first:pt-0"
                      >
                        {item.label}
                      </div>
                    );
                  }

                  const active = isItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center text-sm font-medium transition-colors",
                        displayExpanded
                          ? "gap-3 rounded-2xl px-3 py-2"
                          : "justify-center rounded-md px-1 py-1.5",
                        active
                          ? displayExpanded
                            ? "border-l-2 border-primary bg-[var(--sidebar-active-bg)] pl-[calc(0.75rem-2px)] font-medium text-primary"
                            : "bg-[var(--sidebar-active-bg)] text-primary"
                          : displayExpanded
                            ? "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon
                        className={cn("shrink-0", displayExpanded ? "size-4" : "size-3.5")}
                      />
                      {displayExpanded ? (
                        <span className="truncate">{item.label}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "border-t",
          displayExpanded
            ? "border-sidebar-border p-4"
            : "border-sidebar-border p-1.5"
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
    </>
  );
}
