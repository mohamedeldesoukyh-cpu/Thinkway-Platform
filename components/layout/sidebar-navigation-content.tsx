"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { NAV_SECTIONS, DAILY_NAV_ITEMS, activeNavigationHref } from "./app-navigation";
import { SidebarSuiteIcon } from "./sidebar-suite-icons";
import { DailyWorkNavigation } from "./daily-work-navigation";

const STORAGE = "thinkway-sidebar-collapsed-groups-v2";
const accents: Record<string, string> = { Home: "home", "Campaign workspace": "campaign", Discovery: "discovery", "Clients & brands": "clients", Vendors: "vendors", Finance: "finance", Operations: "operations", Insights: "insights", Administration: "admin" };
const groups = NAV_SECTIONS.reduce<{ name: string; sections: typeof NAV_SECTIONS }[]>((result, section) => {
  if (section.group) result.push({ name: section.group, sections: [] });
  result[result.length - 1].sections.push(section);
  return result;
}, []);

export function SidebarNavigationContent({ onNavigate, onClose, focusRequest = 0 }: { onNavigate?: () => void; onClose?: () => void; focusRequest?: number }) {
  const pathname = usePathname();
  const active = activeNavigationHref(pathname);
  const [query, setQuery] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl K");
  const [closed, setClosed] = useState(new Set(["Administration"]));
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const matches = groups.flatMap(group => group.sections.flatMap(section => section.items.map(item => ({ ...item, group: group.name, crumb: section.subgroup ?? group.name })))).filter(item => item.label.toLowerCase().includes(q));
  useEffect(() => {
    // Browser-only preferences are read after hydration to preserve server markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
      if (Array.isArray(saved)) setClosed(new Set(saved.filter(value => typeof value === "string")));
    } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => { if (focusRequest) search.current?.focus(); }, [focusRequest]);
  function toggle(key: string) {
    const next = new Set(closed);
    if (next.has(key)) next.delete(key); else next.add(key);
    setClosed(next);
    try { localStorage.setItem(STORAGE, JSON.stringify([...next])); } catch { /* Storage is optional. */ }
  }
  function highlight(label: string) {
    const index = label.toLowerCase().indexOf(q);
    return index < 0 || !q ? label : <>{label.slice(0, index)}<mark>{label.slice(index, index + q.length)}</mark>{label.slice(index + q.length)}</>;
  }
  function row(item: (typeof NAV_SECTIONS)[number]["items"][number], crumb?: string) {
    return <AppNavLink key={item.href} href={item.href} onClick={onNavigate} className={`sb__row${crumb ? " sb__hit" : ""}`} aria-current={active === item.href ? "page" : undefined} data-echo={!q && DAILY_NAV_ITEMS.some(pin => pin.href === item.href) ? "" : undefined} title={item.label}>
      <SidebarSuiteIcon name={item.icon} className="ic" />
      <span className="sb__label"><span>{highlight(item.label)}</span>{crumb && <span className="sb__crumb">{crumb}</span>}</span>
      {typeof item.count === "number" && item.count > 0 && <span className="sb__badge">{item.count}</span>}
    </AppNavLink>;
  }
  function heading(name: string, key: string, containsActive: boolean, sub = false) {
    return <button type="button" className={sub ? "sb__sgh" : "sb__gh"} aria-expanded={!closed.has(key)} onClick={() => toggle(key)}>
      <span>{name}</span>{closed.has(key) && containsActive && <span className="dot" aria-label="Contains current page" />}<em aria-hidden>▾</em>
    </button>;
  }
  return <div className="sb__navigation" onKeyDown={event => {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      if (query) { setQuery(""); search.current?.focus(); } else if (onClose) onClose(); else search.current?.blur();
    }
    if (q && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const links = Array.from(results.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
      if (!links.length) return;
      event.preventDefault();
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      links[(index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
    }
  }}>
    <div className="sb__search">
      <span className="ic"><SidebarSuiteIcon name="search" /></span>
      <input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search navigation…" aria-label="Search navigation" onKeyDown={event => {
        if (event.key === "Enter" && q) { event.preventDefault(); results.current?.querySelector<HTMLAnchorElement>("a")?.click(); }
      }} />
      {query ? <button type="button" className="sb__clear" aria-label="Clear navigation search" onClick={() => { setQuery(""); search.current?.focus(); }}>×</button> : <span className="sb__kbd">{shortcut}</span>}
    </div>
    <div className="sb__scroll" ref={results}>
      {q ? <div aria-label="Navigation search results">{matches.map(item => row(item, item.crumb))}{!matches.length && <div className="sb__none"><b>No matching pages</b><u>Navigation search looks at page names only — not creators, campaigns or invoices.</u><button type="button" className="sb-btn" onClick={() => { setQuery(""); search.current?.focus(); }}>Clear search</button></div>}</div> : <>
        <DailyWorkNavigation pathname={pathname} onNavigate={onNavigate} />
        {groups.map(group => <section key={group.name} data-group-body={accents[group.name]}>
          {heading(group.name, group.name, group.sections.some(section => section.items.some(item => item.href === active)))}
          {!closed.has(group.name) && group.sections.map((section, index) => section.subgroup ? <div className="sb__sub" key={section.subgroup}>
            {heading(section.subgroup, section.subgroup, section.items.some(item => item.href === active), true)}
            {!closed.has(section.subgroup) && <div className="sb__items">{section.items.map(item => row(item))}</div>}
          </div> : <div key={index} className="sb__items">{section.items.map(item => row(item))}</div>)}
        </section>)}
      </>}
    </div>
  </div>;
}
