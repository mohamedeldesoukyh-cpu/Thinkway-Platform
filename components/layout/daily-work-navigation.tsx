"use client";

import { AppNavLink } from "@/components/navigation/app-nav-link";
import { SidebarSuiteIcon } from "./sidebar-suite-icons";
import { DAILY_NAV_ITEMS } from "./app-navigation";

export function DailyWorkNavigation({ pathname, query = "", onNavigate }: { pathname: string; query?: string; onNavigate?: () => void }) {
  const items = DAILY_NAV_ITEMS.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  if (!items.length) return null;
  return <section className="tw-daily-nav" aria-label="Daily work">
    <div className="tw-daily-nav__heading">Daily work</div>
    {items.map(item => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <AppNavLink key={item.href} href={item.href} onClick={onNavigate} className={`tw-daily-nav__link ${item.tone}`} aria-current={active ? "page" : undefined}>
        <span className="tw-daily-nav__icon" aria-hidden="true"><SidebarSuiteIcon name={item.icon} /></span>
        <span className="tw-daily-nav__copy"><span className="tw-daily-nav__label">{item.label}</span><span className="tw-daily-nav__description">{item.description}</span></span>
      </AppNavLink>;
    })}
  </section>;
}
