"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { NAV_SECTIONS } from "@/components/layout/app-navigation";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarSuiteIcon } from "@/components/layout/sidebar-suite-icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

/** Shared with the desktop menu, including immersive Studio and Home pages. */
export function MobileAppNavigation({ account }: { account: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <header className="mobile-app-navigation flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open main navigation"><MenuIcon /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(22rem,100%)] gap-0">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Browse all platform workspaces.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-3">
            <label className="sr-only" htmlFor="mobile-navigation-search">Find a workspace</label>
            <input id="mobile-navigation-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a workspace…" className="min-h-11 w-full rounded-lg border bg-background px-3 text-base" />
          </div>
          <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {NAV_SECTIONS.map((section, index) => {
              const items = section.items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
              if (!items.length) return null;
              return <section key={index} className="mb-4">
                <h2 className="px-3 py-2 text-xs font-semibold text-muted-foreground">{section.group ?? section.subgroup}</h2>
                {items.map((item) => <AppNavLink key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={(item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`)) ? "page" : undefined} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:font-semibold">
                  <SidebarSuiteIcon name={item.icon} className="size-[18px] shrink-0" />{item.label}
                </AppNavLink>)}
              </section>;
            })}
            {!NAV_SECTIONS.some((section) => section.items.some((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))) && <p className="p-3 text-sm text-muted-foreground">No matching workspaces.</p>}
          </nav>
        </SheetContent>
      </Sheet>
      <AppNavLink href="/" aria-label="Thinkway home"><ThinkwayLogo compact className="mb-0" /></AppNavLink>
      <div className="flex items-center gap-2"><ThemeToggle />{account}</div>
    </header>
  );
}
