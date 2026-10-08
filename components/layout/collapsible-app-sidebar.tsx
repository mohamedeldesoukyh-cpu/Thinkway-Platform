"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LogOutIcon } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { SidebarSuiteIcon } from "./sidebar-suite-icons";
import { SidebarNavigationContent } from "./sidebar-navigation-content";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppVersion } from "@/components/version/app-version";
import { signOutAction } from "@/features/auth/actions";
import { APP_SIDEBAR_PEEK_CLOSE_DELAY_MS, APP_SIDEBAR_WIDTH_CSS_VAR, getAppSidebarLayoutWidth } from "@/lib/layout/app-sidebar-width";
const STORAGE_PINNED = "thinkway-sidebar-pinned";
function SignOutMenuItem() {
  const { pending } = useFormStatus();
  return <DropdownMenuItem asChild disabled={pending}><button type="submit" className="w-full cursor-pointer"><LogOutIcon /><span>{pending ? "Signing out…" : "Sign out"}</span></button></DropdownMenuItem>;
}
export function SidebarBrand() {
  return <AppNavLink href="/" aria-label="Thinkway home" className="sb__brand-link"><span className="sb__mark" aria-hidden><s className="a" /><s className="b" /></span><span className="sb__word">THINK<em>WAY</em></span></AppNavLink>;
}
export function CollapsibleAppSidebar({ userEmail }: { userEmail?: string | null }) {
  const [pinned, setPinned] = useState(true);
  const [peek, setPeek] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nav = useRef<HTMLElement>(null);
  const edge = useRef<HTMLButtonElement>(null);
  const clearTimer = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  function persistPinned(value: boolean) {
    setPinned(value);
    try { localStorage.setItem(STORAGE_PINNED, String(value)); } catch { /* Storage is optional. */ }
  }
  function close() { clearTimer(); setPeek(false); if (!pinned) edge.current?.focus(); }
  useEffect(() => {
    // Hydrate the persisted browser preference after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setPinned(localStorage.getItem(STORAGE_PINNED) !== "false"); } catch { /* Storage is optional. */ }
    return clearTimer;
  }, [clearTimer]);
  useEffect(() => { document.documentElement.style.setProperty(APP_SIDEBAR_WIDTH_CSS_VAR, getAppSidebarLayoutWidth(pinned)); }, [pinned]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (window.matchMedia("(max-width: 1023px)").matches) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); clearTimer(); setPeek(true); setFocusRequest(value => value + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearTimer]);
  const open = pinned || peek;
  return <div data-app-sidebar-root className="tw-sb relative hidden shrink-0 self-stretch lg:sticky lg:top-0 lg:block lg:h-full lg:max-h-full" style={{ width: getAppSidebarLayoutWidth(pinned), zIndex: open ? 70 : 30 }}>
    {!pinned && <button ref={edge} type="button" className="sb-edge" aria-label="Open navigation" onPointerEnter={() => { clearTimer(); setPeek(true); }} onClick={() => { clearTimer(); setPeek(true); setFocusRequest(value => value + 1); }}><span className="sb-edge__grip" aria-hidden>›</span></button>}
    <nav ref={nav} aria-label="Main navigation" aria-hidden={!open} inert={!open} className={"sb" + (!open ? " sb--hidden" : "")} style={{ position: pinned ? "absolute" : "fixed", inset: "0 auto 0 0", zIndex: 70, boxShadow: !pinned && open ? "var(--s-e3)" : undefined }}
      onPointerEnter={clearTimer} onPointerLeave={() => {
        if (pinned || nav.current?.contains(document.activeElement) || document.querySelector('[data-slot="dropdown-menu-content"]')) return;
        clearTimer(); timer.current = setTimeout(() => setPeek(false), APP_SIDEBAR_PEEK_CLOSE_DELAY_MS);
      }} onBlur={event => { if (!pinned && !event.currentTarget.contains(event.relatedTarget) && !document.querySelector('[data-slot="dropdown-menu-content"]')) { clearTimer(); timer.current = setTimeout(() => setPeek(false), APP_SIDEBAR_PEEK_CLOSE_DELAY_MS); } }}>
      <div className="sb__brand"><SidebarBrand /><span className="sb__ctl">
        <button type="button" className="sb-ic" aria-label="Keep navigation open" aria-pressed={pinned} onClick={() => { clearTimer(); setPeek(true); persistPinned(!pinned); }}><SidebarSuiteIcon name="pin" /></button>
        <button type="button" className="sb-ic" aria-label="Close navigation" onClick={() => { clearTimer(); persistPinned(false); setPeek(false); }}><SidebarSuiteIcon name="collapse" /></button>
      </span></div>
      <SidebarNavigationContent focusRequest={focusRequest} onNavigate={() => { if (!pinned) setPeek(false); }} onClose={pinned ? undefined : close} />
      <div className="sb__acct"><SidebarAccount email={userEmail ?? null} initials={userEmail?.split("@")[0].slice(0,2).toUpperCase() ?? "?"} /></div>
    </nav>
  </div>;
}

export function SidebarAccount({
  email,
  initials,
}: {
  email: string | null;
  initials: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="sb__acct-b">
          <span className="sb__av" aria-hidden>
            {initials}
          </span>
          <span className="sb__acct-t">
            <b>{email?.split("@")[0] ?? "Signed in"}</b>
            <u>{email ?? "Account"}</u>
          </span>

          <span className="sb-ic" aria-hidden>
            <SidebarSuiteIcon name="chevron" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Account</span>
            <span className="break-all text-xs text-muted-foreground">
              {email ?? "Signed in"}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <AppNavLink href="/settings/about">
            <SidebarSuiteIcon name="info" />
            About
          </AppNavLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <SignOutMenuItem />
        </form>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <AppVersion />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
