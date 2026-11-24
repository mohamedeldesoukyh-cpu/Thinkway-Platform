import { CLIENT_WORKSPACE_NAV_SECTIONS, type ClientWorkspaceEntitlementView, type ClientWorkspaceNavSection } from "./entitlement";

export function parseHiddenWorkspaceTabs(value: unknown): ClientWorkspaceNavSection[] {
  if (!Array.isArray(value)) return [];
  return CLIENT_WORKSPACE_NAV_SECTIONS.filter((section) => value.includes(section));
}

export function applyWorkspaceTabVisibility(
  entitlement: ClientWorkspaceEntitlementView,
  hiddenTabs: ClientWorkspaceNavSection[]
): ClientWorkspaceEntitlementView {
  const tabAccess = { ...entitlement.tabAccess };
  for (const section of hiddenTabs) tabAccess[section] = "locked";
  return { ...entitlement, tabAccess, hiddenTabs };
}
