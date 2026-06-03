import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { cn } from "@/lib/utils";

type PortalNavItem = {
  href: string;
  label: string;
};

type PortalShellProps = {
  title: string;
  description?: string;
  userLabel?: string | null;
  navItems: PortalNavItem[];
  children: React.ReactNode;
};

export function PortalShell({
  title,
  description,
  userLabel,
  navItems,
  children,
}: PortalShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 p-4 md:block">
        <div className="mb-6">
          <Image
            src="/tw-wordmark.png"
            alt="Thinkway"
            width={140}
            height={28}
            priority
            className="h-6 w-auto"
          />
          <p className="mt-2 text-xs text-muted-foreground">{userLabel ?? "Portal user"}</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8">
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-4 py-4 md:px-8">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
