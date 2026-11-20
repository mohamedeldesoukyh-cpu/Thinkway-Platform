"use client";
import { useEffect, useRef, useState } from "react";
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
  const drawer = useRef<HTMLDivElement>(null);
  const searchShortcut = useRef(false);
  const touchStartY = useRef<number | null>(null);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (!window.matchMedia("(max-width: 1023px)").matches) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchShortcut.current = true; setOpen(true); setFocusRequest(value => value + 1);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <header className="mobile-app-navigation flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2 lg:hidden">
    <Sheet open={open} onOpenChange={value => { searchShortcut.current = false; setOpen(value); }}>
      <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open main navigation"><MenuIcon /></Button></SheetTrigger>
      <SheetContent ref={drawer} side="left" className="tw-sb sb-mobile"
      onOpenAutoFocus={event => {
        // Opening navigation on touch devices should not summon the keyboard.
        // Explicit keyboard search keeps its existing focus behavior.
        if (window.matchMedia("(pointer: coarse)").matches && !searchShortcut.current) {
          event.preventDefault();
          drawer.current?.focus({ preventScroll: true });
        }
        searchShortcut.current = false;
      }}
      onTouchStart={event => { touchStartY.current = event.touches.length === 1 ? event.touches[0].clientY : null; }}
      onTouchMove={event => {
        if (touchStartY.current === null || event.touches.length !== 1 || Math.abs(event.touches[0].clientY - touchStartY.current) < 12) return;
        const input = drawer.current?.querySelector<HTMLInputElement>('input[aria-label="Search navigation"]');
        if (input && document.activeElement === input) input.blur();
        touchStartY.current = null;
      }}
      onTouchEnd={() => { touchStartY.current = null; }}
      onTouchCancel={() => { touchStartY.current = null; }}
      onEscapeKeyDown={event => {
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
