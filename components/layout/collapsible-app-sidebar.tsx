"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowDownUpIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BrainIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronUpIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  InfoIcon,
  LayoutDashboardIcon,
  LayersIcon,
  LineChartIcon,
  Link2Icon,
  ListIcon,
  LogOutIcon,
  MailIcon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PercentIcon,
  PinIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldIcon,
  SparklesIcon,
  TagsIcon,
  TargetIcon,
  UploadIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { useFormStatus } from "react-dom";

import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppVersion } from "@/components/version/app-version";
import { signOutAction } from "@/features/auth/actions";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";
import {
  APP_SIDEBAR_PEEK_CLOSE_DELAY_MS,
  APP_SIDEBAR_WIDTH_COLLAPSED,
  APP_SIDEBAR_WIDTH_CSS_VAR,
  APP_SIDEBAR_WIDTH_EXPANDED,
  getAppSidebarLayoutWidth,
} from "@/lib/layout/app-sidebar-width";
import { cn } from "@/lib/utils";

import "@/app/styles/sidebar-suite.css";

type NavLinkDef = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Optional badge; never render 0. */
  count?: number;
};

type NavSection = {
  /** Primary group label (collapsed separators use this). */
  group?: string;
  /** Indented Finance sub-group. */
  subgroup?: string;
  items: NavLinkDef[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    group: "Home",
    items: [
      { href: "/", label: "Home", icon: HomeIcon },
      { href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    group: "Campaign workspace",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { href: "/studio", label: "Studio", icon: LayoutDashboardIcon },
      { href: "/ai", label: "Campaign AI", icon: SparklesIcon },
    ],
  },
  {
    group: "Client workspace",
    items: [
      { href: "/groups", label: "Holding Groups", icon: LayersIcon },
      { href: "/clients", label: "Clients", icon: Building2Icon },
      { href: "/brands", label: "Brands", icon: BriefcaseIcon },
      { href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      {
        href: "/discovery/quotations",
        label: "Client Quotations",
        icon: FileTextIcon,
      },
    ],
  },
  {
    group: "Vendor workspace",
    items: [
      { href: "/vendors", label: "Vendors", icon: UsersIcon },
      {
        href: "/ios/vendor",
        label: "Vendor IO register",
        icon: FileSignatureIcon,
      },
    ],
  },
  {
    group: "Discovery",
    items: [
      { href: "/discovery/search", label: "Search", icon: SearchIcon },
      { href: "/discovery/shortlists", label: "Shortlists", icon: ListIcon },
      {
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: TargetIcon,
      },
      { href: "/discovery/import", label: "Import Center", icon: UploadIcon },
    ],
  },
  {
    group: "Finance workspace",
    subgroup: "Billing & documents",
    items: [
      { href: "/billing", label: "Billing", icon: ReceiptIcon },
      { href: "/finance/po-tracker", label: "PO tracker", icon: FileTextIcon },
      { href: "/finance/invoices", label: "Invoices", icon: FileTextIcon },
      {
        href: "/finance/client-credit-notes",
        label: "Client credit notes",
        icon: CircleMinusIcon,
      },
      {
        href: "/finance/client-debit-notes",
        label: "Client debit notes",
        icon: CirclePlusIcon,
      },
      {
        href: "/finance/vendor-credit-notes",
        label: "Vendor credit notes",
        icon: CircleMinusIcon,
      },
      {
        href: "/finance/vendor-debit-notes",
        label: "Vendor debit notes",
        icon: CirclePlusIcon,
      },
    ],
  },
  {
    subgroup: "Treasury & cash",
    items: [
      { href: "/collections", label: "Collections", icon: CoinsIcon },
      { href: "/treasury", label: "Treasury", icon: WalletIcon },
      {
        href: "/finance/posting-center",
        label: "Posting center",
        icon: SendIcon,
      },
    ],
  },
  {
    subgroup: "Compliance & planning",
    items: [
      { href: "/finance/vat", label: "VAT", icon: PercentIcon },
      {
        href: "/finance/exchange-rates",
        label: "Exchange rates",
        icon: RefreshCwIcon,
      },
      { href: "/finance/periods", label: "Periods", icon: CalendarRangeIcon },
      { href: "/planning", label: "Planning", icon: CalendarClockIcon },
    ],
  },
  {
    group: "Move from acc to another",
    items: [
      {
        href: "/operations/move",
        label: "Move between accounts",
        icon: ArrowRightLeftIcon,
      },
      {
        href: "/operations/reassignment",
        label: "Reassignment center",
        icon: ArrowDownUpIcon,
      },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3Icon },
      ...(isIntelligenceEnabled()
        ? [{ href: "/intelligence", label: "Intelligence", icon: BrainIcon }]
        : []),
      { href: "/links", label: "Link generator", icon: Link2Icon },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/operations", label: "Operations Center", icon: ActivityIcon },
      { href: "/settings/users", label: "Users", icon: UsersIcon },
      { href: "/settings/security", label: "Security", icon: ShieldIcon },
      { href: "/settings/roles", label: "Roles", icon: UserCogIcon },
      { href: "/settings/permissions", label: "Permissions", icon: ShieldIcon },
      {
        href: "/settings/access-control",
        label: "Access Control",
        icon: ShieldIcon,
      },
      { href: "/settings/client-access", label: "Client Access", icon: UsersIcon },
      {
        href: "/settings/client-classification-review",
        label: "Classification Review",
        icon: TagsIcon,
      },
      { href: "/settings/email", label: "Email", icon: MailIcon },
      { href: "/settings/about", label: "About", icon: InfoIcon },
      { href: "/system/health", label: "System Health", icon: ActivityIcon },
      { href: "/system/performance", label: "Performance", icon: GaugeIcon },
    ],
  },
];

const STORAGE_PINNED = "thinkway-sidebar-pinned";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups-v2";
const DEFAULT_COLLAPSED = new Set(["Administration"]);

function sectionKey(section: NavSection): string {
  return section.group ?? section.subgroup ?? "section";
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readPinned(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const pinned = localStorage.getItem(STORAGE_PINNED);
    if (pinned !== null) return pinned === "true";
    return true;
  } catch {
    return true;
  }
}

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set(DEFAULT_COLLAPSED);
  try {
    const raw = localStorage.getItem(STORAGE_COLLAPSED_GROUPS);
    if (!raw) return new Set(DEFAULT_COLLAPSED);
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(DEFAULT_COLLAPSED);
  }
}

