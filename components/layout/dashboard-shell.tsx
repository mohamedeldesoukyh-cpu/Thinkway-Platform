import Link from "next/link";
import {
  Building2Icon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { EnvironmentBadgeSlot } from "@/components/environment/environment-badge-slot";
import { DashboardHelpButton } from "@/components/layout/dashboard-help-button";
import { DashboardShellUserSlot } from "@/components/layout/dashboard-shell-user-slot";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { DiscoveryTopNavTabs } from "@/features/discovery/components/discovery-top-nav-tabs";
import {
  HomeWorkspaceNavTabs,
  type HomeWorkspaceNavTab,
} from "@/features/home/components/home-workspace-nav-tabs";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon },
  { href: "/clients", label: "Clients", icon: Building2Icon },
  { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
  { href: "/ios/client", label: "IOs", icon: FileSignatureIcon },
  { href: "/settings/users", label: "Settings", icon: Settings2Icon },
  { href: "/vendors", label: "Vendors", icon: UsersIcon },
] as const;

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** thinkway-platform_6.html list/workspace chrome (light, compact topbar). */
  platformV6?: boolean;
  /** Hide generic page header (entity workspaces provide their own). */
  hidePageHeader?: boolean;
  /** Full-bleed home layout — hides shell topbars (desktop + mobile). */
  immersiveLayout?: boolean;
  /**
   * Lock shell height and delegate scrolling to page content (campaign workspaces).
   * Prevents document/main scroll so inner sticky regions work.
   * Full-bleed main (no outer p-4/md:p-6) — pages own their gutters.
   */
  containedMain?: boolean;
  mainClassName?: string;
  /** Extra classes on the compact topbar (hidePageHeader / non–platform-v6). */
  headerClassName?: string;
  /** When set, shows Overview / Finance / Campaigns / Clients switcher in the shell topbar. */
  workspaceNavActive?: HomeWorkspaceNavTab;
  /** When set, shows Discovery section links (Search, Shortlists, …) next to the logo. */
  discoveryNavActiveHref?: string;
  /** When set, shows a back control that navigates to this path. */
  backFallbackHref?: string;
  backLabel?: string;
  /** Skip the desktop chrome header. Pages that render their own header (finance suite) use this. */
  hideDesktopHeader?: boolean;
};

export function DashboardShell({
  children,
  title,
  description,
  actions,
  platformV6 = false,
  hidePageHeader = false,
  immersiveLayout = false,
  containedMain = false,
  mainClassName,
  headerClassName,
  workspaceNavActive,
  discoveryNavActiveHref,
  backFallbackHref,
  backLabel = "Go back",
  hideDesktopHeader = false,
}: DashboardShellProps) {
  const showDiscoveryNav = Boolean(discoveryNavActiveHref);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        // Fill remaining viewport under the environment banner (root flex chain).
        containedMain && "h-full max-h-full min-h-0 overflow-hidden"
      )}
    >
        {!immersiveLayout ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md md:hidden dark:bg-background/90">
          <Link href="/" className="flex items-center">
            <ThinkwayLogo compact className="mb-0" />
          </Link>
          {showDiscoveryNav ? (
            <DiscoveryTopNavTabs activeHref={discoveryNavActiveHref!} />
          ) : (
            <nav className="flex items-center gap-1">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <AppNavLink
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-xs font-medium",
                      "bg-card text-foreground shadow-[var(--card-shadow)]"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </AppNavLink>
                );
              })}
            </nav>
          )}
          <div className="flex items-center gap-2">
            <EnvironmentBadgeSlot />
            <DashboardHelpButton />
            <ThemeToggle />
            <DashboardShellUserSlot compact inSidebar={false} />
          </div>
        </div>
        ) : null}
        {!immersiveLayout && workspaceNavActive ? (
          <div className="thinkway-platform-v6 thinkway-platform-v6-workspace-nav-mobile md:hidden">
            <HomeWorkspaceNavTabs active={workspaceNavActive} />
          </div>
        ) : null}
        {!immersiveLayout && !hideDesktopHeader && hidePageHeader ? (
          <header
            className={cn(
              "hidden items-center justify-between gap-3 md:flex",
              platformV6
                ? cn(
                    "thinkway-platform-v6-topbar",
                    workspaceNavActive && "thinkway-platform-v6-topbar--workspace-nav"
                  )
                : cn(
                    "thinkway-shell-header px-4 py-2.5 md:px-8",
                    showDiscoveryNav && "discovery-shell-header--with-nav",
                    headerClassName
                  )
            )}
          >
            {platformV6 ? (
              <Link href="/" className="flex shrink-0 items-center" title="Thinkway home">
                <ThinkwayLogo compact showText className="mb-0" />
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-8">
                <Link href="/" className="flex shrink-0 items-center" title="Thinkway home">
                  <ThinkwayLogo compact showText className="mb-0" />
                </Link>
                {showDiscoveryNav ? (
                  <DiscoveryTopNavTabs activeHref={discoveryNavActiveHref!} />
                ) : null}
              </div>
            )}
            {workspaceNavActive ? <HomeWorkspaceNavTabs active={workspaceNavActive} /> : null}
            <div className="flex shrink-0 items-center gap-2">
              <EnvironmentBadgeSlot />
              <DashboardHelpButton />
              <ThemeToggle />
              <DashboardShellUserSlot compact inSidebar={false} />
            </div>
          </header>
        ) : !immersiveLayout && !hideDesktopHeader && platformV6 ? (
          <header
            className={cn(
              "thinkway-platform-v6-topbar hidden w-full md:flex",
              "thinkway-platform-v6",
              workspaceNavActive && "thinkway-platform-v6-topbar--workspace-nav"
            )}
          >
            <Link href="/" className="flex shrink-0 items-center" title="Thinkway home">
              <ThinkwayLogo compact showText className="mb-0" />
            </Link>
            {workspaceNavActive ? <HomeWorkspaceNavTabs active={workspaceNavActive} /> : null}
            <div className="flex items-center gap-2">
              <EnvironmentBadgeSlot />
              <DashboardHelpButton />
              <ThemeToggle />
              <DashboardShellUserSlot compact inSidebar={false} />
            </div>
          </header>
        ) : !immersiveLayout && !hideDesktopHeader ? (
          <header className="thinkway-shell-header flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 items-start gap-3">
              <Link
                href="/"
                className="hidden shrink-0 items-center md:flex"
                title="Thinkway home"
              >
                <ThinkwayLogo compact showText className="mb-0" />
              </Link>
              {backFallbackHref ? (
                <PageBackButton
                  fallbackHref={backFallbackHref}
                  label={backLabel}
                  variant="icon"
                  className="mt-0.5 shrink-0"
                />
              ) : null}
              <div className="min-w-0 space-y-1">
                <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <EnvironmentBadgeSlot />
              <DashboardHelpButton />
              <ThemeToggle />
              {actions}
            </div>
          </header>
        ) : null}
        <main
          className={cn(
            platformV6 && "thinkway-platform-v6",
            /* containedMain is full-bleed — pages own their own gutters (e.g. Discovery px-4).
               Do not add p-4 md:p-6 here: callers overriding with only p-0 still left md:p-6,
               which framed header+content as one outer panel. */
            containedMain
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
              : "min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6",
            platformV6 && !containedMain && "bg-background p-6 md:p-6",
            platformV6 && containedMain && "bg-background",
            mainClassName
          )}
        >
          {children}
        </main>
    </div>
  );
}
