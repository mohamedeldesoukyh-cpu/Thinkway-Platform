import { emptyClientCampaignExecution } from "./campaign-execution";
import { emptyClientCampaignContent } from "./content-approval";
import type { ClientWorkspaceSectionId } from "./constants";
import { CLIENT_WORKSPACE_JOURNEY_SECTIONS } from "./constants";
import type { ClientCommercialSummary, ClientWorkspaceView } from "./types";

export const CLIENT_WORKSPACE_CLOSED_MESSAGE =
  "This Client Workspace is not enabled for your organisation. Speak with your Thinkway team.";

export const CLIENT_WORKSPACE_LOCKED_MESSAGE =
  "This section is available when your Thinkway team enables the matching Client Workspace entitlement.";

export const CLIENT_WORKSPACE_UNAVAILABLE_MESSAGE =
  "This Client Workspace could not be linked to a legal entity. Speak with your Thinkway team.";

export const CLIENT_WORKSPACE_PACKAGES = ["planning", "commercial", "live"] as const;
export type ClientWorkspacePackage = (typeof CLIENT_WORKSPACE_PACKAGES)[number];

export const CLIENT_WORKSPACE_NAV_SECTIONS = [
  "shortlist",
  "creators",
  "commercial",
  "approval",
  "overview",
] as const;
export type ClientWorkspaceNavSection = (typeof CLIENT_WORKSPACE_NAV_SECTIONS)[number];

export type ClientWorkspaceTabAccess = "open" | "locked";

export const LIVE_PERFORMANCE_PREVIEW_DAYS = 14;
export const LIVE_PERFORMANCE_PREVIEW_MS = LIVE_PERFORMANCE_PREVIEW_DAYS * 24 * 60 * 60 * 1000;
export const LIVE_PERFORMANCE_PREVIEW_ENDING_SOON_DAYS = 3;

export const CLIENT_WORKSPACE_PACKAGE_LABEL: Record<ClientWorkspacePackage, string> = {
  planning: "Planning",
  commercial: "Commercial",
  live: "Live Performance",
};

export const PACKAGE_TAB_ACCESS: Record<
  ClientWorkspacePackage,
  Record<ClientWorkspaceNavSection, ClientWorkspaceTabAccess>
> = {
  planning: {
    shortlist: "open",
    creators: "open",
    commercial: "locked",
    approval: "locked",
    overview: "open",
  },
  commercial: {
    shortlist: "open",
    creators: "open",
    commercial: "open",
    approval: "locked",
    overview: "open",
  },
  live: {
    shortlist: "open",
    creators: "open",
    commercial: "open",
    approval: "open",
    overview: "open",
  },
};

export type ClientWorkspaceTabOverrides = Partial<
  Record<ClientWorkspaceNavSection, ClientWorkspaceTabAccess>
>;

export type ClientWorkspaceEntitlementRecord = {
  enabled: boolean;
  package: ClientWorkspacePackage | null;
  tabOverrides: ClientWorkspaceTabOverrides | null;
  grandfathered: boolean;
  previewStartedAt: string | null;
  previewExpiresAt: string | null;
  previewPreviousPackage: ClientWorkspacePackage | null;
};

export type ClientWorkspacePreviewState = {
  active: boolean;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
  previousPackage: ClientWorkspacePackage;
  endingSoon: boolean;
};

export type ClientWorkspaceEntitlementView = {
  enabled: boolean;
  closed: boolean;
  unresolvedLegalEntity: boolean;
  package: ClientWorkspacePackage | null;
  effectivePackage: ClientWorkspacePackage | null;
  tabAccess: Record<ClientWorkspaceNavSection, ClientWorkspaceTabAccess>;
  preview: ClientWorkspacePreviewState | null;
  grandfathered: boolean;
};

export function isClientWorkspacePackage(value: unknown): value is ClientWorkspacePackage {
  return CLIENT_WORKSPACE_PACKAGES.includes(value as ClientWorkspacePackage);
}

