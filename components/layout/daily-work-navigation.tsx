"use client";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { SidebarSuiteIcon } from "./sidebar-suite-icons";
import { DAILY_NAV_ITEMS, activeNavigationHref } from "./app-navigation";
export function DailyWorkNavigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = activeNavigationHref(pathname);
  return <section aria-label="Pinned shortcuts">
    <div className="sb__pinhead">Pinned</div>
    <div className="sb__pins">{DAILY_NAV_ITEMS.map(item => <AppNavLink key={item.href} href={item.href} onClick={onNavigate} className="sb__row" title={item.description} aria-current={active === item.href ? "page" : undefined}>
      <SidebarSuiteIcon name={item.icon} className="ic" /><span className="sb__label">{item.label}</span>
    </AppNavLink>)}</div>
  </section>;
}