function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

function SignOutMenuItem() {
  const { pending } = useFormStatus();
  return (
    <DropdownMenuItem asChild disabled={pending}>
      <button type="submit" className="w-full cursor-pointer">
        <LogOutIcon />
        <span>{pending ? "Signing out..." : "Sign out"}</span>
      </button>
    </DropdownMenuItem>
  );
}

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

export function CollapsibleAppSidebar({ userEmail }: CollapsibleAppSidebarProps) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(true);
  const [peekOpen, setPeekOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(DEFAULT_COLLAPSED));
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPeek = useCallback(() => {
    clearCloseTimer();
    setPeekOpen(true);
  }, [clearCloseTimer]);

  const scheduleClosePeek = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setPeekOpen(false);
      closeTimerRef.current = null;
    }, APP_SIDEBAR_PEEK_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const persistPinned = useCallback((next: boolean) => {
    setPinned(next);
    if (next) setPeekOpen(false);
    localStorage.setItem(STORAGE_PINNED, String(next));
  }, []);

  useEffect(() => {
    setPinned(readPinned());
    setCollapsedGroups(readCollapsedGroups());
    setHydrated(true);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      APP_SIDEBAR_WIDTH_CSS_VAR,
      getAppSidebarLayoutWidth(pinned)
    );
  }, [pinned, hydrated]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!pinned) {
          setPeekOpen(true);
        }
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  const displayOpen = pinned || peekOpen;
  const layoutPinned = pinned;

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NAV_SECTIONS.map((section) => {
      const items = q
        ? section.items.filter((item) => item.label.toLowerCase().includes(q))
        : section.items;
      return { ...section, items };
    }).filter((section) => section.items.length > 0);
  }, [query]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const layoutWidth = layoutPinned
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  const panelWidth = displayOpen
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;

  const email = userEmail ?? null;
  const initials = initialsFromEmail(email);

  return (
    <div
      data-app-sidebar-root
      className={cn(
        "relative hidden shrink-0 self-stretch transition-[width] duration-200 ease-out md:sticky md:top-0 md:block md:h-full md:max-h-full",
        displayOpen ? "z-[70]" : "z-30"
      )}
      style={{ width: layoutWidth }}
    >
      {!pinned ? (
        <div
          className="pointer-events-auto fixed inset-y-0 left-0 z-[65] w-3"
          aria-hidden
          onPointerEnter={openPeek}
        />
      ) : null}

      <nav
        className={cn(
          "tw-sb2",
          displayOpen && "open",
          pinned && "pin",
          !pinned && displayOpen
            ? "fixed inset-y-0 left-0 z-[70]"
            : "absolute inset-y-0 left-0 z-[70]"
        )}
        style={{ width: panelWidth }}
        aria-label="Main navigation"
        onPointerEnter={pinned ? undefined : openPeek}
        onPointerLeave={pinned ? undefined : scheduleClosePeek}
      >
        <div className="tw-sb2__b">
          <span className="tw-logo">
            <button
              type="button"
              className="tw-logo__mk"
              aria-label={pinned ? "Unpin navigation" : "Pin navigation"}
              onClick={() => persistPinned(!pinned)}
            />
            <AppNavLink href="/" className="tw-logo__tx" title="Thinkway home">
              THINK<span>WAY</span>
            </AppNavLink>
          </span>
          <span className="tw-sp" />
          <button
            type="button"
            className={cn("tw-ic2", pinned && "on")}
            aria-label="Pin navigation"
            aria-pressed={pinned}
            onClick={() => persistPinned(!pinned)}
          >
            <PinIcon />
          </button>
          <button
            type="button"
            className="tw-ic2"
            aria-label="Collapse navigation"
            onClick={() => {
              if (pinned) persistPinned(false);
              else {
                clearCloseTimer();
                setPeekOpen(false);
              }
            }}
          >
            <PanelLeftCloseIcon />
          </button>
        </div>

        <div className="tw-sb2__s">
          <span className="w">
            <SearchIcon className="search-ico" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search navigation…"
              aria-label="Search navigation"
              onFocus={() => {
                if (!pinned) openPeek();
              }}
            />
            <span className="kbd">⌘K</span>
          </span>
        </div>

        <div className="tw-sb2__n">
          {filteredSections.map((section, index) => {
            const key = sectionKey(section);
            const closed = collapsedGroups.has(key) && !query.trim();
            const showPrimary = Boolean(section.group);
            const showSub = Boolean(section.subgroup);

            return (
              <div key={`${key}-${index}`}>
                {showPrimary ? <div className="tw-gsep" /> : null}
                {showPrimary ? (
                  <button
                    type="button"
                    className="tw-grp"
                    aria-expanded={!closed}
                    onClick={() => toggleGroup(key)}
                  >
                    {section.group}
                    <span className="ch" aria-hidden>
                      ▾
                    </span>
                  </button>
                ) : null}
                {showSub ? (
                  <button
                    type="button"
                    className="tw-grp sub"
                    aria-expanded={!closed}
                    onClick={() => toggleGroup(key)}
                  >
                    {section.subgroup}
                    <span className="ch" aria-hidden>
                      ▾
                    </span>
                  </button>
                ) : null}
                {closed
                  ? null
                  : section.items.map((item) => {
                      const active = isItemActive(pathname, item.href);
                      const Icon = item.icon;
                      const count =
                        typeof item.count === "number" && item.count > 0
                          ? item.count
                          : null;
                      return (
                        <AppNavLink
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "tw-li",
                            active && "on",
                            count != null && "dot"
                          )}
                          aria-current={active ? "page" : undefined}
                          title={item.label}
                        >
                          <Icon aria-hidden />
                          <span className="lb">{item.label}</span>
                          {count != null ? <em>{count}</em> : null}
                          <span className="tip">
                            {item.label}
                            {count != null ? ` · ${count}` : ""}
                          </span>
                        </AppNavLink>
                      );
                    })}
              </div>
            );
          })}
        </div>

        <SidebarAccount email={email} initials={initials} />
      </nav>
    </div>
  );
}

function SidebarAccount({
  email,
  initials,
}: {
  email: string | null;
  initials: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="tw-sb2__a w-full text-left">
          <span className="av" aria-hidden>
            {initials}
          </span>
          <span className="m">
            <b>{email ?? "Signed in"}</b>
            <u>Account</u>
          </span>
          <span className="tw-sp" />
          <span className="tw-ic2" aria-hidden>
            <ChevronUpIcon />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Account</span>
            <span className="truncate text-xs text-muted-foreground">
              {email ?? "Signed in"}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <AppNavLink href="/settings/about">
            <InfoIcon />
            About
          </AppNavLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <SignOutMenuItem />
        </form>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <AppVersion />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