export function isClientWorkspaceNavSection(value: unknown): value is ClientWorkspaceNavSection {
  return CLIENT_WORKSPACE_NAV_SECTIONS.includes(value as ClientWorkspaceNavSection);
}

export function navSectionForWorkspaceSection(
  section: ClientWorkspaceSectionId
): ClientWorkspaceNavSection {
  if (section === "quotation" || section === "commercial") return "commercial";
  if (section === "approval") return "approval";
  if (section === "overview") return "overview";
  if (section === "creators") return "creators";
  return "shortlist";
}

export function requestedPackageForLockedSection(
  section: ClientWorkspaceNavSection
): ClientWorkspacePackage {
  if (section === "approval") return "live";
  if (section === "commercial") return "commercial";
  return "planning";
}

export function parseTabOverrides(value: unknown): ClientWorkspaceTabOverrides | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next: ClientWorkspaceTabOverrides = {};
  for (const key of CLIENT_WORKSPACE_NAV_SECTIONS) {
    const access = (value as Record<string, unknown>)[key];
    if (access === "open" || access === "locked") next[key] = access;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function applyTabOverrides(
  base: Record<ClientWorkspaceNavSection, ClientWorkspaceTabAccess>,
  overrides: ClientWorkspaceTabOverrides | null | undefined
): Record<ClientWorkspaceNavSection, ClientWorkspaceTabAccess> {
  if (!overrides) return { ...base };
  return {
    shortlist: overrides.shortlist ?? base.shortlist,
    creators: overrides.creators ?? base.creators,
    commercial: overrides.commercial ?? base.commercial,
    approval: overrides.approval ?? base.approval,
    overview: overrides.overview ?? base.overview,
  };
}

export function previewDaysRemaining(expiresAt: Date, now: Date): number {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function previewExpiresAtFromStart(startedAt: Date): Date {
  return new Date(startedAt.getTime() + LIVE_PERFORMANCE_PREVIEW_MS);
}

export function canStartLivePerformancePreview(input: {
  enabled: boolean;
  package: ClientWorkspacePackage | null;
  previewActive: boolean;
}): boolean {
  if (!input.enabled || input.previewActive) return false;
  return input.package === "planning" || input.package === "commercial";
}

function closedEntitlement(): ClientWorkspaceEntitlementView {
  return {
    enabled: false,
    closed: true,
    unresolvedLegalEntity: false,
    package: null,
    effectivePackage: null,
    tabAccess: PACKAGE_TAB_ACCESS.planning,
    preview: null,
    grandfathered: false,
  };
}

const LOCKED_TAB_ACCESS: Record<ClientWorkspaceNavSection, ClientWorkspaceTabAccess> = {
  shortlist: "locked",
  creators: "locked",
  commercial: "locked",
  approval: "locked",
  overview: "locked",
};

export function unresolvedLegalEntityEntitlement(): ClientWorkspaceEntitlementView {
  return {
    enabled: false,
    closed: true,
    unresolvedLegalEntity: true,
    package: null,
    effectivePackage: null,
    tabAccess: LOCKED_TAB_ACCESS,
    preview: null,
    grandfathered: false,
  };
}

export function clientWorkspaceEntitlementBlock(
  clientId: string | null | undefined,
  entitlement: ClientWorkspaceEntitlementView
): { code: "workspace_unavailable" | "workspace_off"; message: string } | null {
  if (!clientId || entitlement.unresolvedLegalEntity) {
    return { code: "workspace_unavailable", message: CLIENT_WORKSPACE_UNAVAILABLE_MESSAGE };
  }
  if (entitlement.closed) {
    return { code: "workspace_off", message: CLIENT_WORKSPACE_CLOSED_MESSAGE };
  }
  return null;
}

export function entitlementForResolvedLegalEntity(
  clientId: string | null,
  record: ClientWorkspaceEntitlementRecord | null | undefined
): { clientId: string | null; entitlement: ClientWorkspaceEntitlementView } {
  if (!clientId) {
    return { clientId: null, entitlement: unresolvedLegalEntityEntitlement() };
  }
  return { clientId, entitlement: resolveClientWorkspaceEntitlement(record) };
}

export function resolveClientWorkspaceEntitlement(
  row: ClientWorkspaceEntitlementRecord | null | undefined,
  now = new Date()
): ClientWorkspaceEntitlementView {
  if (!row?.enabled) return closedEntitlement();
  const storedPackage = isClientWorkspacePackage(row.package) ? row.package : "planning";
  const preview = resolvePreviewState(row, storedPackage, now);
  const effectivePackage = preview?.active ? "live" : storedPackage;
  return {
    enabled: true,
    closed: false,
    unresolvedLegalEntity: false,
    package: storedPackage,
    effectivePackage,
    tabAccess: applyTabOverrides(PACKAGE_TAB_ACCESS[effectivePackage], row.tabOverrides),
    preview,
    grandfathered: Boolean(row.grandfathered),
  };
}

function resolvePreviewState(
  row: ClientWorkspaceEntitlementRecord,
  storedPackage: ClientWorkspacePackage,
  now: Date
): ClientWorkspacePreviewState | null {
  if (storedPackage === "live") return null;
  if (!row.previewStartedAt || !row.previewExpiresAt) return null;
  const expiresAt = new Date(row.previewExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return null;
  const remaining = previewDaysRemaining(expiresAt, now);
  if (remaining <= 0) return null;
  const previous =
    isClientWorkspacePackage(row.previewPreviousPackage) && row.previewPreviousPackage !== "live"
      ? row.previewPreviousPackage
      : storedPackage;
  return {
    active: true,
    startedAt: row.previewStartedAt,
    expiresAt: row.previewExpiresAt,
    daysRemaining: remaining,
    previousPackage: previous,
    endingSoon: remaining <= LIVE_PERFORMANCE_PREVIEW_ENDING_SOON_DAYS,
  };
}

export function isClientWorkspaceSectionOpen(
  entitlement: ClientWorkspaceEntitlementView | null | undefined,
  section: ClientWorkspaceSectionId
): boolean {
  if (!entitlement || entitlement.closed) return false;
  if (section === "feedback") return true;
  return entitlement.tabAccess[navSectionForWorkspaceSection(section)] === "open";
}

export function emptyClientCommercialSummary(currency = "USD"): ClientCommercialSummary {
  return {
    currency,
    creatorInvestment: 0,
    totalInvestment: 0,
    quotationTotal: 0,
    lines: [],
    selectedCount: 0,
    pricedSelectedCount: 0,
    unpricedSelectedCount: 0,
    totalCount: 0,
  };
}

export function applyEntitlementToView(
  view: ClientWorkspaceView,
  entitlement: ClientWorkspaceEntitlementView
): ClientWorkspaceView {
  const next: ClientWorkspaceView = {
    ...view,
    entitlement,
    visibleSections: [...CLIENT_WORKSPACE_JOURNEY_SECTIONS],
  };
  if (!isClientWorkspaceSectionOpen(entitlement, "approval")) {
    next.campaignExecution = emptyClientCampaignExecution();
    next.campaignContent = emptyClientCampaignContent();
  }
  if (!isClientWorkspaceSectionOpen(entitlement, "commercial")) {
    next.commercial = emptyClientCommercialSummary(view.commercial.currency);
    next.quotation = undefined;
    next.clientEmails = [];
  }
  return next;
}

export function entitlementPanelCopy(section: ClientWorkspaceNavSection): {
  packageName: ClientWorkspacePackage;
  title: string;
  body: string;
} {
  if (section === "commercial") {
    return {
      packageName: "commercial",
      title: CLIENT_WORKSPACE_PACKAGE_LABEL.commercial,
      body: "Investment and quotation for this campaign can be reviewed here when Commercial is enabled.",
    };
  }
  return {
    packageName: "live",
    title: CLIENT_WORKSPACE_PACKAGE_LABEL.live,
    body: "Results for this campaign are ready. Your Thinkway team can enable Live Performance so you can view go-live, content approval, and performance in this workspace.",
  };
}
