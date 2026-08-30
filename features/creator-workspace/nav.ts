import type { PortalNavItem } from "@/components/layout/portal-nav";

/** Canonical Creator Workspace chrome. Evolve `/creator-portal`; do not add a second route. */
export const CREATOR_WORKSPACE_HOME_HREF = "/creator-portal";

export const CREATOR_WORKSPACE_NAV_ITEMS = [
  { href: CREATOR_WORKSPACE_HOME_HREF, label: "Home" },
  { href: "/creator-portal/campaigns", label: "Campaigns" },
  { href: "/creator-portal/deliverables", label: "Deliverables" },
  { href: "/creator-portal/profile", label: "Profile" },
] as const satisfies ReadonlyArray<Omit<PortalNavItem, "badge">>;

export const CREATOR_WORKSPACE_LEGACY_REDIRECTS = {
  "/creator-portal/payments": "/creator-portal/profile?section=payments",
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

export function withCreatorHomeBadge(
  unreadCount: number
): PortalNavItem[] {
  return CREATOR_WORKSPACE_NAV_ITEMS.map((item) =>
    item.href === CREATOR_WORKSPACE_HOME_HREF && unreadCount > 0
      ? { ...item, badge: unreadCount }
      : { ...item }
  );
}
