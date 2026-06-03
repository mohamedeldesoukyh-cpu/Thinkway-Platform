"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeftIcon,
  BarChart3Icon,
  Building2Icon,
  CalendarClockIcon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  MegaphoneIcon,
  ReceiptIcon,
  Settings2Icon,
  SparklesIcon,
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
  { href: "/dashboard", label: "Executive", icon: LineChartIcon },
  { href: "/groups", label: "Groups", icon: LayersIcon },
  { href: "/clients", label: "Legal Entities", icon: Building2Icon },
  { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
  {
    href: "/ios",
    label: "IOs",
    icon: FileSignatureIcon,
    children: [
      { href: "/ios/client", label: "Client IOs" },
      { href: "/ios/vendor", label: "Vendor IOs" },
    ],
  },
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
  { href: "/reports", label: "Reports", icon: BarChart3Icon },
  { href: "/ai", label: "AI Analyst", icon: SparklesIcon },
  { href: "/links", label: "Link Generator", icon: Link2Icon },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings2Icon,
    children: [
      { href: "/settings/users", label: "Users" },
      { href: "/settings/roles", label: "Roles" },
      { href: "/settings/permissions", label: "Permissions" },
      { href: "/settings/access-control", label: "Access Control" },
    ],
  },
  { href: "/vendors", label: "Vendors", icon: UsersIcon },
];

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

export function CollapsibleAppSidebar({ userEmail }: CollapsibleAppSidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[sticky-layout] sidebar sticky enabled");
    }
  }, []);

  return (
    <aside
      className={cn(
        "group/sidebar relative hidden shrink-0 self-start border-r border-border bg-sidebar md:sticky md:top-0 md:flex md:h-svh md:max-h-svh md:flex-col md:overflow-hidden",
        "w-16 transition-[width] duration-200 ease-out hover:w-64"
      )}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border px-3 group-hover/sidebar:px-5">
        <Link href="/" className="flex items-center gap-2.5" title="Thinkway">
          <Image
            src="/tw-icon.png"
            alt="Thinkway"
            width={36}
            height={36}
            priority
            className="size-9 shrink-0 rounded-lg"
          />
          <span className="hidden font-heading text-lg font-extrabold tracking-tight text-white group-hover/sidebar:inline">
            THINK<span className="text-brand-blue">WAY</span>
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 group-hover/sidebar:p-4">
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
                title={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-gradient text-white shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden truncate group-hover/sidebar:inline">{item.label}</span>
              </Link>
              {item.children && isActive ? (
                <div className="ml-7 mt-1 hidden flex-col gap-0.5 border-l border-sidebar-border pl-3 group-hover/sidebar:flex">
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
      <div className="border-t border-sidebar-border p-2 group-hover/sidebar:p-4">
        <UserAccount email={userEmail} compact className="group-hover/sidebar:hidden" />
        <div className="hidden group-hover/sidebar:block">
          <UserAccount email={userEmail} />
        </div>
      </div>
    </aside>
  );
}
