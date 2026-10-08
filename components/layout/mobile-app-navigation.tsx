"use client";
import { useEffect, useState } from "react";
import { MenuIcon } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarBrand } from "./collapsible-app-sidebar";
import { SidebarNavigationContent } from "./sidebar-navigation-content";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
export function MobileAppNavigation({ account }: { account: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (!window.matchMedia("(max-width: 1023px)").matches) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpen(true); setFocusRequest(value => value + 1);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <header className="mobile-app-navigation flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2 lg:hidden">
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open main navigation"><MenuIcon /></Button></SheetTrigger>
      <SheetContent side="left" className="tw-sb sb-mobile" onEscapeKeyDown={event => {
        const input = event.currentTarget instanceof HTMLElement ? event.currentTarget.querySelector<HTMLInputElement>('input[aria-label="Search navigation"]') : null;
        if (input?.value) event.preventDefault();
      }}>
        <SheetTitle className="sr-only">Navigation</SheetTitle><SheetDescription className="sr-only">Browse all platform workspaces.</SheetDescription>
        <div className="sb__brand"><SidebarBrand /></div>
        <nav className="sb__navigation" aria-label="Main navigation"><SidebarNavigationContent focusRequest={focusRequest} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} /></nav>
        <div className="sb__acct">{account}</div>
      </SheetContent>
    </Sheet>
    <AppNavLink href="/" aria-label="Thinkway home"><ThinkwayLogo compact className="mb-0" /></AppNavLink>
    <div className="flex items-center gap-2"><ThemeToggle />{account}</div>
  </header>;
}
