import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { PortalMobileNav } from "@/components/layout/portal-mobile-nav";
import {
  PortalNav,
  type PortalNavItem,
  type PortalNavVariant,
} from "@/components/layout/portal-nav";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { IdentityLogo } from "@/lib/entity-logos/identity-logo";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  title: string;
  description?: string;
  userLabel?: string | null;
  identityLogo?: IdentityLogo | null;
  navItems: PortalNavItem[];
  children: React.ReactNode;
  mobileNavPlacement?: "chips" | "bottom";
  navVariant?: PortalNavVariant;
  workspaceLabel?: string;
};

function PortalPartnerMark({ identityLogo }: { identityLogo?: IdentityLogo | null }) {
  if (identityLogo?.url) {
    return (
      <>
        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={identityLogo.url}
          alt={identityLogo.alt}
          className="h-8 w-auto max-w-[132px] object-contain"
        />
      </>
    );
  }
  if (identityLogo?.alt) {
    return (
      <>
        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <span className="max-w-[132px] truncate text-sm font-semibold tracking-tight">
          {identityLogo.alt}
        </span>
      </>
    );
  }
  return null;
}

export function PortalShell({
  title,
  description,
  userLabel,
  identityLogo,
  navItems,
  children,
  mobileNavPlacement = "chips",
  navVariant = "pills",
  workspaceLabel,
}: PortalShellProps) {
  const compact = navVariant === "compact";

  return (
    <div className="flex min-h-svh bg-background">
      <aside
        className={cn(
          "hidden w-64 shrink-0 border-r border-border bg-card/40 md:flex md:flex-col",
          compact ? "px-3 py-4" : "p-4"
        )}
      >
        <div className={cn(compact ? "mb-5 px-1" : "mb-6")}>
          <div className="flex items-center gap-3">
            <ThinkwayLogo className="mb-0" />
            <PortalPartnerMark identityLogo={identityLogo} />
          </div>
          {workspaceLabel ? (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {workspaceLabel}
            </p>
          ) : null}
          <p
            className={cn(
              "truncate",
              compact
                ? "mt-1 text-sm font-medium text-foreground"
                : "mt-2 text-xs text-muted-foreground"
            )}
          >
            {userLabel ?? "Portal user"}
          </p>
        </div>
        <div className={cn(compact && "min-h-0 flex-1")}>
          <PortalNav items={navItems} variant={navVariant} />
        </div>
        <div className={cn(compact ? "mt-4 border-t border-border pt-3" : "mt-8")}>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "border-b border-border",
            compact ? "px-4 py-3 md:hidden" : "px-4 py-4 md:px-8"
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <ThinkwayLogo className="mb-0" />
              <PortalPartnerMark identityLogo={identityLogo} />
            </div>
            <SignOutButton showLabel={false} />
          </div>
          {compact ? (
            <>
              {workspaceLabel ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:hidden">
                  {workspaceLabel}
                </p>
              ) : null}
              <h1 className="font-heading text-base font-semibold tracking-tight md:hidden">
                {title}
              </h1>
            </>
          ) : (
            <>
              <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </>
          )}
        </header>
        {mobileNavPlacement === "chips" ? (
          <PortalMobileNav items={navItems} variant={navVariant} />
        ) : null}
        <main
          className={
            mobileNavPlacement === "bottom"
              ? "min-h-0 flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8"
              : compact
                ? "min-h-0 flex-1 overflow-y-auto p-4 md:px-6 md:py-5"
                : "min-h-0 flex-1 overflow-y-auto p-4 md:p-8"
          }
        >
          {children}
        </main>
        {mobileNavPlacement === "bottom" ? (
          <PortalMobileNav items={navItems} placement="bottom" variant={navVariant} />
        ) : null}
      </div>
    </div>
  );
}
