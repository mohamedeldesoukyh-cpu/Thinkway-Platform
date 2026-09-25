"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/billing", "Billing & finance"],
  ["/finance/po-tracker", "PO tracker"],
  ["/finance/exchange-rates", "Exchange rates"],
  ["/planning", "Planning"],
  ["/groups", "Holding Groups"],
] as const;

export function BillingRelatedNav() {
  const pathname = usePathname();
  return <nav className="billing-related-nav" aria-label="Related workspaces">
    {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
