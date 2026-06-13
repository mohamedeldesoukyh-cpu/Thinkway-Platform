import Image from "next/image";
import Link from "next/link";
import {
  Building2Icon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { UserAccount } from "@/components/layout/user-account";
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
  /** Hide generic page header (entity workspaces provide their own). */
  hidePageHeader?: boolean;
  /**
   * Lock shell height and delegate scrolling to page content (campaign workspaces).
   * Prevents document/main scroll so inner sticky regions work.
   */
  containedMain?: boolean;
  mainClassName?: string;
  /** When set, shows a back control that navigates to this path. */
  backFallbackHref?: string;
  backLabel?: string;
};

export async function DashboardShell({
  children,
  title,
  description,
  actions,
  hidePageHeader = false,
  containedMain = false,
  mainClassName,
  backFallbackHref,
  backLabel = "Go back",
}: DashboardShellProps) {
  const { user } = await getAuthUser();
  const userEmail = user?.email ?? null;

  return (
    <div className="flex min-h-svh bg-background">
      <CollapsibleAppSidebar userEmail={userEmail} />
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          containedMain && "h-svh max-h-svh overflow-hidden"
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
          <Link href="/" className="flex items-center">
            <Image
              src="/tw-wordmark.png"
              alt="Thinkway"
              width={130}
              height={26}
              priority
              className="h-6 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-1">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium",
                    "bg-muted text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <UserAccount email={userEmail} compact inSidebar={false} />
        </div>
        {hidePageHeader ? null : (
          <header className="thinkway-shell-header flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 items-start gap-2">
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
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </header>
        )}
        <main
          className={cn(
            containedMain
              ? "flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6"
              : "min-h-0 flex-1 overflow-y-auto p-4 md:p-6",
            mainClassName
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
