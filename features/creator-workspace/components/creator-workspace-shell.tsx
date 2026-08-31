"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDaysIcon,
  ClapperboardIcon,
  FolderKanbanIcon,
  HomeIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react";

import { isPortalNavActive, type PortalNavItem } from "@/components/layout/portal-nav";
import { signOutAction } from "@/features/auth/actions";
import { creatorInitials } from "@/features/creator-workspace/chrome";

const NAV_ICONS: Record<string, typeof HomeIcon> = {
  "/creator-portal": HomeIcon,
  "/creator-portal/campaigns": FolderKanbanIcon,
  "/creator-portal/deliverables": ClapperboardIcon,
  "/creator-portal/calendar": CalendarDaysIcon,
  "/creator-portal/payments": WalletIcon,
  "/creator-portal/profile": UserIcon,
};

export function CreatorWorkspaceShell({
  userLabel,
  avatarUrl,
  navItems,
  children,
}: {
  userLabel: string;
  avatarUrl?: string | null;
  navItems: PortalNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const initials = creatorInitials(userLabel);

  return (
    <div className="cw">
      <header className="topbar">
        <div className="topbar__in">
          <span className="brand">
            <i>
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <rect width="48" height="48" rx="13" fill="#060810" />
                <circle cx="19" cy="19" r="7.4" fill="#fff" />
                <rect x="23.6" y="23.6" width="14.6" height="14.6" rx="4.6" fill="#0057ff" />
              </svg>
            </i>
            <b>
              THINK<span>WAY</span>
            </b>
            <em>Creator Workspace</em>
          </span>
          <span className="who">
            <span className="who__b">
              <span className="who__n">{userLabel}</span>
              <span className="who__r">Creator</span>
            </span>
            <span className="av">
              {initials}
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" />
              ) : null}
            </span>
          </span>
          <form action={signOutAction}>
            <button type="submit" className="signout" title="Sign out" aria-label="Sign out">
              <svg viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </header>
      <nav className="tabsnav" aria-label="Creator Workspace">
        <div className="tabsnav__in">
          {navItems.map((item) => {
            const active = isPortalNavActive(pathname, item.href);
            const Icon = NAV_ICONS[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="tab"
                aria-current={active ? true : undefined}
              >
                {Icon ? <Icon /> : null}
                {item.label}
                {item.badge ? <span className="badge num">{item.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
