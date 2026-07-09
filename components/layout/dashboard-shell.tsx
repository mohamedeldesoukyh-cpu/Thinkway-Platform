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
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { DashboardHelpButton } from "@/components/layout/dashboard-help-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { UserAccount } from "@/components/layout/user-account";
import {
  HomeWorkspaceNavTabs,
  type HomeWorkspaceNavTab,
} from "@/features/home/components/home-workspace-nav-tabs";
import { getAuthUser } from "@/lib/supabase/server";
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
   */
  containedMain?: boolean;
  mainClassName?: string;
  /** When set, shows Overview / Finance / Campaigns / Clients switcher in the shell topbar. */
  workspaceNavActive?: HomeWorkspaceNavTab;
  /** When set, shows a back control that navigates to this path. */
  backFallbackHref?: string;
  backLabel?: string;
};

export async function DashboardShell({
  children,
  title,
  description,
  actions,
  platformV6 = false,
  hidePageHeader = false,
  immersiveLayout = false,
  containedMain = false,
  mainClassName,
  workspaceNavActive,
  backFallbackHref,
  backLabel = "Go back",
}: DashboardShellProps) {
  const { user, fullName } = await getAuthUser();
  const userEmail = user?.email ?? null;

  return (
    <div className="relative flex min-h-svh bg-background text-foreground">
      <CollapsibleAppSidebar userEmail={userEmail} />
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out",
          containedMain && "h-svh max-h-svh overflow-hidden"
        )}
      >
        {!immersiveLayout ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md md:hidden dark:bg-background/90">
          <Link href="/" className="flex items-center">
            <ThinkwayLogo compact className="mb-0" />
          </Link>
          <nav className="flex items-center gap-1">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-xs font-medium",
                    "bg-card text-foreground shadow-[var(--card-shadow)]"
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <DashboardHelpButton />
            <ThemeToggle />
            <UserAccount email={userEmail} name={fullName} compact inSidebar={false} />
          </div>
        </div>
        ) : null}
        {!immersiveLayout && workspaceNavActive ? (
          <div className="thinkway-platform-v6 thinkway-platform-v6-workspace-nav-mobile md:hidden">
            <HomeWorkspaceNavTabs active={workspaceNavActive} />
          </div>
        ) : null}
        {!immersiveLayout && hidePageHeader ? (
          <header
            className={cn(
              "hidden items-center justify-between gap-3 md:flex",
              platformV6
                ? cn(
                    "thinkway-platform-v6-topbar",
                    workspaceNavActive && "thinkway-platform-v6-topbar--workspace-nav"
                  )
                : "thinkway-shell-header px-4 py-2.5 md:px-8"
            )}
          >
            {platformV6 ? (
              <div>
                <span className="platform-v6-tb-title">{title}</span>
                {description ? (
                  <p className="platform-v6-tb-sub">{description}</p>
                ) : null}
              </div>
            ) : (
              <Link href="/" className="flex shrink-0 items-center" title="Thinkway home">
                <ThinkwayLogo compact showText className="mb-0" />
              </Link>
            )}
            {workspaceNavActive ? <HomeWorkspaceNavTabs active={workspaceNavActive} /> : null}
            <div className="flex items-center gap-2">
              <DashboardHelpButton />
              <ThemeToggle />
              <UserAccount email={userEmail} name={fullName} compact inSidebar={false} />
            </div>
          </header>
        ) : !immersiveLayout && platformV6 ? (
          <header
            className={cn(
              "thinkway-platform-v6-topbar hidden w-full md:flex",
              "thinkway-platform-v6",
              workspaceNavActive && "thinkway-platform-v6-topbar--workspace-nav"
            )}
          >
            <div>
              <span className="platform-v6-tb-title">{title}</span>
              {description ? <p className="platform-v6-tb-sub">{description}</p> : null}
            </div>
            {workspaceNavActive ? <HomeWorkspaceNavTabs active={workspaceNavActive} /> : null}
            <div className="flex items-center gap-2">
              <DashboardHelpButton />
              <ThemeToggle />
              <UserAccount email={userEmail} name={fullName} compact inSidebar={false} />
            </div>
          </header>
        ) : !immersiveLayout ? (
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
              <DashboardHelpButton />
              <ThemeToggle />
              {actions}
            </div>
          </header>
        ) : null}
        <main
          className={cn(
            platformV6 && "thinkway-platform-v6",
            containedMain
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-4 md:p-6"
              : "min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6",
            platformV6 && !containedMain && "bg-[#f8fafc] p-6 md:p-6",
            platformV6 && containedMain && "bg-[#f8fafc] p-0 md:p-0",
            mainClassName
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
