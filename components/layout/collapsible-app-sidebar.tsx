"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CoinsIcon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PercentIcon,
  ReceiptIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { UserAccount } from "@/components/layout/user-account";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Global nav order — hierarchy-first, then commercial, finance, system. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboardIcon },
      { href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/groups", label: "Groups", icon: LayersIcon },
      { href: "/clients", label: "Legal Entities", icon: Building2Icon },
      { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { href: "/vendors", label: "Vendors", icon: UsersIcon },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      { href: "/ios/vendor", label: "Vendor IOs", icon: FileSignatureIcon },
      { href: "/billing", label: "Billing", icon: ReceiptIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/operations/move", label: "Move", icon: ArrowRightLeftIcon },
      { href: "/operations/reassignment", label: "Reassignment", icon: ArrowRightLeftIcon },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/planning", label: "Planning", icon: CalendarClockIcon },
      { href: "/collections", label: "Collections", icon: CoinsIcon },
      { href: "/treasury", label: "Treasury", icon: WalletIcon },
      { href: "/finance/vat", label: "VAT & Tax", icon: PercentIcon },
      { href: "/finance/po-tracker", label: "PO Tracker", icon: ReceiptIcon },
      { href: "/finance/exchange-rates", label: "Exchange Rates", icon: RefreshCwIcon },
      { href: "/finance/periods", label: "Periods", icon: CalendarRangeIcon },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3Icon },
      { href: "/ai", label: "AI Analyst", icon: SparklesIcon },
      { href: "/links", label: "Link Generator", icon: Link2Icon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings/users", label: "Users", icon: Settings2Icon },
      { href: "/settings/roles", label: "Roles", icon: UserCogIcon },
      { href: "/settings/permissions", label: "Permissions", icon: ShieldIcon },
      { href: "/settings/access-control", label: "Access Control", icon: ShieldIcon },
      { href: "/settings/client-access", label: "Client Access", icon: UsersIcon },
      { href: "/system/health", label: "System Health", icon: ActivityIcon },
    ],
  },
];

const ALL_GROUP_LABELS = navGroups.map((g) => g.label);
const STORAGE_EXPANDED = "thinkway-sidebar-expanded";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups";

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroupLabel(pathname: string): string | null {
  for (const group of navGroups) {
    if (group.items.some((item) => isItemActive(pathname, item.href))) {
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
    return new Set(parsed);
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

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const activeGroupLabel = findActiveGroupLabel(pathname);

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 self-start border-r border-border bg-sidebar transition-[width] duration-200 ease-out md:sticky md:top-0 md:flex md:h-svh md:max-h-svh md:flex-col",
        expanded ? "w-64" : "w-16"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          expanded ? "justify-between px-4" : "justify-center px-2"
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          title="Thinkway"
        >
          <Image
            src="/tw-icon.png"
            alt="Thinkway"
            width={36}
            height={36}
            priority
            className="size-9 shrink-0 rounded-lg"
          />
          {expanded ? (
            <span className="truncate font-heading text-lg font-extrabold tracking-tight text-white">
              THINK<span className="text-brand-blue">WAY</span>
            </span>
          ) : null}
        </Link>
        {expanded ? (
          <button
            type="button"
            onClick={() => persistExpanded(false)}
            className="rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftCloseIcon className="size-4" />
          </button>
        ) : null}
      </div>

      {!expanded ? (
        <div className="flex justify-center border-b border-sidebar-border py-2">
          <button
            type="button"
            onClick={() => persistExpanded(true)}
            className="rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
          expanded ? "p-3" : "p-2"
        )}
      >
        {navGroups.map((group, groupIndex) => {
          const groupCollapsed = collapsedGroups.has(group.label);
          const hasActiveItem = group.label === activeGroupLabel;

          return (
            <div key={group.label} className="flex flex-col">
              {groupIndex > 0 && !expanded ? (
                <div className="mx-auto my-1 h-px w-8 bg-sidebar-border" />
              ) : null}

              {expanded ? (
                <div className="flex items-center gap-1 rounded-lg px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/75"
                    aria-expanded={!groupCollapsed}
                    aria-label={`${groupCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3.5 shrink-0 transition-transform",
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
                  expanded && groupCollapsed && "hidden"
                )}
              >
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center rounded-2xl py-2 text-sm font-medium transition-colors",
                        expanded ? "gap-3 px-3" : "justify-center px-2",
                        active
                          ? "bg-brand-gradient text-white shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        !expanded && hasActiveItem && active && "ring-1 ring-white/20"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {expanded ? (
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
          "border-t border-sidebar-border",
          expanded ? "p-4" : "p-2"
        )}
      >
        {expanded ? (
          <UserAccount email={userEmail} />
        ) : (
          <UserAccount email={userEmail} compact />
        )}
      </div>
    </aside>
  );
}
