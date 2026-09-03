"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { LogOutIcon } from "lucide-react";

import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  SidebarSuiteIcon,
  type SidebarIconKey,
} from "@/components/layout/sidebar-suite-icons";
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
const NAV_SECTIONS: NavSection[] = [
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
    group: "Client workspace",
    items: [
      { href: "/groups", label: "Holding Groups", icon: "grp" },
      { href: "/clients", label: "Clients", icon: "client" },
      { href: "/brands", label: "Brands", icon: "brand" },
      { href: "/ios/client", label: "Client IOs", icon: "doc" },
      {
        href: "/discovery/quotations",
        label: "Client Quotations",
        icon: "quote",
      },
    ],
  },
  {
    group: "Vendor workspace",
    items: [
      { href: "/vendors", label: "Vendors", icon: "vendor" },
      { href: "/ios/vendor", label: "Vendor IO register", icon: "doc" },
    ],
  },
  {
    group: "Discovery",
    items: [
      { href: "/discovery/search", label: "Search", icon: "search" },
      { href: "/discovery/shortlists", label: "Shortlists", icon: "list" },
      {
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: "match",
      },
      { href: "/discovery/import", label: "Import Center", icon: "imp" },
    ],
  },
  {
    group: "Finance workspace",
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
    group: "Move from acc to another",
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
  const [collapsedGroups, setCollapsedGroups] = useState(
    () => new Set(DEFAULT_COLLAPSED)
  );
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
        if (!pinned) setPeekOpen(true);
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
            <SidebarSuiteIcon name="pin" />
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
            <SidebarSuiteIcon name="collapse" />
          </button>
        </div>

        <div className="tw-sb2__s">
          <span className="w">
            <SidebarSuiteIcon name="search" />
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
                          <SidebarSuiteIcon name={item.icon} />
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
        <button type="button" className="tw-sb2__a">
          <span className="av" aria-hidden>
            {initials}
          </span>
          <span className="m">
            <b>{email ?? "Signed in"}</b>
            <u>Account</u>
          </span>
          <span className="tw-sp" />
          <span className="tw-ic2" aria-hidden>
            <SidebarSuiteIcon name="chevron" />
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
            <SidebarSuiteIcon name="info" />
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
