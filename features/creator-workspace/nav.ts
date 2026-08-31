import type { PortalNavItem } from "@/components/layout/portal-nav";

/** Canonical Creator Workspace chrome. Evolve `/creator-portal`; do not add a second route. */
export const CREATOR_WORKSPACE_HOME_HREF = "/creator-portal";
export const CREATOR_WORKSPACE_CALENDAR_HREF = "/creator-portal/calendar";
export const CREATOR_WORKSPACE_DELIVERABLES_HREF = "/creator-portal/deliverables";

export const CREATOR_WORKSPACE_NAV_ITEMS = [
  { href: CREATOR_WORKSPACE_HOME_HREF, label: "Home" },
  { href: "/creator-portal/campaigns", label: "Campaigns" },
  { href: CREATOR_WORKSPACE_DELIVERABLES_HREF, label: "Deliverables" },
  { href: CREATOR_WORKSPACE_CALENDAR_HREF, label: "Calendar" },
  { href: "/creator-portal/payments", label: "Payments" },
  { href: "/creator-portal/profile", label: "Profile" },
] as const satisfies ReadonlyArray<Omit<PortalNavItem, "badge" | "icon">>;

export const CREATOR_WORKSPACE_LEGACY_REDIRECTS = {
  "/creator-portal/publications": "/creator-portal/campaigns",
  "/creator-portal/vendor-ios": CREATOR_WORKSPACE_HOME_HREF,
  "/creator-portal/notifications": CREATOR_WORKSPACE_HOME_HREF,
} as const;

export type CreatorWorkspaceLegacyPath = keyof typeof CREATOR_WORKSPACE_LEGACY_REDIRECTS;

export function resolveCreatorWorkspaceLegacyRedirect(
  path: string
): string | null {
  if (path in CREATOR_WORKSPACE_LEGACY_REDIRECTS) {
    return CREATOR_WORKSPACE_LEGACY_REDIRECTS[path as CreatorWorkspaceLegacyPath];
  }
  return null;
}

/** Badge Deliverables with items waiting on the creator — not Home unread. */
export function withCreatorDeliverablesBadge(
  pendingCount: number
): PortalNavItem[] {
  return CREATOR_WORKSPACE_NAV_ITEMS.map((item) => ({
    ...item,
    ...(item.href === CREATOR_WORKSPACE_DELIVERABLES_HREF && pendingCount > 0
      ? { badge: pendingCount }
      : {}),
  }));
}

/** @deprecated Use withCreatorDeliverablesBadge — Home is not badged. */
export function withCreatorHomeBadge(unreadCount: number): PortalNavItem[] {
  return withCreatorDeliverablesBadge(unreadCount);
}
