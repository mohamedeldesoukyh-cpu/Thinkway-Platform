import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { PortalMobileNav } from "@/components/layout/portal-mobile-nav";
import { PortalNav, type PortalNavItem } from "@/components/layout/portal-nav";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { IdentityLogo } from "@/lib/entity-logos/identity-logo";

type PortalShellProps = {
  title: string;
  description?: string;
  userLabel?: string | null;
  identityLogo?: IdentityLogo | null;
  navItems: PortalNavItem[];
  children: React.ReactNode;
};

export function PortalShell({
  title,
  description,
  userLabel,
  identityLogo,
  navItems,
  children,
}: PortalShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 p-4 md:block">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <ThinkwayLogo className="mb-0" />
            {identityLogo?.url ? (
              <>
                <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={identityLogo.url}
                  alt={identityLogo.alt}
                  className="h-8 w-auto max-w-[132px] object-contain"
                />
              </>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{userLabel ?? "Portal user"}</p>
        </div>
        <PortalNav items={navItems} />
        <div className="mt-8">
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-4 py-4 md:px-8">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </header>
        <PortalMobileNav items={navItems} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
