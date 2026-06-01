"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2Icon,
  LayoutDashboardIcon,
  LayersIcon,
  MegaphoneIcon,
  ReceiptIcon,
  UsersIcon,
} from "lucide-react";

import { UserAccount } from "@/components/layout/user-account";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    href: "/groups",
    label: "Groups",
    icon: LayersIcon,
  },
  {
    href: "/clients",
    label: "Legal Entities",
    icon: Building2Icon,
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: MegaphoneIcon,
  },
  {
    href: "/billing",
    label: "Billing",
    icon: ReceiptIcon,
  },
  {
    href: "/vendors",
    label: "Vendors",
    icon: UsersIcon,
  },
] as const;

type AppSidebarProps = {
  userEmail?: string | null;
};

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Thinkway
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-3xl px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <UserAccount email={userEmail} />
      </div>
    </aside>
  );
}
