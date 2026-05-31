import Link from "next/link";
import {
  Building2Icon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  UsersIcon,
} from "lucide-react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserAccount } from "@/components/layout/user-account";
import { getAuthUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon },
  { href: "/clients", label: "Clients", icon: Building2Icon },
  { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
  { href: "/vendors", label: "Vendors", icon: UsersIcon },
] as const;

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export async function DashboardShell({
  children,
  title,
  description,
  actions,
}: DashboardShellProps) {
  const { user } = await getAuthUser();
  const userEmail = user?.email ?? null;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar userEmail={userEmail} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
          <Link href="/" className="font-heading text-lg font-semibold">
            Thinkway
          </Link>
          <nav className="flex items-center gap-1">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-3xl px-3 py-2 text-xs font-medium",
                    "bg-muted text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <UserAccount email={userEmail} compact />
        </div>
        <header className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="space-y-0.5">
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
