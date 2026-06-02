"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeftIcon,
  Building2Icon,
  CalendarClockIcon,
  LayoutDashboardIcon,
  LayersIcon,
  MegaphoneIcon,
  ReceiptIcon,
  UsersIcon,
} from "lucide-react";

import { UserAccount } from "@/components/layout/user-account";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon },
  { href: "/dashboard", label: "Executive", icon: LayoutDashboardIcon },
  { href: "/groups", label: "Groups", icon: LayersIcon },
  { href: "/clients", label: "Legal Entities", icon: Building2Icon },
  { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
  { href: "/billing", label: "Billing", icon: ReceiptIcon },
  {
    href: "/operations",
    label: "Operations",
    icon: ArrowRightLeftIcon,
    children: [
      { href: "/operations/move", label: "Move between accounts" },
      { href: "/operations/reassignment", label: "Reassignment center" },
    ],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: CalendarClockIcon,
    children: [
      { href: "/planning", label: "Planning" },
      { href: "/collections", label: "Collections" },
      { href: "/treasury", label: "Treasury" },
      { href: "/finance/vat", label: "VAT & tax" },
      { href: "/finance/po-tracker", label: "PO tracker" },
      { href: "/finance/exchange-rates", label: "Exchange rates" },
      { href: "/finance/periods", label: "Period management" },
      { href: "/system/health", label: "System health" },
    ],
  },
  { href: "/vendors", label: "Vendors", icon: UsersIcon },
];

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
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <div key={item.href}>
              <Link
                href={item.children?.[0]?.href ?? item.href}
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
              {item.children && isActive ? (
                <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                  {item.children.map((child) => {
                    const childActive =
                      pathname === child.href || pathname.startsWith(`${child.href}/`);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "rounded-2xl px-2 py-1.5 text-xs font-medium transition-colors",
                          childActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <UserAccount email={userEmail} />
      </div>
    </aside>
  );
}
