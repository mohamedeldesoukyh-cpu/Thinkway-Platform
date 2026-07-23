# DISCOVERY SEARCH — Reference implementation handoff

Generated for Thinkway redesign handoff. **Full sources** for the finished Discovery Search page and the shared patterns to replicate elsewhere (sidebar, filter drawer, bulk-selection bar, row overflow menu, exact-row list).

> Golden reference route: `/discovery/search`  
> Scope: UI chrome + interaction patterns. Business logic helpers (browse actions, AI brief, enrichment polling) are included only where they define visible behavior.

---

## Index

| Area | Key files |
|------|-----------|
| Search route | `app/(dashboard)/discovery/search/page.tsx` |
| Workspace orchestrator | `features/discovery/components/creator-search/creator-search-workspace.tsx` |
| Exact row + headers | `features/discovery/components/discovery-creator-exact-row.tsx` |
| Filter drawer | `discovery-sheet-chrome.tsx`, `discovery-filter-drawer.tsx`, `creator-search-filter-panel.tsx` |
| Bulk selection bar | `discovery-selection-flyout.tsx`, `creator-search-bulk-bar.tsx` |
| Row overflow menu | `discovery-creator-actions-menu.tsx` |
| Sidebar | `components/layout/collapsible-app-sidebar.tsx` |
| CSS (exact-row + drawer + flyout) | `app/thinkway-platform-v6.css` (extract in §11) |
| Discovery Tailwind tokens | `discovery-design-tokens.ts` |
| Product CSS variables | `app/thinkway-design-tokens.css` |

---

## Interaction reference (unambiguous)

### Sidebar — NOT a 2-second hover expand

The **app sidebar does not use a 2-second delay** to expand or collapse.

| Interaction | Delay | Where |
|-------------|-------|-------|
| **Collapsed rail tooltips** (icon-only mode labels) | **300ms** | `components/layout/collapsible-app-sidebar.tsx` — `<TooltipProvider delayDuration={300}>` (~line 472) |
| **Expand / collapse sidebar** | **Immediate click** | Same file — `persistExpanded(true|false)` on PanelLeftOpen / PanelLeftClose buttons |
| **Section group collapse** | **Immediate click** | `toggleGroup(group.label)` on section headers |

Persisted in `localStorage`: `thinkway:sidebar-expanded`, `thinkway:sidebar-collapsed-groups`.

### Creator avatar preview card — delayed hover flyout (NOT sidebar)

When hovering a creator avatar/name in Search exact rows, a **stats preview card** appears after a pointer delay:

| Interaction | Delay | Where |
|-------------|-------|-------|
| **Open preview card** | **1000ms** (1 second) | `creator-avatar-hover-trigger.tsx` — `useDelayedHover(1000)` |
| **Close preview card** | **120ms** grace | `lib/hooks/use-delayed-hover.ts` — `CLOSE_DELAY_MS = 120` |
| **Hook default** (if no arg passed) | **2000ms** | `lib/hooks/use-delayed-hover.ts` — `DEFAULT_DELAY_MS = 2000` |

The **2-second default** lives in `useDelayedHover` but Search passes **1000ms** explicitly. Do not confuse this with sidebar behavior.

---

## Filter drawer — state flow

```text
URL searchParams
    ↕ creatorSearchFiltersFromUrlParams / applyCreatorSearchFiltersToUrlParams
Workspace filters state (CreatorSearchWorkspace)
    ↕ props.filters
CreatorSearchFilterPanel draft (while drawer open)
    → onApply(next) → setFilters(next) → debounced browseUnifiedCreatorsAction (server query)
    → onClearAll() → clearAllFilters() → URL + state reset
```

- **Draft while open**: `CreatorSearchFilterPanel` clones `filters` into `draftFilters`; chip removes and section edits mutate draft only.
- **Apply**: commits draft via `onApply`; workspace updates filters and re-runs server browse (not client-only filter).
- **Client-only filters**: some chips (e.g. brand safety scoring) may additionally filter in `applyCreatorSearchClientFilters` after fetch — see `creator-search-client-filters.ts` (not duplicated here; logic layer).

Drawer host: `DiscoveryFilterSheet` (`discovery-sheet-chrome.tsx`) — controlled by `filtersDrawerOpen` in workspace.

---

## Bulk selection bar — behavior

- Component: `DiscoverySelectionFlyout` — fixed bottom bar, slides up when `selectedCount > 0`.
- Search adapter: `CreatorSearchBulkBar` maps bulk actions (add to list, compare, export, quotation, etc.).
- Content padding: `discoverySelectionFlyoutContentClass(count)` adds bottom padding to the list region so rows are not hidden behind the bar.

---

## Row overflow menu

- Component: `DiscoveryCreatorActionsMenu` — Radix dropdown triggered by ⋯ on each exact row.
- Actions: refresh metrics, open profile, add/remove shortlist, compare, export, etc. (context-dependent props).

---

## Design token drift checklist

These token sources can diverge — check all when theming Discovery UI:

| Token source | Purpose | Drift risk |
|--------------|---------|------------|
| `app/thinkway-design-tokens.css` | Product vars: `--surface`, `--lavender`, `--text-*`, `--tw-border`, status badge bg | Missing `.dark` overrides breaks list pages |
| `app/globals.css` `:root` / `.dark` | Shadcn: `--background`, `--muted`, `--sidebar-*`, `--camp-*` | Overrides `--muted`, `--radius` vs design tokens |
| `discovery-design-tokens.ts` | Tailwind **class strings** for Discovery lists/toolbars | Uses both `var(--text-2)` and `bg-muted/40` |
| `app/thinkway-platform-v6.css` | Scoped `.discovery-search-exact-*`, `.discovery-filter-*`, `.discovery-selection-flyout*` | Hardcoded `#fff`, `#f8fafc` in light rules; `.dark` block at file end |
| `thinkway-platform-v6` aliases | `--tw-surface: var(--surface)` etc. inside `.thinkway-platform-v6` | Platform v6 pages only |

Discovery Search uses **both** shadcn tokens (`bg-background`, `text-muted-foreground`) **and** product vars (`var(--text-2)`, `var(--tw-border)`).

---


---

## 1 — Search route & page shell

Entry route and DiscoveryPageShell wrapper (flush variant for Search).

#### `app/(dashboard)/discovery/search/page.tsx`

```tsx
import { Suspense } from "react";

import { CreatorSearchWorkspace } from "@/features/discovery/components/creator-search/creator-search-workspace";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { loadCampaignIntelligenceWorkspaceAction } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import {
  getCampaignOptionsForShortlist,
  getDiscoveryShortlists,
} from "@/features/discovery/queries";
import { getDiscoverySearchTaxonomy } from "@/lib/discovery/search-taxonomy";

type PageProps = {
  searchParams: Promise<{ profileId?: string }>;
};

export default async function CreatorSearchPage({ searchParams }: PageProps) {
  const { profileId } = await searchParams;
  const [shortlists, campaigns, searchTaxonomy, initialBriefState] = await Promise.all([
    getDiscoveryShortlists(),
    getCampaignOptionsForShortlist(),
    getDiscoverySearchTaxonomy(),
    profileId?.trim()
      ? loadCampaignIntelligenceWorkspaceAction(profileId.trim())
      : Promise.resolve(null),
  ]);

  return (
    <DiscoveryPageShell page="search" variant="flush">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading search…
          </div>
        }
      >
        <CreatorSearchWorkspace
          shortlists={shortlists}
          campaigns={campaigns}
          searchTaxonomy={searchTaxonomy}
          initialBriefState={initialBriefState}
        />
      </Suspense>
    </DiscoveryPageShell>
  );
}
```

#### `features/discovery/components/discovery-page-shell.tsx`

```tsx
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { cn } from "@/lib/utils";

import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
  type DiscoveryPageKey,
} from "./discovery-page-identity";

export type DiscoveryPageShellVariant = "list" | "workspace" | "flush";

type DiscoveryPageShellProps = {
  page: DiscoveryPageKey;
  /** Override Discovery topnav active matching (defaults to page identity href). */
  activeHref?: string;
  /**
   * list — lavender canvas + padded scroll region + optional page header
   * workspace — campaign-surface / muted workspace (detail pages)
   * flush — full-bleed content under the shell topbar (Creator Search)
   */
  variant?: DiscoveryPageShellVariant;
  /** When false, skip DiscoveryPageHeader (e.g. flush workspaces with their own top bar). */
  showHeader?: boolean;
  headerActions?: ReactNode;
  /** Extra chrome above children (e.g. back bar on detail pages). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DiscoveryPageShell({
  page,
  activeHref,
  variant = "list",
  showHeader = variant !== "flush",
  headerActions,
  toolbar,
  children,
  className,
  contentClassName,
}: DiscoveryPageShellProps) {
  const identity = DISCOVERY_PAGE_IDENTITY[page];
  const href = activeHref ?? identity.href;

  return (
    <DashboardShell
      title={identity.title}
      description={identity.description}
      hidePageHeader
      containedMain
      discoveryNavActiveHref={href}
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      headerClassName="h-14 px-4 py-0 md:px-4"
    >
      <PlatformErrorBoundary surface="generic">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            className
          )}
        >
          {toolbar}
          {variant === "flush" ? (
            <div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>
              {children}
            </div>
          ) : variant === "workspace" ? (
            <div
              className={cn(
                "thinkway-campaign-workspace flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[var(--camp-surface)]",
                contentClassName
              )}
              data-campaign-workspace-scroll
            >
              {showHeader ? (
                <div className="space-y-4 p-4 md:p-5">
                  <DiscoveryPageHeader
                    identity={identity}
                    actions={headerActions}
                  />
                  {children}
                </div>
              ) : (
                children
              )}
            </div>
          ) : (
            /* HTML `.content`: page-head sits on lavender canvas; only children are card-bounded. */
            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background",
                contentClassName
              )}
            >
              {showHeader ? (
                <DiscoveryPageHeader
                  identity={identity}
                  actions={headerActions}
                />
              ) : null}
              {children}
            </div>
          )}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
```

#### `features/discovery/components/discovery-page-identity.tsx`

```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRightIcon,
  BrainIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ListChecksIcon,
  RadarIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type DiscoveryPageKey =
  | "search"
  | "compare"
  | "intelligence"
  | "shortlists"
  | "quotations"
  | "campaign-match"
  | "import";

export type DiscoveryPageIdentity = {
  key: DiscoveryPageKey;
  href: string;
  navLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconClass: string;
  /** Solid icon tile (list page headers) — overrides gradient badge when set. */
  iconSolidClass?: string;
};

export const DISCOVERY_PAGE_IDENTITY: Record<DiscoveryPageKey, DiscoveryPageIdentity> = {
  search: {
    key: "search",
    href: "/discovery/search",
    navLabel: "Search",
    title: "Creator Search",
    description: "Browse, filter, and shortlist creators across platforms.",
    icon: SearchIcon,
    accent: "from-sky-400/25 via-sky-300/15 to-blue-500/10",
    iconClass: "text-sky-700 dark:text-sky-300",
    iconSolidClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  compare: {
    key: "compare",
    href: "/discovery/compare",
    navLabel: "Compare",
    title: "Creator Comparison",
    description: "Compare creators side by side across metrics and platforms.",
    icon: ArrowLeftRightIcon,
    accent: "from-indigo-400/25 via-indigo-300/15 to-blue-500/10",
    iconClass: "text-indigo-700 dark:text-indigo-300",
    iconSolidClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  intelligence: {
    key: "intelligence",
    href: "/discovery/intelligence/library",
    navLabel: "Intelligence",
    title: "Campaign Intelligence Library",
    description: "Shared brief intelligence for Discovery, campaigns, Studio, and AI workflows.",
    icon: BrainIcon,
    accent: "from-teal-400/25 via-teal-300/15 to-emerald-500/10",
    iconClass: "text-teal-700 dark:text-teal-300",
    iconSolidClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  },
  shortlists: {
    key: "shortlists",
    href: "/discovery/shortlists",
    navLabel: "Shortlists",
    title: "Shortlists",
    description: "Build, review, approve, and move creators into campaigns.",
    icon: ListChecksIcon,
    accent: "from-violet-400/25 via-violet-300/15 to-purple-500/10",
    iconClass: "text-violet-700 dark:text-violet-300",
    iconSolidClass: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  quotations: {
    key: "quotations",
    href: "/discovery/quotations",
    navLabel: "Client Quotations",
    title: "Client Quotations",
    description: "Serial-numbered quotations (QT-YYYY-NNNN). Totals reported in EGP.",
    icon: FileTextIcon,
    accent: "from-amber-400/25 via-amber-300/15 to-orange-500/10",
    iconClass: "text-amber-800 dark:text-amber-300",
    iconSolidClass:
      "bg-[var(--amber-bg)] text-[var(--amber-text)] dark:bg-amber-950/50 dark:text-amber-300",
  },
  "campaign-match": {
    key: "campaign-match",
    href: "/discovery/campaign-match",
    navLabel: "Campaign Match",
    title: "Campaign Match",
    description: "Match discovered creators to campaign briefs with AI scoring.",
    icon: RadarIcon,
    accent: "from-rose-400/25 via-rose-300/15 to-pink-500/10",
    iconClass: "text-rose-700 dark:text-rose-300",
    iconSolidClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  import: {
    key: "import",
    href: "/discovery/import",
    navLabel: "Import Center",
    title: "Discovery Import Center",
    description: "Upload creator datasets from agencies, platforms, or clients.",
    icon: UploadIcon,
    accent: "from-emerald-400/25 via-emerald-300/15 to-teal-500/10",
    iconClass: "text-emerald-700 dark:text-emerald-300",
    iconSolidClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

export const DISCOVERY_SUB_NAV_PAGES: DiscoveryPageIdentity[] = [
  DISCOVERY_PAGE_IDENTITY.search,
  DISCOVERY_PAGE_IDENTITY.intelligence,
  DISCOVERY_PAGE_IDENTITY.shortlists,
  DISCOVERY_PAGE_IDENTITY.quotations,
  DISCOVERY_PAGE_IDENTITY["campaign-match"],
  DISCOVERY_PAGE_IDENTITY.import,
];

type DiscoveryPageIconBadgeProps = {
  identity: DiscoveryPageIdentity;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const BADGE_SIZE = {
  sm: "size-6 rounded-md [&_svg]:size-3",
  md: "size-[38px] rounded-[10px] [&_svg]:size-[19px]",
  lg: "size-12 rounded-xl [&_svg]:size-6",
} as const;

export function DiscoveryPageIconBadge({
  identity,
  size = "md",
  className,
}: DiscoveryPageIconBadgeProps) {
  const Icon = identity.icon;
  const solid = identity.iconSolidClass;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        solid
          ? cn(solid, BADGE_SIZE[size])
          : cn(
              "border border-white/60 bg-gradient-to-br shadow-sm backdrop-blur-sm",
              "dark:border-white/10",
              identity.accent,
              BADGE_SIZE[size]
            ),
        className
      )}
      aria-hidden
    >
      <Icon className={identity.iconClass} />
    </div>
  );
}

type DiscoveryPageHeaderProps = {
  identity: DiscoveryPageIdentity;
  actions?: ReactNode;
  className?: string;
};

export function DiscoveryPageHeader({
  identity,
  actions,
  className,
}: DiscoveryPageHeaderProps) {
  return (
    <section
      className={cn(
        /* HTML `.page-head`: items-center, gap 16px, margin-bottom via parent space-y-4 */
        "flex flex-wrap items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <DiscoveryPageIconBadge identity={identity} />
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold tracking-[-0.3px] text-[var(--text)] dark:text-foreground">
            {identity.title}
          </h2>
          <p className="mt-px text-xs text-[var(--text-3)]">{identity.description}</p>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </section>
  );
}

/** Spreadsheet accent for import upload sections */
export const DISCOVERY_IMPORT_UPLOAD_IDENTITY: Pick<
  DiscoveryPageIdentity,
  "icon" | "accent" | "iconClass"
> = {
  icon: FileSpreadsheetIcon,
  accent: "from-slate-400/20 via-slate-300/10 to-slate-500/5",
  iconClass: "text-slate-600 dark:text-slate-400",
};
```

#### `app/(dashboard)/layout.tsx`

```tsx
import { Suspense } from "react";

import { DashboardProviders } from "@/components/layout/dashboard-providers";
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { DashboardSidebarAuth } from "@/components/layout/dashboard-sidebar-auth";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardProviders>
      <div className="relative flex min-h-svh bg-background text-foreground">
        <div className="thinkway-platform-shell flex min-h-svh min-w-0 flex-1 overflow-hidden">
          <Suspense
            fallback={<CollapsibleAppSidebar userEmail={null} />}
          >
            <DashboardSidebarAuth />
          </Suspense>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out">
            {children}
          </div>
        </div>
      </div>
    </DashboardProviders>
  );
}
```


---

## 2 — Creator Search workspace (orchestrator)

Main client workspace: filter state, URL sync, server browse queries, selection, drawer open state.

#### `features/discovery/components/creator-search/creator-search-workspace.tsx`

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import { CREATOR_IMPORT_COMPLETED_EVENT } from "@/lib/discovery-import/constants";

import { DiscoveryFilterSheet } from "@/features/discovery/components/design-system";
import { discoverySelectionFlyoutContentClass } from "@/features/discovery/components/design-system/discovery-selection-flyout";
import { cn } from "@/lib/utils";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
import { browseUnifiedCreatorsAction, browseCreatorsByInfluencerIdsAction, getAcquisitionJobsStatusAction } from "@/features/campaigns/creator-discovery-actions";
import { createAcquisitionSessionController } from "./creator-search-acquisition-session";
import type { BrowseInvocationCaller } from "@/lib/discovery/browse-invocation-trace";
import {
  traceAcquisitionPollClient,
  traceBrowseInvocationClient,
} from "@/lib/discovery/browse-invocation-trace";
import {
  refreshCreatorAction,
  refreshCreatorPlatformAction,
  refreshCreatorsBatchAction,
  stopCreatorMetricsRefreshAction,
  stopCreatorsMetricsRefreshBatchAction,
} from "@/features/discovery/enrichment/actions";
import {
  pollCreatorAfterRefresh,
  pollCreatorsAfterBatchRefresh,
} from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  isEnrichmentInProgress,
  syncStatusToEnrichmentStatus,
  resolveCreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import {
  addUnifiedCreatorsToShortlists,
  describeAddOutcome,
  type AddCreatorPlatformSelection,
} from "@/features/discovery/shortlists/add-to-shortlist-client";
import { removeUnifiedCreatorFromShortlists } from "@/features/discovery/shortlists/remove-from-shortlist-client";
import { AddToShortlistDialog } from "@/features/discovery/shortlists/components/add-to-shortlist-dialog";
import {
  needsPlatformAccountSelection,
  SelectPlatformAccountsDialog,
} from "@/features/discovery/shortlists/components/select-platform-accounts-dialog";
import type { ShortlistCampaignOption } from "@/features/discovery/queries";
import { createQuotationFromSelection } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { CREATOR_SEARCH_QUERY_PARAM } from "@/lib/creators/category-filter";
import {
  applyCreatorSearchFiltersToUrlParams,
  creatorSearchFiltersFromUrlParams,
  creatorSearchFiltersUrlEqual,
} from "@/lib/creators/creator-search-url-params";

import { CreateListDialog, type CreatedShortlist } from "./create-list-dialog";
import { CreatorSearchActiveFilters } from "./creator-search-active-filters";
import { clearDiscoverySearchDraft } from "./creator-search-draft-storage";
import { applyCreatorSearchClientFilters, hasClientOnlyCreatorSearchFilters } from "./creator-search-client-filters";
import { CreatorSearchBulkBar } from "./creator-search-bulk-bar";
import { CreatorSearchFilterPanel } from "./creator-search-filter-panel";
import { CreatorSearchResultList } from "./creator-search-result-list";
import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  DEFAULT_CREATOR_SEARCH_SORT,
  cloneCreatorSearchFilters,
  filtersToBrowseParams,
  filtersToRelaxedBrowseParams,
  hasActiveCreatorSearchFilters,
  type CreatorSearchFilters,
  type CreatorSearchSortState,
} from "./creator-search-types";
import {
  normalizeDiscoverySearchQuery,
  resolveCreatorSearchQueryFromCreator,
  upsertCreatorInResults,
} from "@/lib/discovery/creator-search-query";
import { filterExactCreatorMatches } from "./creator-search-exact-match";
import {
  buildCreatorSearchHybridListItems,
  countCreatorSearchHybridResults,
} from "./creator-search-hybrid-sections";
import {
  scoreCreatorSearchIntent,
  simplifyCreatorSearchQuery,
} from "./creator-search-intent-engine";
import type { DiscoverySearchTaxonomy } from "./creator-search-taxonomy";
import {
  createDiscoverySearchAnalyticsTracker,
  type DiscoverySearchAnalyticsTracker,
} from "@/features/discovery/search-analytics";
import { exportCreatorsCsv, sortCreators, stashCompareQueue } from "./creator-search-utils";
import {
  isCampaignRelevanceSearchActive,
  rankCreatorsByCampaignRelevance,
} from "@/lib/discovery/campaign-relevance-scoring";
import { dedupeCreatorsByPlatformHandle } from "@/lib/discovery/creator-result-dedupe";
import { mergeAiCandidatePools } from "@/lib/discovery/ai-candidate-pool";
import { stashDiscoverySelection } from "./discovery-selection-storage";
import {
  useCreatorSelection,
} from "@/features/creators/picker/creator-selection-hooks";
import { CreatorSearchCampaignRequirementsPanel } from "./creator-search-campaign-requirements-panel";
import { CreatorSearchAiCriteriaChips } from "./creator-search-ai-criteria-chips";
import { CreatorSearchAiExtractingState } from "./creator-search-ai-extracting-state";
import { type CreatorSearchRecommendation } from "./creator-search-recommended-section";
import { buildCreatorSearchRecommendations } from "./creator-search-zero-results-recommendations";
import { CampaignBriefSidebar } from "@/features/campaign-intelligence-profile/components/campaign-brief-sidebar";
import { AiSearchStrategySheet } from "@/features/campaign-intelligence-profile/components/ai-search-strategy-sheet";
import type { CampaignIntelligenceWorkspaceState } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import {
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
} from "@/features/campaign-intelligence-profile/services/search-strategy";
import type { CampaignIntelligenceProfile, CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";

const PAGE_SIZE = 50;
/** Max creators loaded for AI campaign scoring before Apify acquisition completes. */
const AI_CAMPAIGN_PAGE_SIZE = 200;
/** Relaxed pool size for zero-results recommendations (manual filter mode). */
const ZERO_RESULTS_RECOMMENDATION_PAGE_SIZE = 200;
const SAVED_SEARCH_KEY = "thinkway:creator-search-saved:v1";

type Props = {
  shortlists: Array<{ id: string; name: string }>;
  campaigns: ShortlistCampaignOption[];
  searchTaxonomy: DiscoverySearchTaxonomy;
  initialBriefState?: CampaignIntelligenceWorkspaceState | null;
};

export function CreatorSearchWorkspace({
  shortlists: initialShortlists,
  campaigns,
  searchTaxonomy,
  initialBriefState = null,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFiltersFromUrl = creatorSearchFiltersFromUrlParams(searchParams);
  const initialSearch = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
  const profileIdFromUrl = searchParams.get("profileId");
  const aiModeFromUrl = searchParams.get("mode") === "ai";
  const [shortlists, setShortlists] = useState(initialShortlists);
  const [filters, setFilters] = useState<CreatorSearchFilters>(() => initialFiltersFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sort, setSort] = useState<CreatorSearchSortState>(DEFAULT_CREATOR_SEARCH_SORT);
  const [page, setPage] = useState(1);
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [acquisitionPolling, setAcquisitionPolling] = useState(false);
  const acquisitionPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acquisitionPollJobRef = useRef<string[]>([]);
  const acquisitionPollRequestRef = useRef(0);
  const acquisitionLastStatusRef = useRef<string | null>(null);
  const acquisitionRefreshedForJobRef = useRef<string | null>(null);
  const acquisitionPollSeqRef = useRef(0);
  const acquisitionSessionRef = useRef(createAcquisitionSessionController());
  const startAcquisitionPollingRef = useRef<
    (jobIds: string[], requestId: number, filtersSnapshot: CreatorSearchFilters) => void
  >(() => {});
  const fetchPageRef = useRef<
    (
      pageNum: number,
      append: boolean,
      filterOverride?: CreatorSearchFilters,
      options?: {
        skipCoverageBackfill?: boolean;
        caller?: BrowseInvocationCaller;
        acquiredOnly?: boolean;
      }
    ) => Promise<void>
  >(async () => {});
  const {
    selectedIds,
    setSelectedIds,
    toggle,
    toggleAllVisible,
  } = useCreatorSelection({ mode: "multi" });
  const [detailCreator, setDetailCreator] = useState<UnifiedCreatorResult | null>(null);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [addToShortlistOpen, setAddToShortlistOpen] = useState(false);
  const [pendingAddCreators, setPendingAddCreators] = useState<UnifiedCreatorResult[]>([]);
  const [pendingPlatformSelections, setPendingPlatformSelections] = useState<
    AddCreatorPlatformSelection[]
  >([]);
  const [platformSelectOpen, setPlatformSelectOpen] = useState(false);
  const [pendingShortlistCreator, setPendingShortlistCreator] = useState<UnifiedCreatorResult | null>(
    null
  );
  /** Session “Added” state: unified_id → shortlist ids they were added to. */
  const [shortlistMembership, setShortlistMembership] = useState<Map<string, string[]>>(
    () => new Map()
  );
  /** Hidden via row X — filtered out of the visible result list. */
  const [hiddenUnifiedIds, setHiddenUnifiedIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const [selectedCreatorMap, setSelectedCreatorMap] = useState<
    Map<string, UnifiedCreatorResult>
  >(() => new Map());
  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const filtersRef = useRef(filters);
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const skipFilterUrlWriteRef = useRef(false);
  const skipSearchUrlWriteRef = useRef(false);
  const pinnedCreatorsRef = useRef<Map<string, UnifiedCreatorResult>>(new Map());
  /** Blocks URL → state sync while a full clear is flushing stale query params. */
  const pendingUrlClearRef = useRef<"search" | "all" | false>(false);
  /** Prevents server-provided brief from re-applying after the user clears everything. */
  const suppressBriefHydrationRef = useRef(false);
  /** Runs AI campaign search once when opening /discovery/search?profileId=… */
  const initialBriefSearchDoneRef = useRef(false);
  const searchRef = useRef(initialSearch);
  const searchStartedAtRef = useRef<number | null>(null);
  const analyticsRef = useRef<DiscoverySearchAnalyticsTracker | null>(null);
  const [activeProfile, setActiveProfile] = useState<CampaignIntelligenceProfile | null>(
    initialBriefState?.profile ?? null
  );
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    profileIdFromUrl ?? initialBriefState?.profileId ?? null
  );
  const [aiCriteria, setAiCriteria] = useState<CampaignSearchCriterion[]>([]);
  const [aiModeActive, setAiModeActive] = useState(aiModeFromUrl);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [strategySheetOpen, setStrategySheetOpen] = useState(false);
  const [briefSidebarOpen, setBriefSidebarOpen] = useState(false);
  const [briefWorkspaceState, setBriefWorkspaceState] = useState(initialBriefState);
  const [briefFileName, setBriefFileName] = useState<string | null>(
    initialBriefState?.fileName ?? null
  );
  const [filterResetKey, setFilterResetKey] = useState(0);
  const aiModeRef = useRef(aiModeActive);
  const aiCriteriaRef = useRef(aiCriteria);
  const skipNextFilterFetchRef = useRef(false);
  /** Influencer IDs imported in the current AI acquisition session (Apify-only result set). */
  const sessionAcquiredInfluencerIdsRef = useRef<string[]>([]);
  aiModeRef.current = aiModeActive;
  aiCriteriaRef.current = aiCriteria;
  const [apifySourceUnifiedIds, setApifySourceUnifiedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [recommendedCreators, setRecommendedCreators] = useState<CreatorSearchRecommendation[]>(
    []
  );
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const recommendationReqRef = useRef(0);

  useEffect(() => {
    const pending = pendingUrlClearRef.current;
    if (!pending) return;

    if (pending === "all") {
      if (searchParams.toString() === "") {
        pendingUrlClearRef.current = false;
      }
      return;
    }

    const queryParam = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
    if (!searchParams.has(CREATOR_SEARCH_QUERY_PARAM) || !queryParam) {
      pendingUrlClearRef.current = false;
    }
  }, [searchParams]);

  filtersRef.current = filters;
  searchRef.current = debouncedSearch;

  const filtersFromUrl = useMemo(
    () => creatorSearchFiltersFromUrlParams(searchParams),
    [searchParams]
  );
  const searchFromUrl = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";

  // URL → search (back/forward, refresh)
  useEffect(() => {
    if (pendingUrlClearRef.current) return;
    setDebouncedSearch((prev) => (prev === searchFromUrl ? prev : searchFromUrl));
    skipSearchUrlWriteRef.current = true;
  }, [searchFromUrl]);

  // URL → filters (chip links, back/forward). Skip the next filters → URL pass when applied.
  useEffect(() => {
    if (pendingUrlClearRef.current) return;
    setFilters((prev) => {
      if (creatorSearchFiltersUrlEqual(prev, filtersFromUrl)) return prev;
      skipFilterUrlWriteRef.current = true;
      return cloneCreatorSearchFilters(filtersFromUrl);
    });
  }, [filtersFromUrl]);

  // filters → URL (filter bar / clear). Only react to filter changes, not URL updates.
  useEffect(() => {
    if (pendingUrlClearRef.current === "all") return;
    if (skipFilterUrlWriteRef.current) {
      skipFilterUrlWriteRef.current = false;
      return;
    }

    const urlFilters = creatorSearchFiltersFromUrlParams(searchParams);
    if (creatorSearchFiltersUrlEqual(filters, urlFilters)) return;

    const params = new URLSearchParams(searchParams.toString());
    applyCreatorSearchFiltersToUrlParams(params, filters);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) return;

    router.replace(nextUrl, { scroll: false });
    // searchParams read for merge/compare only; URL → filters handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid replace loop on navigation
  }, [filters, pathname, router]);

  // search → URL (debounced live sync)
  useEffect(() => {
    if (skipSearchUrlWriteRef.current) {
      skipSearchUrlWriteRef.current = false;
      return;
    }

    const urlSearch = searchParams.get(CREATOR_SEARCH_QUERY_PARAM)?.trim() ?? "";
    if (debouncedSearch === urlSearch) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set(CREATOR_SEARCH_QUERY_PARAM, debouncedSearch);
    } else {
      params.delete(CREATOR_SEARCH_QUERY_PARAM);
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl === currentUrl) return;

    router.replace(nextUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid replace loop on navigation
  }, [debouncedSearch, pathname, router]);

  const handleDebouncedSearchChange = useCallback((value: string) => {
    setDebouncedSearch((prev) => (prev === value ? prev : value));
  }, []);

  const selectedCreators = useMemo(
    () => [...selectedCreatorMap.values()],
    [selectedCreatorMap]
  );

  function clearCreatorSelection() {
    setSelectedIds(new Set());
    setSelectedCreatorMap(new Map());
  }

  function syncPendingCreators(nextCreators: UnifiedCreatorResult[]) {
    setPendingAddCreators(nextCreators);
    setPendingPlatformSelections((prev) =>
      prev.filter((entry) => nextCreators.some((c) => c.unified_id === entry.creator.unified_id))
    );
    const nextIds = new Set(nextCreators.map((creator) => creator.unified_id));
    setSelectedIds(nextIds);
    setSelectedCreatorMap(new Map(nextCreators.map((creator) => [creator.unified_id, creator])));
  }

  useEffect(() => {
    stashDiscoverySelection(selectedCreators);
  }, [selectedCreators]);

  const searchIntent = useMemo(
    () => scoreCreatorSearchIntent(debouncedSearch, searchTaxonomy),
    [debouncedSearch, searchTaxonomy]
  );
  const isExactCreatorSearch = searchIntent.mode === "exact";
  const isHybridCreatorSearch = searchIntent.mode === "hybrid";

  const showCampaignRelevance = useMemo(
    () => isCampaignRelevanceSearchActive(aiModeActive, aiCriteria),
    [aiModeActive, aiCriteria]
  );

  useEffect(() => {
    if (!showCampaignRelevance && sort.field === "relevance") {
      setSort({ field: "followers", direction: "desc" });
    }
  }, [showCampaignRelevance, sort.field]);

  const sortedCreators = useMemo(() => sortCreators(creators, sort), [creators, sort]);
  const exactMatches = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    if (searchIntent.mode === "discovery") return [];
    return filterExactCreatorMatches(sortedCreators, debouncedSearch);
  }, [debouncedSearch, searchIntent.mode, sortedCreators]);

  const displayCreators = useMemo(() => {
    const base =
      !debouncedSearch.trim() || searchIntent.mode === "discovery"
        ? sortedCreators
        : isExactCreatorSearch
          ? exactMatches
          : sortedCreators;
    if (hiddenUnifiedIds.size === 0) return base;
    return base.filter((creator) => !hiddenUnifiedIds.has(creator.unified_id));
  }, [
    debouncedSearch,
    exactMatches,
    hiddenUnifiedIds,
    isExactCreatorSearch,
    searchIntent.mode,
    sortedCreators,
  ]);

  const shortlistedIds = useMemo(
    () => new Set(shortlistMembership.keys()),
    [shortlistMembership]
  );

  const hybridListItems = useMemo(() => {
    if (!isHybridCreatorSearch || !debouncedSearch.trim()) return undefined;
    const visibleExact =
      hiddenUnifiedIds.size === 0
        ? exactMatches
        : exactMatches.filter((c) => !hiddenUnifiedIds.has(c.unified_id));
    const visibleAll =
      hiddenUnifiedIds.size === 0
        ? sortedCreators
        : sortedCreators.filter((c) => !hiddenUnifiedIds.has(c.unified_id));
    return buildCreatorSearchHybridListItems({
      exactMatches: visibleExact,
      allCreators: visibleAll,
    });
  }, [
    debouncedSearch,
    exactMatches,
    hiddenUnifiedIds,
    isHybridCreatorSearch,
    sortedCreators,
  ]);

  const resultCount = useMemo(() => {
    if (hybridListItems) return countCreatorSearchHybridResults(hybridListItems);
    return displayCreators.length;
  }, [displayCreators.length, hybridListItems]);

  const exactCreatorZeroMatch =
    isExactCreatorSearch &&
    !loading &&
    debouncedSearch.trim().length > 0 &&
    exactMatches.length === 0;

  const showZeroResultsRecommendations =
    !aiModeActive &&
    !loading &&
    !acquisitionPolling &&
    displayCreators.length === 0 &&
    hasActiveCreatorSearchFilters(filters, debouncedSearch);

  const visibleRecommendations = useMemo(() => {
    if (!showZeroResultsRecommendations) return [];
    if (hiddenUnifiedIds.size === 0) return recommendedCreators;
    return recommendedCreators.filter(
      (entry) => !hiddenUnifiedIds.has(entry.creator.unified_id)
    );
  }, [hiddenUnifiedIds, recommendedCreators, showZeroResultsRecommendations]);
  const canSimplifyExactQuery = useMemo(() => {
    const simplified = simplifyCreatorSearchQuery(debouncedSearch);
    return simplified.length > 0 && simplified !== debouncedSearch.trim();
  }, [debouncedSearch]);

  const visibleCreatorIds = useMemo(
    () => displayCreators.map((c) => c.unified_id),
    [displayCreators]
  );
  const inFlightCreators = useMemo(
    () =>
      sortedCreators.filter((creator) =>
        isEnrichmentInProgress(resolveCreatorEnrichmentStatus(creator.enrichment_status))
      ),
    [sortedCreators]
  );
  const selectedInFlightCreators = useMemo(
    () =>
      selectedCreators.filter((creator) =>
        isEnrichmentInProgress(resolveCreatorEnrichmentStatus(creator.enrichment_status))
      ),
    [selectedCreators]
  );

  const stopAcquisitionPolling = useCallback(() => {
    if (acquisitionPollRef.current) {
      clearTimeout(acquisitionPollRef.current);
      acquisitionPollRef.current = null;
    }
    acquisitionPollJobRef.current = [];
    acquisitionPollRequestRef.current = 0;
    acquisitionLastStatusRef.current = null;
    setAcquisitionPolling(false);
  }, []);

  const cancelActiveAcquisitionSession = useCallback(async () => {
    stopAcquisitionPolling();
    acquisitionSessionRef.current.stopHeartbeat();
    await acquisitionSessionRef.current.cancelSession();
  }, [stopAcquisitionPolling]);

  const handleClearSearch = useCallback(() => {
    pendingUrlClearRef.current = "search";
    searchRef.current = "";
    skipSearchUrlWriteRef.current = true;
    setDebouncedSearch("");
    clearDiscoverySearchDraft();

    abortRef.current?.abort();
    reqIdRef.current += 1;
    void cancelActiveAcquisitionSession();
    acquisitionRefreshedForJobRef.current = null;
    pinnedCreatorsRef.current.clear();
    setBackfillStatus(null);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has(CREATOR_SEARCH_QUERY_PARAM)) return;
    params.delete(CREATOR_SEARCH_QUERY_PARAM);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [cancelActiveAcquisitionSession, pathname, router, searchParams]);

  const startAcquisitionPolling = useCallback(
    (jobIds: string[], requestId: number, filtersSnapshot: CreatorSearchFilters) => {
      const uniqueJobIds = [...new Set(jobIds.map((id) => id.trim()).filter(Boolean))];
      if (uniqueJobIds.length === 0) return;

      stopAcquisitionPolling();
      acquisitionPollJobRef.current = uniqueJobIds;
      acquisitionPollRequestRef.current = requestId;
      acquisitionLastStatusRef.current = null;
      acquisitionRefreshedForJobRef.current = null;
      acquisitionPollSeqRef.current = 0;
      setAcquisitionPolling(true);
      setBackfillStatus(
        uniqueJobIds.length > 1
          ? "Acquiring creators (Instagram, TikTok)..."
          : "Acquiring creators..."
      );

      const pollKey = uniqueJobIds.join(",");

      const tick = async () => {
        if (
          acquisitionPollJobRef.current.join(",") !== pollKey ||
          acquisitionPollRequestRef.current !== requestId ||
          reqIdRef.current !== requestId
        ) {
          return;
        }

        const pollSeq = ++acquisitionPollSeqRef.current;

        try {
          const jobStatus = await getAcquisitionJobsStatusAction(uniqueJobIds);
          if (
            acquisitionPollJobRef.current.join(",") !== pollKey ||
            acquisitionPollRequestRef.current !== requestId ||
            reqIdRef.current !== requestId
          ) {
            return;
          }

          traceAcquisitionPollClient({
            jobId: pollKey,
            pollSeq,
            status: jobStatus?.status ?? null,
            completed: jobStatus?.completed ?? false,
            failed: jobStatus?.failed ?? false,
          });

          if (!jobStatus) {
            acquisitionPollRef.current = setTimeout(tick, 2_500);
            return;
          }

          const previousStatus = acquisitionLastStatusRef.current;
          acquisitionLastStatusRef.current = jobStatus.status;

          if (jobStatus.failed) {
            stopAcquisitionPolling();
            setBackfillStatus(
              jobStatus.cancelled
                ? "Search cancelled."
                : jobStatus.errorMessage ?? "Creator acquisition failed. Try broadening your filters."
            );
            return;
          }

          if (jobStatus.cancelled) {
            stopAcquisitionPolling();
            setBackfillStatus("Search cancelled.");
            return;
          }

          if (jobStatus.completed) {
            if (acquisitionPollRef.current) {
              clearTimeout(acquisitionPollRef.current);
              acquisitionPollRef.current = null;
            }
            acquisitionPollJobRef.current = [];
            setAcquisitionPolling(false);

            const transitionedToCompleted = previousStatus !== "completed";
            const alreadyRefreshed = acquisitionRefreshedForJobRef.current === pollKey;

            if (transitionedToCompleted && !alreadyRefreshed) {
              acquisitionRefreshedForJobRef.current = pollKey;
              sessionAcquiredInfluencerIdsRef.current = jobStatus.importedInfluencerIds;
              setBackfillStatus(
                jobStatus.profilesAdded > 0
                  ? `Added ${jobStatus.profilesAdded} Apify creator${jobStatus.profilesAdded === 1 ? "" : "s"}. Refreshing results…`
                  : "Acquisition complete. Refreshing results…"
              );
              void fetchPageRef.current(1, false, filtersSnapshot, {
                skipCoverageBackfill: true,
                caller: "poll_completion_refresh",
                acquiredOnly: true,
              });
            }
            return;
          }

          const nextStatusMessage =
            jobStatus.status === "running"
              ? uniqueJobIds.length > 1
                ? "Acquiring creators (Instagram, TikTok)..."
                : "Acquiring creators..."
              : "Queued for acquisition...";
          setBackfillStatus((current) =>
            current === nextStatusMessage ? current : nextStatusMessage
          );
          acquisitionPollRef.current = setTimeout(tick, 2_500);
        } catch {
          if (
            acquisitionPollJobRef.current.join(",") === pollKey &&
            acquisitionPollRequestRef.current === requestId
          ) {
            acquisitionPollRef.current = setTimeout(tick, 4_000);
          }
        }
      };

      void tick();
    },
    [stopAcquisitionPolling]
  );

  startAcquisitionPollingRef.current = startAcquisitionPolling;

  const fetchZeroResultRecommendations = useCallback(
    async (filtersSnapshot: CreatorSearchFilters, requestId: number) => {
      const recRequestId = ++recommendationReqRef.current;
      setLoadingRecommendations(true);
      setRecommendedCreators([]);

      try {
        const relaxed = await browseUnifiedCreatorsAction(
          {
            ...filtersToRelaxedBrowseParams(
              filtersSnapshot,
              1,
              ZERO_RESULTS_RECOMMENDATION_PAGE_SIZE
            ),
            searchSessionId: acquisitionSessionRef.current.getSessionId(),
            skipCoverageBackfill: true,
          },
          {
            caller: "zero_results_recommendations",
            requestId,
            acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
          }
        );

        if (
          recRequestId !== recommendationReqRef.current ||
          requestId !== reqIdRef.current
        ) {
          return;
        }

        const recommendations = buildCreatorSearchRecommendations(
          relaxed.creators,
          filtersSnapshot
        );
        setRecommendedCreators(recommendations);
      } catch {
        if (recRequestId !== recommendationReqRef.current) return;
        setRecommendedCreators([]);
      } finally {
        if (recRequestId === recommendationReqRef.current) {
          setLoadingRecommendations(false);
        }
      }
    },
    []
  );

  const fetchPage = useCallback(async (
    pageNum: number,
    append: boolean,
    filterOverride?: CreatorSearchFilters,
    options?: {
      skipCoverageBackfill?: boolean;
      caller?: BrowseInvocationCaller;
      acquiredOnly?: boolean;
    }
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++reqIdRef.current;
    if (!append && !options?.skipCoverageBackfill) {
      stopAcquisitionPolling();
      acquisitionSessionRef.current.stopHeartbeat();
      await acquisitionSessionRef.current.rotateSession();
      acquisitionSessionRef.current.startHeartbeat();
    }
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      searchStartedAtRef.current = performance.now();
    }
    setError(null);
    if (!append && !options?.skipCoverageBackfill) {
      setBackfillStatus(null);
    }

    const queryAtFetch = filterOverride ? "" : searchRef.current;
    const intentAtFetch = scoreCreatorSearchIntent(queryAtFetch, searchTaxonomy);

    const caller = options?.caller ?? "unknown";
    traceBrowseInvocationClient(
      {
        caller,
        requestId,
        acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
      },
      { pageNum, append, skipCoverageBackfill: options?.skipCoverageBackfill ?? false }
    );

    try {
      if (controller.signal.aborted) return;

      const mergedFilters: CreatorSearchFilters = filterOverride ?? {
        ...filtersRef.current,
        search: queryAtFetch,
      };
      const useAiRelevance = isCampaignRelevanceSearchActive(
        aiModeRef.current,
        aiCriteriaRef.current
      );
      const acquiredSession = sessionAcquiredInfluencerIdsRef.current;
      const showAcquiredOnly =
        Boolean(options?.acquiredOnly) || (useAiRelevance && acquiredSession.length > 0);

      if (useAiRelevance && append) {
        return;
      }

      let result: Awaited<ReturnType<typeof browseUnifiedCreatorsAction>>;
      let pool: UnifiedCreatorResult[] = [];

      if (showAcquiredOnly && acquiredSession.length > 0) {
        pool = await browseCreatorsByInfluencerIdsAction(acquiredSession);
        if (controller.signal.aborted || requestId !== reqIdRef.current) return;
        setApifySourceUnifiedIds(new Set(pool.map((creator) => creator.unified_id)));
        result = {
          creators: pool,
          total: pool.length,
          has_more: false,
          page: 1,
          pageSize: pool.length,
          internal_count: pool.length,
          discovery_count: 0,
        };
      } else if (useAiRelevance) {
        setApifySourceUnifiedIds(new Set());
        // Dual-pool fetch: the relaxed pool (platform-only SQL filter) is ordered by
        // thinkway_score, so on-brief creators outside its single page never reach the
        // ranker. The strict pool applies the brief's real filters in SQL, guaranteeing
        // on-brief creators enter the candidate pool regardless of enrichment rank.
        const sessionId = acquisitionSessionRef.current.getSessionId();
        const invocation = {
          caller,
          requestId,
          acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
        };
        const [strictSettled, relaxedSettled] = await Promise.allSettled([
          browseUnifiedCreatorsAction(
            {
              ...filtersToBrowseParams(mergedFilters, pageNum, AI_CAMPAIGN_PAGE_SIZE),
              searchSessionId: sessionId,
              skipCoverageBackfill: true,
            },
            invocation
          ),
          browseUnifiedCreatorsAction(
            {
              ...filtersToRelaxedBrowseParams(mergedFilters, pageNum, AI_CAMPAIGN_PAGE_SIZE),
              searchSessionId: sessionId,
              skipCoverageBackfill: true,
            },
            invocation
          ),
        ]);
        if (controller.signal.aborted || requestId !== reqIdRef.current) return;
        if (strictSettled.status === "rejected" && relaxedSettled.status === "rejected") {
          throw relaxedSettled.reason;
        }
        const strictCreators =
          strictSettled.status === "fulfilled" ? strictSettled.value.creators : [];
        const baseResult =
          relaxedSettled.status === "fulfilled"
            ? relaxedSettled.value
            : (strictSettled as PromiseFulfilledResult<
                Awaited<ReturnType<typeof browseUnifiedCreatorsAction>>
              >).value;
        pool = mergeAiCandidatePools(strictCreators, baseResult.creators);
        result = {
          ...baseResult,
          creators: pool,
          total: pool.length,
          has_more: false,
        };
      } else {
        setApifySourceUnifiedIds(new Set());
        result = await browseUnifiedCreatorsAction(
          {
            ...filtersToBrowseParams(mergedFilters, pageNum, PAGE_SIZE),
            searchSessionId: acquisitionSessionRef.current.getSessionId(),
            ...(options?.skipCoverageBackfill ? { skipCoverageBackfill: true } : {}),
          },
          {
            caller,
            requestId,
            acquisitionJobId: acquisitionPollJobRef.current[0] ?? null,
          }
        );
        if (controller.signal.aborted || requestId !== reqIdRef.current) return;
        pool = result.creators;
      }

      let filtered = useAiRelevance
        ? rankCreatorsByCampaignRelevance(pool, aiCriteriaRef.current, { minScore: 30 })
        : applyCreatorSearchClientFilters(pool, mergedFilters);
      filtered = dedupeCreatorsByPlatformHandle(filtered);
      for (const creator of filtered) {
        pinnedCreatorsRef.current.delete(creator.unified_id);
      }
      for (const pinned of pinnedCreatorsRef.current.values()) {
        filtered = upsertCreatorInResults(filtered, pinned).creators;
      }

      const latencyMs =
        searchStartedAtRef.current != null
          ? Math.round(performance.now() - searchStartedAtRef.current)
          : 0;

      startTransition(() => {
        const clientOnlyActive =
          !useAiRelevance && hasClientOnlyCreatorSearchFilters(mergedFilters);
        const displayTotal =
          filtered.length === 0
            ? 0
            : useAiRelevance
              ? filtered.length
              : clientOnlyActive && filtered.length < result.creators.length
                ? filtered.length
                : result.total;
        setTotal(displayTotal);
        setCreators((prev) => {
          const next = append ? [...prev, ...filtered] : filtered;
          const unique = new Map(next.map((c) => [c.unified_id, c]));
          return [...unique.values()];
        });
        setHasMore(
          useAiRelevance || showAcquiredOnly
            ? false
            : (result.has_more ?? pageNum * PAGE_SIZE < result.total)
        );

        const backfill = result.backfill;
        if (!append && backfill && !useAiRelevance) {
          if (
            backfill.acquisitionStarted &&
            (backfill.acquisitionJobIds?.length || backfill.acquisitionJobId) &&
            !options?.skipCoverageBackfill
          ) {
            startAcquisitionPollingRef.current(
              backfill.acquisitionJobIds ??
                (backfill.acquisitionJobId ? [backfill.acquisitionJobId] : []),
              requestId,
              mergedFilters
            );
            acquisitionSessionRef.current.startHeartbeat();
          } else if (backfill.completed && (backfill.profilesAdded ?? 0) > 0) {
            setBackfillStatus(
              `Added ${backfill.profilesAdded} creator${backfill.profilesAdded === 1 ? "" : "s"} from external discovery.`
            );
          } else if (backfill.apifyExecuted === false && filtered.length === 0) {
            setBackfillStatus(backfill.reason);
          } else if (
            filtered.length === 0 &&
            backfill.reason &&
            !backfill.acquisitionStarted
          ) {
            setBackfillStatus(backfill.reason);
          }
        }
      });

      if (
        !append &&
        !useAiRelevance &&
        filtered.length === 0 &&
        hasActiveCreatorSearchFilters(mergedFilters, queryAtFetch)
      ) {
        void fetchZeroResultRecommendations(mergedFilters, requestId);
      } else if (!append) {
        recommendationReqRef.current += 1;
        startTransition(() => {
          setRecommendedCreators([]);
          setLoadingRecommendations(false);
        });
      }

      if (!append && queryAtFetch.trim()) {
        const exactOnly =
          intentAtFetch.mode === "exact"
            ? filterExactCreatorMatches(filtered, queryAtFetch)
            : [];
        const resultsCount =
          intentAtFetch.mode === "exact"
            ? exactOnly.length
            : filtered.length;

        analyticsRef.current?.trackSearchExecuted({
          query: queryAtFetch,
          intentMode: intentAtFetch.mode,
          confidence: intentAtFetch.confidence,
          resultsCount,
          latencyMs,
        });
      }
    } catch (err) {
      if (controller.signal.aborted || requestId !== reqIdRef.current) return;
      const message = err instanceof Error ? err.message : "Search failed";
      startTransition(() => {
        if (!append) setError(message);
      });
      toast.error(message);
    } finally {
      if (controller.signal.aborted || requestId !== reqIdRef.current) return;
      startTransition(() => {
        setLoading(false);
        setLoadingMore(false);
      });
    }
  }, [searchTaxonomy, startTransition, stopAcquisitionPolling, fetchZeroResultRecommendations]);

  fetchPageRef.current = fetchPage;

  useEffect(() => {
    acquisitionSessionRef.current.startHeartbeat();
    const session = acquisitionSessionRef.current;

    const onBeforeUnload = () => {
      session.dispose();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void session.cancelSession();
      session.stopHeartbeat();
    };
  }, []);

  const headerTotal = useMemo(() => {
    if (displayCreators.length === 0 && (acquisitionPolling || (!loading && !loadingMore))) {
      return 0;
    }
    return isExactCreatorSearch ? resultCount : total;
  }, [
    acquisitionPolling,
    displayCreators.length,
    isExactCreatorSearch,
    loading,
    loadingMore,
    resultCount,
    total,
  ]);

  useEffect(() => {
    analyticsRef.current = createDiscoverySearchAnalyticsTracker();
    return () => {
      stopAcquisitionPolling();
      analyticsRef.current?.dispose();
      analyticsRef.current = null;
    };
  }, [stopAcquisitionPolling]);

  useEffect(() => {
    analyticsRef.current?.trackQueryCleared(debouncedSearch);
  }, [debouncedSearch]);

  const runSearch = useCallback(
    (immediateQuery?: string) => {
      if (loading) return;
      if (typeof immediateQuery === "string") {
        const normalizedQuery = normalizeDiscoverySearchQuery(immediateQuery);
        searchRef.current = normalizedQuery;
        setDebouncedSearch(normalizedQuery);
      }
      setPage(1);
      setHasMore(true);
      clearCreatorSelection();
      void fetchPageRef.current(1, false, undefined, { caller: "explicit_run_search" });
    },
    [loading]
  );

  useEffect(() => {
    if (skipNextFilterFetchRef.current) {
      skipNextFilterFetchRef.current = false;
      return;
    }
    setPage(1);
    setHasMore(true);
    void fetchPageRef.current(1, false, undefined, { caller: "filter_sync" });
  }, [filters, debouncedSearch]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (page <= 1 || aiModeActive) return;
    void fetchPageRef.current(page, true, undefined, { caller: "pagination" });
  }, [page, aiModeActive]);

  // Refetch when an import completes (same tab or another tab via localStorage).
  useEffect(() => {
    function refreshAfterImport() {
      setPage(1);
      void fetchPageRef.current(1, false, undefined, { caller: "import_refresh" });
    }

    function onStorage(event: StorageEvent) {
      if (event.key === CREATOR_IMPORT_COMPLETED_EVENT) refreshAfterImport();
    }

    window.addEventListener(CREATOR_IMPORT_COMPLETED_EVENT, refreshAfterImport);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CREATOR_IMPORT_COMPLETED_EVENT, refreshAfterImport);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadMoreObserver.current) loadMoreObserver.current.disconnect();
      if (!node) return;
      loadMoreObserver.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
            setPage((p) => p + 1);
          }
        },
        { rootMargin: "240px" }
      );
      loadMoreObserver.current.observe(node);
    },
    [hasMore, loading, loadingMore]
  );

  const handleToggleSelect = useCallback((creator: UnifiedCreatorResult) => {
    toggle(creator.unified_id);
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      if (next.has(creator.unified_id)) next.delete(creator.unified_id);
      else next.set(creator.unified_id, creator);
      return next;
    });
  }, [toggle]);

  const handleToggleSelectAll = useCallback(() => {
    const allSelected =
      visibleCreatorIds.length > 0 && visibleCreatorIds.every((id) => selectedIds.has(id));
    toggleAllVisible(visibleCreatorIds);
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        for (const id of visibleCreatorIds) next.delete(id);
      } else {
        for (const creator of displayCreators) {
          if (visibleCreatorIds.includes(creator.unified_id)) {
            next.set(creator.unified_id, creator);
          }
        }
      }
      return next;
    });
  }, [displayCreators, selectedIds, toggleAllVisible, visibleCreatorIds]);

  function openAddToShortlistModal(
    targets: UnifiedCreatorResult[],
    selections: AddCreatorPlatformSelection[] = []
  ) {
    if (targets.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    setPendingAddCreators(targets);
    setPendingPlatformSelections(selections);
    setAddToShortlistOpen(true);
  }

  function addCreatorsToLists(
    shortlistIds: string[],
    targets: UnifiedCreatorResult[],
    selections: AddCreatorPlatformSelection[] = []
  ) {
    if (shortlistIds.length === 0) {
      toast.error("Select at least one shortlist.");
      return;
    }
    if (targets.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlists(shortlistIds, targets, selections);
        if (outcome.added > 0 || outcome.alreadyOnList > 0) {
          setShortlistMembership((prev) => {
            const next = new Map(prev);
            for (const creator of targets) {
              const existing = next.get(creator.unified_id) ?? [];
              next.set(creator.unified_id, [...new Set([...existing, ...shortlistIds])]);
            }
            return next;
          });
        }
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add to list");
        } else if (outcome.ineligible > 0 && outcome.alreadyOnList === 0) {
          toast.error("Selected creators cannot be added to discovery lists.");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
        setAddToShortlistOpen(false);
        setPendingAddCreators([]);
        setPendingPlatformSelections([]);
        clearCreatorSelection();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add to list");
      }
    });
  }

  const handleToggleShortlist = useCallback(
    (creator: UnifiedCreatorResult) => {
      const membership = shortlistMembership.get(creator.unified_id);
      if (membership && membership.length > 0) {
        startTransition(async () => {
          try {
            const outcome = await removeUnifiedCreatorFromShortlists(membership, {
              unified_id: creator.unified_id,
              influencer_id: creator.influencer_id,
              discovered_profile_id: creator.discovered_profile_id,
            });
            setShortlistMembership((prev) => {
              const next = new Map(prev);
              next.delete(creator.unified_id);
              return next;
            });
            if (outcome.removed > 0) {
              toast.success("Removed from shortlist");
            } else if (outcome.firstError) {
              toast.error(outcome.firstError);
            } else {
              toast.info("Removed from shortlist");
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to remove from shortlist");
          }
        });
        return;
      }

      if (needsPlatformAccountSelection(creator)) {
        setPendingShortlistCreator(creator);
        setPlatformSelectOpen(true);
        return;
      }
      openAddToShortlistModal([creator]);
    },
    // openAddToShortlistModal is a stable function declaration in this component body
    [shortlistMembership]
  );

  const handleRejectCreator = useCallback((creator: UnifiedCreatorResult) => {
    setHiddenUnifiedIds((prev) => {
      const next = new Set(prev);
      next.add(creator.unified_id);
      return next;
    });
    setSelectedIds((prev) => {
      if (!prev.has(creator.unified_id)) return prev;
      const next = new Set(prev);
      next.delete(creator.unified_id);
      return next;
    });
  }, [setSelectedIds]);

  const handleAddCreatorToList = useCallback((creator: UnifiedCreatorResult) => {
    handleToggleShortlist(creator);
  }, [handleToggleShortlist]);

  function handleConfirmPlatformAccounts(platformAccountIds: string[]) {
    if (!pendingShortlistCreator) return;
    openAddToShortlistModal(
      [pendingShortlistCreator],
      [{ creator: pendingShortlistCreator, platformAccountIds }]
    );
    setPendingShortlistCreator(null);
  }

  function handleBulkAddToList() {
    if (selectedCreators.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    openAddToShortlistModal(selectedCreators);
  }

  function handleAddToShortlistConfirm({ shortlistIds }: { shortlistIds: string[] }) {
    addCreatorsToLists(shortlistIds, pendingAddCreators, pendingPlatformSelections);
  }

  function handleListCreated(created: CreatedShortlist) {
    setShortlists((prev) =>
      prev.some((s) => s.id === created.id) ? prev : [{ id: created.id, name: created.name }, ...prev]
    );
  }

  function handleBulkCompare() {
    if (selectedCreators.length < 2) {
      toast.error("Select at least 2 creators to compare");
      return;
    }
    if (selectedCreators.length > MAX_CREATOR_COMPARE) {
      toast.error(`Compare up to ${MAX_CREATOR_COMPARE} creators at a time`);
      return;
    }
    stashCompareQueue(selectedCreators);
    router.push("/discovery/compare");
  }

  function handleBulkExport() {
    if (selectedCreators.length === 0) return;
    const csv = exportCreatorsCsv(selectedCreators);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thinkway-creator-search-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCreators.length} creators`);
  }

  async function handleBulkShare() {
    if (selectedCreators.length === 0) return;
    const lines = selectedCreators.map((c) => {
      const p = c.platforms[0];
      return `${c.display_name} (${p?.handle ?? "—"}) ${resolveCreatorProfileUrl(p) ?? ""}`.trim();
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Creator summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function handleGenerateQuotation() {
    if (selectedCreators.length === 0) {
      toast.error("Select creators to quote");
      return;
    }
    startTransition(async () => {
      const res = await createQuotationFromSelection({
        creators: selectedCreators.map((c) => {
          const p = c.platforms[0];
          return {
            influencer_id: c.influencer_id,
            profile_id: c.discovered_profile_id,
            unified_id: c.unified_id,
            creator_name: c.display_name,
            platform: p?.platform ?? null,
            handle: p?.handle ?? null,
            followers: c.metrics.followers.value ?? p?.follower_count ?? null,
            engagement_rate: c.metrics.engagement_rate.value ?? p?.engagement_rate ?? null,
            country_code: c.country_code ?? c.estimated_country ?? null,
            cost_currency: c.suggested_currency ?? "EGP",
          };
        }),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Quotation created.");
      if (res.data?.id) router.push(quotationDetailPath(res.data.id));
    });
  }

  function syncDiscoverySearchQuery(query: string) {
    const normalized = normalizeDiscoverySearchQuery(query);
    if (!normalized || searchRef.current === normalized) return;
    searchRef.current = normalized;
    setDebouncedSearch(normalized);
  }

  function upsertCreatorInList(next: UnifiedCreatorResult) {
    pinnedCreatorsRef.current.set(next.unified_id, next);
    setCreators((prev) => upsertCreatorInResults(prev, next).creators);
    setTotal((prev) => Math.max(prev, 1));
    setDetailCreator((current) =>
      current?.unified_id === next.unified_id ? next : current
    );
  }

  function patchCreatorInList(next: UnifiedCreatorResult) {
    upsertCreatorInList(next);
  }

  function handleMissingCreatorAdded(creator: UnifiedCreatorResult) {
    analyticsRef.current?.trackAddMissingCreator({
      query: debouncedSearch,
      intentMode: searchIntent.mode,
      confidence: searchIntent.confidence,
    });

    const query =
      resolveCreatorSearchQueryFromCreator(creator) ||
      normalizeDiscoverySearchQuery(searchRef.current);

    upsertCreatorInList(creator);
    if (query) syncDiscoverySearchQuery(query);

    setSelectedIds((prev) => new Set(prev).add(creator.unified_id));
    setSelectedCreatorMap((prev) => {
      const next = new Map(prev);
      next.set(creator.unified_id, creator);
      return next;
    });
  }

  function handleMissingCreatorUpdated(creator: UnifiedCreatorResult) {
    upsertCreatorInList(creator);

    const query = resolveCreatorSearchQueryFromCreator(creator);
    if (query) syncDiscoverySearchQuery(query);
  }

  function handleCreatorDeleted(creator: UnifiedCreatorResult) {
    pinnedCreatorsRef.current.delete(creator.unified_id);
    setCreators((prev) => prev.filter((row) => row.unified_id !== creator.unified_id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSelectedIds((prev) => {
      if (!prev.has(creator.unified_id)) return prev;
      const next = new Set(prev);
      next.delete(creator.unified_id);
      return next;
    });
    setSelectedCreatorMap((prev) => {
      if (!prev.has(creator.unified_id)) return prev;
      const next = new Map(prev);
      next.delete(creator.unified_id);
      return next;
    });
    setDetailCreator((current) =>
      current?.unified_id === creator.unified_id ? null : current
    );
    router.refresh();
  }

  function patchCreatorEnrichmentStatus(
    unifiedId: string,
    status: ReturnType<typeof syncStatusToEnrichmentStatus>
  ) {
    setCreators((prev) =>
      prev.map((creator) =>
        creator.unified_id === unifiedId
          ? { ...creator, enrichment_status: status }
          : creator
      )
    );
    setDetailCreator((current) =>
      current?.unified_id === unifiedId ? { ...current, enrichment_status: status } : current
    );
  }

  function applyStopRefreshResult(
    unifiedIds: string[],
    result: { ok: boolean; stopped: boolean; message: string; stoppedCount?: number }
  ) {
    if (result.stopped) {
      toast.success(result.message);
      for (const unifiedId of unifiedIds) {
        const creator = creators.find((c) => c.unified_id === unifiedId);
        if (!creator) continue;
        const nextStatus = creator.last_enriched_at ? "enriched" : "never";
        patchCreatorEnrichmentStatus(unifiedId, nextStatus);
      }
    } else if (result.ok) {
      toast.info(result.message);
    } else {
      toast.error(result.message);
    }
  }

  function handleBulkStopRefresh() {
    if (selectedInFlightCreators.length === 0) return;
    const unifiedIds = selectedInFlightCreators.map((c) => c.unified_id);
    startTransition(async () => {
      const result = await stopCreatorsMetricsRefreshBatchAction(unifiedIds);
      applyStopRefreshResult(unifiedIds, result);
    });
  }

  function handleStopAllRefresh() {
    if (inFlightCreators.length === 0) return;
    const unifiedIds = inFlightCreators.map((c) => c.unified_id);
    startTransition(async () => {
      const result = await stopCreatorsMetricsRefreshBatchAction(unifiedIds);
      applyStopRefreshResult(unifiedIds, result);
    });
  }

  function handleStopRefreshForCreator(creator: UnifiedCreatorResult) {
    startTransition(async () => {
      const result = await stopCreatorMetricsRefreshAction(creator.unified_id);
      applyStopRefreshResult([creator.unified_id], result);
    });
  }

  function handleRefreshMetricsForCreator(
    creator: UnifiedCreatorResult,
    platformAccountId?: string | null
  ) {
    if (!creator.influencer_id) {
      toast.error("Could not refresh", {
        description: "This creator has no linked vendor profile.",
      });
      return;
    }

    const { unified_id: unifiedId, influencer_id: influencerId } = creator;
    const previousStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
    patchCreatorEnrichmentStatus(unifiedId, "queued");

    startTransition(async () => {
      const result = platformAccountId
        ? await refreshCreatorPlatformAction(influencerId, platformAccountId)
        : await refreshCreatorAction(influencerId);
      if (result.queued) {
        void pollCreatorAfterRefresh(
          { unifiedId, influencerId },
          {
            onUpdated: patchCreatorInList,
            onStatusChange: (syncStatus) => {
              patchCreatorEnrichmentStatus(unifiedId, syncStatusToEnrichmentStatus(syncStatus));
            },
            onComplete: (syncStatus) => {
              if (syncStatus === "completed") {
                toast.success(
                  platformAccountId ? "Platform metrics updated" : "Creator metrics updated"
                );
              } else if (syncStatus === "failed") {
                toast.error("Creator refresh failed", {
                  description: "Apify enrichment did not complete successfully.",
                });
              }
            },
          }
        );
        return;
      }

      patchCreatorEnrichmentStatus(unifiedId, previousStatus);
      toast.error("Could not refresh", { description: result.message });
    });
  }

  function handleBulkRefreshMetrics() {
    if (selectedCreators.length === 0) return;
    const targets = selectedCreators.map((creator) => ({
      unifiedId: creator.unified_id,
      influencerId: creator.influencer_id,
    }));
    for (const target of targets) {
      if (target.influencerId) {
        patchCreatorEnrichmentStatus(target.unifiedId, "queued");
      }
    }
    startTransition(async () => {
      const result = await refreshCreatorsBatchAction(
        selectedCreators.map((c) => c.unified_id)
      );
      if (result.queued) {
        toast.success(result.message);
        void pollCreatorsAfterBatchRefresh(targets, {
          onUpdated: patchCreatorInList,
          onStatusChange: ({ unifiedId, status }) => {
            patchCreatorEnrichmentStatus(unifiedId, syncStatusToEnrichmentStatus(status));
          },
          onComplete: ({ status }) => {
            if (status === "completed") {
              toast.success("Creator metrics updated");
            } else if (status === "failed") {
              toast.error("Creator refresh failed");
            }
          },
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  const clearAllFilters = useCallback(() => {
    pendingUrlClearRef.current = "all";
    suppressBriefHydrationRef.current = true;
    initialBriefSearchDoneRef.current = false;

    abortRef.current?.abort();
    reqIdRef.current += 1;
    void cancelActiveAcquisitionSession();
    acquisitionRefreshedForJobRef.current = null;
    pinnedCreatorsRef.current.clear();

    sessionAcquiredInfluencerIdsRef.current = [];
    setApifySourceUnifiedIds(new Set());

    const cleared = cloneCreatorSearchFilters();
    filtersRef.current = cleared;
    searchRef.current = "";
    skipSearchUrlWriteRef.current = true;
    skipFilterUrlWriteRef.current = true;

    setFilters(cleared);
    setDebouncedSearch("");
    clearDiscoverySearchDraft();
    setCreators([]);
    setTotal(0);
    setError(null);
    setAiCriteria([]);
    setAiModeActive(false);
    setAiExtracting(false);
    setStrategySheetOpen(false);
    setBriefWorkspaceState(null);
    setBriefFileName(null);
    setActiveProfileId(null);
    setActiveProfile(null);
    setSort(DEFAULT_CREATOR_SEARCH_SORT);
    setBackfillStatus(null);
    setRecommendedCreators([]);
    setLoadingRecommendations(false);
    recommendationReqRef.current += 1;
    setPage(1);
    setHasMore(true);
    setFilterResetKey((key) => key + 1);
    clearCreatorSelection();

    const params = new URLSearchParams(searchParams.toString());
    params.delete(CREATOR_SEARCH_QUERY_PARAM);
    params.delete("profileId");
    params.delete("mode");
    params.delete("brief");
    applyCreatorSearchFiltersToUrlParams(params, cleared);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
    setFiltersDrawerOpen(false);
  }, [cancelActiveAcquisitionSession, pathname, router, searchParams]);

  const applyAiProfileFilters = useCallback(
    (profile: CampaignIntelligenceProfile, criteria?: CampaignSearchCriterion[]) => {
      sessionAcquiredInfluencerIdsRef.current = [];
      setApifySourceUnifiedIds(new Set());
      void cancelActiveAcquisitionSession();
      const chipCriteria = criteria ?? buildSearchStrategyFromProfile(profile);
      const nextFilters = buildCreatorFiltersFromProfile(profile, chipCriteria);

      aiModeRef.current = true;
      aiCriteriaRef.current = chipCriteria;
      filtersRef.current = nextFilters;
      skipNextFilterFetchRef.current = true;

      setAiCriteria(chipCriteria);
      setFilters(nextFilters);
      setDebouncedSearch("");
      skipSearchUrlWriteRef.current = true;
      setSort({ field: "relevance", direction: "desc" });
      setAiModeActive(true);
      setPage(1);
      setHasMore(false);
      setCreators([]);
      setTotal(0);
      setLoading(true);
      setError(null);
      clearCreatorSelection();

      void fetchPageRef.current(1, false, nextFilters, {
        caller: "ai_brief_search",
        skipCoverageBackfill: true,
      });
    },
    [clearCreatorSelection, cancelActiveAcquisitionSession]
  );

  const handleRemoveAiCriterion = useCallback(
    (id: string) => {
      const next = aiCriteria.filter((c) => c.id !== id);
      setAiCriteria(next);
      if (next.length === 0) {
        clearAllFilters();
        return;
      }
      if (!activeProfile) return;
      applyAiProfileFilters(activeProfile, next);
    },
    [activeProfile, aiCriteria, applyAiProfileFilters, clearAllFilters]
  );

  function handleSaveSearch() {
    try {
      localStorage.setItem(
        SAVED_SEARCH_KEY,
        JSON.stringify({ search: debouncedSearch, filters, savedAt: new Date().toISOString() })
      );
      toast.success("Search saved on this device");
    } catch {
      toast.error("Could not save search");
    }
  }

  const handleOpenCreator = useCallback(
    (creator: UnifiedCreatorResult) => {
      analyticsRef.current?.trackCreatorClicked({
        query: debouncedSearch,
        intentMode: searchIntent.mode,
        confidence: searchIntent.confidence,
        creatorUnifiedId: creator.unified_id,
      });
      setDetailCreator(creator);
    },
    [debouncedSearch, searchIntent.confidence, searchIntent.mode]
  );

  const handleSearchWithFewerWords = useCallback(() => {
    const simplified = simplifyCreatorSearchQuery(debouncedSearch);
    if (!simplified) return;
    runSearch(simplified);
  }, [debouncedSearch, runSearch]);

  const syncBriefUrl = useCallback(
    (profileId?: string | null, options?: { aiMode?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("brief");
      const pid = profileId ?? activeProfileId;
      if (pid) {
        params.set("profileId", pid);
      } else {
        params.delete("profileId");
      }
      if (options?.aiMode) {
        params.set("mode", "ai");
      } else if (options?.aiMode === false) {
        params.delete("mode");
      }
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [activeProfileId, pathname, router, searchParams]
  );

  const activateAiCampaignSearch = useCallback(
    (profile: CampaignIntelligenceProfile, profileId: string, fileName: string | null) => {
      suppressBriefHydrationRef.current = false;
      setBriefWorkspaceState((prev) =>
        prev?.profileId === profileId
          ? prev
          : {
              profileId,
              profile,
              fileName,
              fileSizeBytes: prev?.fileSizeBytes ?? null,
              hasExtractedData: true,
              parsedTextLength: 0,
              parsedTextPreview: "",
            }
      );
      setBriefFileName(fileName);
      setActiveProfileId(profileId);
      setActiveProfile(profile);
      const criteria = buildSearchStrategyFromProfile(profile);
      syncBriefUrl(profileId, { aiMode: true });
      applyAiProfileFilters(profile, criteria);
      setAiExtracting(true);
      setBriefSidebarOpen(false);
    },
    [applyAiProfileFilters, syncBriefUrl]
  );

  const handleBriefAnalyzed = useCallback(
    (state: CampaignIntelligenceWorkspaceState) => {
      activateAiCampaignSearch(state.profile, state.profileId, state.fileName);
    },
    [activateAiCampaignSearch]
  );

  useEffect(() => {
    if (!initialBriefState || suppressBriefHydrationRef.current) return;
    if (initialBriefSearchDoneRef.current) return;
    initialBriefSearchDoneRef.current = true;
    activateAiCampaignSearch(
      initialBriefState.profile,
      initialBriefState.profileId,
      initialBriefState.fileName
    );
  }, [activateAiCampaignSearch, initialBriefState]);

  const handleBriefCleared = useCallback(() => {
    suppressBriefHydrationRef.current = true;
    setBriefWorkspaceState(null);
    setBriefFileName(null);
    setActiveProfileId(null);
    setActiveProfile(null);
    setAiCriteria([]);
    setAiModeActive(false);
    setAiExtracting(false);
    setFilters(cloneCreatorSearchFilters());
    setPage(1);
    setHasMore(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("brief");
    params.delete("profileId");
    params.delete("mode");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const handleBriefWorkspaceChange = useCallback(
    (state: CampaignIntelligenceWorkspaceState) => {
      suppressBriefHydrationRef.current = false;
      setBriefWorkspaceState(state);
      setBriefFileName(state.fileName);
      setActiveProfileId(state.profileId);
      setActiveProfile(state.profile);
      setAiCriteria(buildSearchStrategyFromProfile(state.profile));
      syncBriefUrl(state.profileId);
    },
    [syncBriefUrl]
  );

  const handleUseAiCampaign = useCallback(() => {
    if (!activeProfile || !activeProfileId) {
      toast.info("Add a campaign brief first.");
      setBriefSidebarOpen(true);
      return;
    }
    activateAiCampaignSearch(activeProfile, activeProfileId, briefFileName);
  }, [activateAiCampaignSearch, activeProfile, activeProfileId, briefFileName]);

  useEffect(() => {
    if (!aiExtracting) return;
    if (!loading) setAiExtracting(false);
  }, [aiExtracting, loading]);

  const handleRunAiSearch = useCallback(() => {
    if (!activeProfile) {
      toast.info("Add a campaign brief first.");
      return;
    }
    applyAiProfileFilters(activeProfile, aiCriteria);
    setStrategySheetOpen(false);
  }, [activeProfile, aiCriteria, applyAiProfileFilters]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <CampaignBriefSidebar
        open={briefSidebarOpen}
        onOpenChange={setBriefSidebarOpen}
        initialState={briefWorkspaceState}
        onWorkspaceChange={handleBriefWorkspaceChange}
        onBriefCleared={handleBriefCleared}
        onRunAiSearch={handleUseAiCampaign}
        onBriefAnalyzed={handleBriefAnalyzed}
      />

      {activeProfile && aiModeActive ? (
        <CreatorSearchCampaignRequirementsPanel
          profile={activeProfile}
          fileName={briefFileName}
          onEdit={() => setBriefSidebarOpen(true)}
        />
      ) : null}

      <AiSearchStrategySheet
        open={strategySheetOpen}
        onOpenChange={setStrategySheetOpen}
        criteria={aiCriteria}
        onCriteriaChange={setAiCriteria}
        onRunSearch={handleRunAiSearch}
        running={loading || isPending}
      />

      {aiModeActive && aiCriteria.some((c) => c.enabled) ? (
        <CreatorSearchAiCriteriaChips
          criteria={aiCriteria}
          onRemove={handleRemoveAiCriterion}
          onEditStrategy={() => setStrategySheetOpen(true)}
        />
      ) : (
        <CreatorSearchActiveFilters
          filters={filters}
          search={debouncedSearch}
          onChange={setFilters}
          onClearSearch={handleClearSearch}
          onClearAll={clearAllFilters}
        />
      )}

      {backfillStatus ? (
        <p className="border-b border-border/60 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          {backfillStatus}
        </p>
      ) : null}

      <CreatorSearchBulkBar
        selectedCount={selectedCreators.length}
        onClearSelection={clearCreatorSelection}
        onAddToList={handleBulkAddToList}
        onCreateList={() => setCreateListOpen(true)}
        onCompare={handleBulkCompare}
        onExport={handleBulkExport}
        onShare={handleBulkShare}
        onGenerateQuotation={handleGenerateQuotation}
        onRefreshMetrics={handleBulkRefreshMetrics}
        onStopRefresh={handleBulkStopRefresh}
        stopRefreshDisabled={selectedInFlightCreators.length === 0}
        onAiMatch={() => {
          if (selectedCreators.length === 0) {
            toast.info("Select creators, then run AI Match from AI Analyst");
            return;
          }
          toast.info(
            <span>
              Open{" "}
              <Link href="/ai" className="font-semibold underline">
                AI Analyst
              </Link>{" "}
              to match {selectedCreators.length} selected creator(s)
            </span>
          );
        }}
        busy={isPending}
      />

      <div
        className={cn(
          "relative flex min-h-0 flex-1 overflow-hidden",
          discoverySelectionFlyoutContentClass(selectedCreators.length > 0)
        )}
      >
        {aiExtracting ? (
          <CreatorSearchAiExtractingState className="absolute inset-0 z-10 bg-card" />
        ) : null}
        <CreatorSearchResultList
          creators={displayCreators}
          hybridListItems={hybridListItems}
          searchMode={searchIntent.mode}
          sort={sort}
          onSortChange={setSort}
          platformFilter={filters.platforms}
          loading={loading || (acquisitionPolling && displayCreators.length === 0)}
          loadingMore={loadingMore}
          hasMore={isExactCreatorSearch || aiModeActive ? false : hasMore}
          error={error}
          total={headerTotal}
          apifySourceUnifiedIds={apifySourceUnifiedIds}
          showCampaignRelevance={showCampaignRelevance}
          selectedIds={selectedIds}
          shortlistedIds={shortlistedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onOpenCreator={handleOpenCreator}
          onToggleShortlist={handleToggleShortlist}
          onRejectCreator={handleRejectCreator}
          onRefreshMetrics={handleRefreshMetricsForCreator}
          onStopRefresh={handleStopRefreshForCreator}
          onStopAllRefresh={handleStopAllRefresh}
          inFlightCount={inFlightCreators.length}
          onRetry={() => runSearch()}
          loadMoreRef={loadMoreRef}
          showAddMissingCreator={
            debouncedSearch.trim().length > 0 && !exactCreatorZeroMatch
          }
          exactCreatorEmptyState={exactCreatorZeroMatch}
          searchQuery={debouncedSearch}
          canSimplifyExactQuery={canSimplifyExactQuery}
          onSearchWithFewerWords={handleSearchWithFewerWords}
          onMissingCreatorAdded={handleMissingCreatorAdded}
          onMissingCreatorEnrichmentStatusChange={patchCreatorEnrichmentStatus}
          onMissingCreatorUpdated={handleMissingCreatorUpdated}
          onCreatorDeleted={handleCreatorDeleted}
          showExactMatchesZeroHeader={showZeroResultsRecommendations}
          recommendations={visibleRecommendations}
          loadingRecommendations={loadingRecommendations}
          toolbar={{
            searchQuery: debouncedSearch,
            onDebouncedSearchChange: handleDebouncedSearchChange,
            onSearchSubmit: (query) => runSearch(query),
            searchLoading: loading || isPending,
            sort,
            onSortChange: setSort,
            filters,
            onFiltersChange: setFilters,
            onOpenFilters: () => setFiltersDrawerOpen(true),
            showCampaignRelevance,
          }}
        />
      </div>

      <DiscoveryFilterSheet open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
          <CreatorSearchFilterPanel
            key={filterResetKey}
            open={filtersDrawerOpen}
            filters={filters}
            onApply={setFilters}
            onClearAll={clearAllFilters}
            onClose={() => setFiltersDrawerOpen(false)}
            loading={loading || isPending}
          />
      </DiscoveryFilterSheet>

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailCreator != null}
        onOpenChange={(open) => {
          if (!open) setDetailCreator(null);
        }}
        onCreatorUpdated={patchCreatorInList}
      />

      <CreateListDialog
        open={createListOpen}
        onOpenChange={setCreateListOpen}
        campaigns={campaigns}
        onCreated={handleListCreated}
      />

      <SelectPlatformAccountsDialog
        open={platformSelectOpen}
        onOpenChange={(open) => {
          setPlatformSelectOpen(open);
          if (!open) setPendingShortlistCreator(null);
        }}
        creator={pendingShortlistCreator}
        onConfirm={handleConfirmPlatformAccounts}
      />

      <AddToShortlistDialog
        open={addToShortlistOpen}
        onOpenChange={(open) => {
          setAddToShortlistOpen(open);
          if (!open) {
            setPendingAddCreators([]);
            setPendingPlatformSelections([]);
          }
        }}
        creators={pendingAddCreators}
        onCreatorsChange={syncPendingCreators}
        shortlists={shortlists}
        onShortlistsChange={setShortlists}
        onConfirm={handleAddToShortlistConfirm}
        busy={isPending}
      />
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-types.ts`

```ts
import { resolveDiscoveryPlatform } from "@/lib/social/platforms";

import { PLATFORM_LABELS } from "@/lib/social/platforms";

import { countryLabel, languageLabel, LAST_POST_WITHIN_OPTIONS } from "./creator-search-filter-constants";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import type { DiscoverySearchFilterKey } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";

export type CreatorSearchFilters = {
  search: string;
  handle: string;
  platforms: string[];
  /** Creator location — first entry is sent to browse RPC; all apply client-side OR filter. */
  countries: string[];
  /** Creator profile languages — first entry sent to SQL; OR within group client-side. */
  languages: string[];
  /** Content languages — client-side OR filter on language_codes. */
  contentLanguages: string[];
  /** Audience geography — client-side filter when enrichment data is sparse. */
  audienceCountries: string[];
  /** Audience interest tags — OR match against creator categories / niche. */
  audienceInterestTags: string[];
  /** Content keyword merged into FTS browse search (distinct from top-bar query). */
  contentKeyword: string;
  /** Hashtag / topic pills merged into browse search. */
  contentTags: string[];
  /** Recency window — client-side filter on recent publications when set. */
  lastPostWithin: string;
  advancedSearch: boolean;
  gender: string;
  ageMin: string;
  ageMax: string;
  minFollowers: string;
  maxFollowers: string;
  minEngagement: string;
  minViews: string;
  minAiScore: string;
  minThinkwayScore: string;
  minEstimatedCost: string;
  maxEstimatedCost: string;
  categories: string[];
  minBrandSafety: string;
  aiNiche: string;
  minBrandFit: string;
};

export const DEFAULT_CREATOR_SEARCH_FILTERS: CreatorSearchFilters = {
  search: "",
  handle: "",
  platforms: [],
  countries: [],
  languages: [],
  contentLanguages: [],
  audienceCountries: [],
  audienceInterestTags: [],
  contentKeyword: "",
  contentTags: [],
  lastPostWithin: "",
  advancedSearch: false,
  gender: "",
  ageMin: "",
  ageMax: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  minViews: "",
  minAiScore: "",
  minThinkwayScore: "",
  minEstimatedCost: "",
  maxEstimatedCost: "",
  categories: [],
  minBrandSafety: "",
  aiNiche: "",
  minBrandFit: "",
};

/** Deep-clone filter arrays — never mutate `DEFAULT_CREATOR_SEARCH_FILTERS` in place. */
export function cloneCreatorSearchFilters(
  base: CreatorSearchFilters = DEFAULT_CREATOR_SEARCH_FILTERS
): CreatorSearchFilters {
  return {
    ...base,
    platforms: [...base.platforms],
    countries: [...base.countries],
    languages: [...base.languages],
    contentLanguages: [...base.contentLanguages],
    audienceCountries: [...base.audienceCountries],
    audienceInterestTags: [...base.audienceInterestTags],
    contentTags: [...base.contentTags],
    categories: [...base.categories],
  };
}

function normalizePlatformFilterValues(platforms: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of platforms) {
    const platform = resolveDiscoveryPlatform(raw) ?? raw.trim().toLowerCase();
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    normalized.push(platform);
  }
  return normalized;
}

export const CREATOR_SEARCH_SORT_FIELDS = [
  { value: "relevance", label: "Relevance", defaultDirection: "desc" },
  { value: "name", label: "Name", defaultDirection: "asc" },
  { value: "platform", label: "Platform", defaultDirection: "asc" },
  { value: "followers", label: "Followers", defaultDirection: "desc" },
  { value: "country", label: "Country", defaultDirection: "asc" },
  { value: "categories", label: "Categories", defaultDirection: "asc" },
  { value: "engagement", label: "Engagement rate", defaultDirection: "desc" },
  { value: "views", label: "Avg views", defaultDirection: "desc" },
  { value: "brand_safety", label: "Brand safety", defaultDirection: "desc" },
  { value: "source", label: "Source", defaultDirection: "asc" },
  { value: "thinkway", label: "Thinkway score", defaultDirection: "desc" },
  { value: "last_synced", label: "Last synced", defaultDirection: "desc" },
] as const;

export type CreatorSearchSortField = (typeof CREATOR_SEARCH_SORT_FIELDS)[number]["value"];

export type CreatorSearchSortDirection = "asc" | "desc";

export type CreatorSearchSortState = {
  field: CreatorSearchSortField;
  direction: CreatorSearchSortDirection;
};

/** @deprecated Use CreatorSearchSortField */
export type CreatorSearchSort = CreatorSearchSortField;

export const DEFAULT_CREATOR_SEARCH_SORT: CreatorSearchSortState = {
  field: "last_synced",
  direction: "desc",
};

export function defaultDirectionForSortField(
  field: CreatorSearchSortField
): CreatorSearchSortDirection {
  return (
    CREATOR_SEARCH_SORT_FIELDS.find((option) => option.value === field)?.defaultDirection ?? "desc"
  );
}

export type CreatorSearchFilterSectionId =
  | "search"
  | "creator"
  | "audience"
  | "performance"
  | "content"
  | "ai"
  | "advanced";

/** Active filter bar section labels (grouped chips). */
export const CREATOR_SEARCH_ACTIVE_FILTER_GROUPS: ReadonlyArray<{
  id: CreatorSearchFilterSectionId;
  label: string;
}> = [
  { id: "search", label: "Search" },
  { id: "creator", label: "Creator" },
  { id: "audience", label: "Audience" },
  { id: "performance", label: "Performance" },
  { id: "content", label: "Content" },
  { id: "advanced", label: "Advanced" },
  { id: "ai", label: "AI" },
] as const;

/** A removable filter pill shown above the result list. */
export type ActiveFilterChip = {
  id: string;
  label: string;
  section: CreatorSearchFilterSectionId;
  /** Patch applied to clear this single chip. */
  clear: Partial<CreatorSearchFilters>;
};


const PLATFORM_CHIP_LABELS: Record<string, string> = PLATFORM_LABELS;

function lastPostWithinLabel(value: string): string {
  return LAST_POST_WITHIN_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatGenderLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  return value.trim();
}

function rangeLabel(prefix: string, min: string, max: string): string {
  if (min && max) return `${prefix}: ${min}–${max}`;
  if (min) return `${prefix}: ≥ ${min}`;
  return `${prefix}: ≤ ${max}`;
}

/** True when any filter field or the top-bar search query differs from defaults. */
export function hasActiveCreatorSearchFilters(
  filters: CreatorSearchFilters,
  search = ""
): boolean {
  if (search.trim()) return true;

  for (const key of Object.keys(DEFAULT_CREATOR_SEARCH_FILTERS) as (keyof CreatorSearchFilters)[]) {
    const current = filters[key];
    const defaults = DEFAULT_CREATOR_SEARCH_FILTERS[key];
    if (Array.isArray(current)) {
      if (current.length > 0) return true;
    } else if (current !== defaults) {
      return true;
    }
  }

  return false;
}

/** Derives the set of removable chips from the current filter state. */
export function buildActiveFilterChips(
  filters: CreatorSearchFilters,
  topBarSearch = ""
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (topBarSearch.trim()) {
    chips.push({
      id: "topSearch",
      label: `Search: ${topBarSearch.trim()}`,
      section: "search",
      clear: { search: "" },
    });
  }
  if (filters.contentKeyword.trim()) {
    chips.push({
      id: "contentKeyword",
      label: `Keyword: ${filters.contentKeyword.trim()}`,
      section: "content",
      clear: { contentKeyword: "" },
    });
  }
  for (const tag of filters.contentTags) {
    chips.push({
      id: `contentTag:${tag}`,
      label: `Tag: ${tag.startsWith("#") ? tag : `#${tag}`}`,
      section: "content",
      clear: { contentTags: filters.contentTags.filter((value) => value !== tag) },
    });
  }
  for (const lang of filters.contentLanguages) {
    chips.push({
      id: `contentLanguage:${lang}`,
      label: `Content language: ${languageLabel(lang)}`,
      section: "content",
      clear: {
        contentLanguages: filters.contentLanguages.filter((value) => value !== lang),
      },
    });
  }
  if (filters.lastPostWithin) {
    chips.push({
      id: "lastPostWithin",
      label: `Last post: ${lastPostWithinLabel(filters.lastPostWithin)}`,
      section: "advanced",
      clear: { lastPostWithin: "" },
    });
  }
  if (filters.handle.trim()) {
    chips.push({
      id: "handle",
      label: `Handle: ${filters.handle.trim()}`,
      section: "creator",
      clear: { handle: "" },
    });
  }
  for (const platform of filters.platforms) {
    chips.push({
      id: `platform:${platform}`,
      label: PLATFORM_CHIP_LABELS[platform] ?? platform,
      section: "creator",
      clear: { platforms: filters.platforms.filter((p) => p !== platform) },
    });
  }
  for (const code of filters.countries) {
    chips.push({
      id: `country:${code}`,
      label: `Creator country: ${countryLabel(code)}`,
      section: "creator",
      clear: { countries: filters.countries.filter((value) => value !== code) },
    });
  }
  for (const lang of filters.languages) {
    chips.push({
      id: `language:${lang}`,
      label: `Language: ${languageLabel(lang)}`,
      section: "creator",
      clear: { languages: filters.languages.filter((value) => value !== lang) },
    });
  }
  for (const code of filters.audienceCountries) {
    chips.push({
      id: `audienceCountry:${code}`,
      label: `Audience country: ${countryLabel(code)}`,
      section: "audience",
      clear: {
        audienceCountries: filters.audienceCountries.filter((value) => value !== code),
      },
    });
  }
  for (const interest of filters.audienceInterestTags) {
    chips.push({
      id: `audienceInterest:${interest}`,
      label: `Audience interest: ${interest}`,
      section: "audience",
      clear: {
        audienceInterestTags: filters.audienceInterestTags.filter((value) => value !== interest),
      },
    });
  }
  if (filters.gender.trim()) {
    chips.push({
      id: "gender",
      label: `Gender: ${formatGenderLabel(filters.gender)}`,
      section: "audience",
      clear: { gender: "" },
    });
  }
  if (filters.ageMin || filters.ageMax) {
    chips.push({
      id: "age",
      label: rangeLabel("Age", filters.ageMin, filters.ageMax),
      section: "audience",
      clear: { ageMin: "", ageMax: "" },
    });
  }
  if (filters.minFollowers || filters.maxFollowers) {
    chips.push({
      id: "followers",
      label: rangeLabel("Followers", filters.minFollowers, filters.maxFollowers),
      section: "performance",
      clear: { minFollowers: "", maxFollowers: "" },
    });
  }
  if (filters.minEngagement) {
    chips.push({
      id: "engagement",
      label: `Eng. ≥ ${filters.minEngagement}%`,
      section: "performance",
      clear: { minEngagement: "" },
    });
  }
  if (filters.minViews) {
    chips.push({
      id: "views",
      label: `Views ≥ ${filters.minViews}`,
      section: "performance",
      clear: { minViews: "" },
    });
  }
  if (filters.minEstimatedCost || filters.maxEstimatedCost) {
    chips.push({
      id: "pricing",
      label: rangeLabel("Pricing", filters.minEstimatedCost, filters.maxEstimatedCost),
      section: "advanced",
      clear: { minEstimatedCost: "", maxEstimatedCost: "" },
    });
  }
  if (filters.minBrandSafety) {
    chips.push({
      id: "brandSafety",
      label: `Safety ≥ ${filters.minBrandSafety}`,
      section: "ai",
      clear: { minBrandSafety: "" },
    });
  }
  if (filters.aiNiche.trim()) {
    chips.push({
      id: "aiNiche",
      label: `Niche: ${filters.aiNiche.trim()}`,
      section: "ai",
      clear: { aiNiche: "" },
    });
  }
  if (filters.minThinkwayScore) {
    chips.push({
      id: "thinkway",
      label: `TW AI ≥ ${filters.minThinkwayScore}`,
      section: "ai",
      clear: { minThinkwayScore: "" },
    });
  }
  if (filters.minBrandFit) {
    chips.push({
      id: "brandFit",
      label: `Brand fit ≥ ${filters.minBrandFit}`,
      section: "ai",
      clear: { minBrandFit: "" },
    });
  }
  if (filters.minAiScore) {
    chips.push({
      id: "aiQuality",
      label: `AI quality ≥ ${filters.minAiScore}`,
      section: "ai",
      clear: { minAiScore: "" },
    });
  }
  for (const category of filters.categories) {
    chips.push({
      id: `category:${category}`,
      label: `Category: ${category}`,
      section: "creator",
      clear: {
        categories: filters.categories.filter((value) => value !== category),
      },
    });
  }
  return chips;
}

/** Clears every active filter field belonging to a filter section in one action. */
export function clearCreatorSearchSectionFilters(
  section: CreatorSearchFilterSectionId,
  filters: CreatorSearchFilters
): CreatorSearchFilters {
  const next = cloneCreatorSearchFilters(filters);

  switch (section) {
    case "search":
      return { ...next, search: "" };
    case "creator":
      return {
        ...next,
        handle: "",
        platforms: [],
        countries: [],
        languages: [],
        categories: [],
      };
    case "audience":
      return {
        ...next,
        audienceCountries: [],
        audienceInterestTags: [],
        gender: "",
        ageMin: "",
        ageMax: "",
      };
    case "performance":
      return {
        ...next,
        minFollowers: "",
        maxFollowers: "",
        minEngagement: "",
        minViews: "",
        minEstimatedCost: "",
        maxEstimatedCost: "",
      };
    case "content":
      return {
        ...next,
        contentKeyword: "",
        contentTags: [],
        contentLanguages: [],
      };
    case "advanced":
      return {
        ...next,
        lastPostWithin: "",
        advancedSearch: false,
      };
    case "ai":
      return {
        ...next,
        minBrandSafety: "",
        aiNiche: "",
        minThinkwayScore: "",
        minBrandFit: "",
        minAiScore: "",
      };
    default:
      return next;
  }
}

function contentSearchTokens(filters: CreatorSearchFilters): string[] {
  const tags = filters.contentTags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return [filters.contentKeyword.trim(), ...tags].filter(Boolean);
}

function buildCoverageIntent(filters: CreatorSearchFilters) {
  const primaryCountry = filters.countries[0]?.trim().toUpperCase();
  const audienceSignal = [
    ...filters.audienceInterestTags,
    ...filters.categories,
    filters.aiNiche.trim(),
    filters.contentKeyword.trim(),
    ...filters.contentTags,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  const nicheTags = [
    ...filters.audienceInterestTags.map((tag) => tag.trim()).filter(Boolean),
    ...(filters.aiNiche.trim() ? [filters.aiNiche.trim()] : []),
  ];
  const platformFilters = normalizePlatformFilterValues(filters.platforms);

  return {
    country: primaryCountry || undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    niches: nicheTags.length > 0 ? nicheTags : undefined,
    platforms: platformFilters.length > 0 ? platformFilters : undefined,
    audience: audienceSignal || undefined,
    minFollowers: filters.minFollowers ? Number(filters.minFollowers) : undefined,
    maxFollowers: filters.maxFollowers ? Number(filters.maxFollowers) : undefined,
  };
}

export function filtersToBrowseParams(filters: CreatorSearchFilters, page: number, pageSize: number) {
  const search = [
    filters.search.trim(),
    filters.handle.trim(),
    ...contentSearchTokens(filters),
  ]
    .filter(Boolean)
    .join(" ");
  const minAi = [filters.minAiScore, filters.minBrandFit]
    .map((v) => (v ? Number(v) : NaN))
    .filter((n) => !Number.isNaN(n));
  const minAiScore = minAi.length ? Math.max(...minAi) : undefined;
  const primaryCountry = filters.countries[0]?.trim().toUpperCase();
  const primaryLanguage = filters.languages[0]?.trim().toLowerCase();
  const platformFilters = normalizePlatformFilterValues(filters.platforms);

  return {
    search: search || undefined,
    platform: platformFilters.length === 1 ? platformFilters[0] : undefined,
    platforms: platformFilters.length > 1 ? platformFilters : undefined,
    country: primaryCountry || undefined,
    creatorCountries: filters.countries.length > 0 ? filters.countries : undefined,
    language: primaryLanguage || undefined,
    languages: filters.languages.length > 0 ? filters.languages : undefined,
    contentLanguages:
      filters.contentLanguages.length > 0 ? filters.contentLanguages : undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    audienceCountries:
      filters.audienceCountries.length > 0 ? filters.audienceCountries : undefined,
    audienceInterestTags:
      filters.audienceInterestTags.length > 0 ? filters.audienceInterestTags : undefined,
    audienceGender: filters.gender.trim() || undefined,
    audienceAgeMin: filters.ageMin.trim() || undefined,
    audienceAgeMax: filters.ageMax.trim() || undefined,
    minFollowers: filters.minFollowers ? Number(filters.minFollowers) : undefined,
    maxFollowers: filters.maxFollowers ? Number(filters.maxFollowers) : undefined,
    minEngagement: filters.minEngagement ? Number(filters.minEngagement) : undefined,
    minViews: filters.minViews ? Number(filters.minViews) : undefined,
    minAiScore,
    minThinkwayScore: filters.minThinkwayScore ? Number(filters.minThinkwayScore) : undefined,
    productionOnly: true as const,
    page,
    pageSize,
    coverageIntent: buildCoverageIntent(filters),
  };
}

/**
 * Relaxed browse params for AI campaign search — avoids strict AND filters in SQL.
 * Audience/geo/category/keyword signals are scored client-side instead of excluding creators.
 */
export function filtersToRelaxedBrowseParams(
  filters: CreatorSearchFilters,
  page: number,
  pageSize: number
) {
  const platformFilters = normalizePlatformFilterValues(filters.platforms);
  return {
    platform: platformFilters.length === 1 ? platformFilters[0] : undefined,
    platforms: platformFilters.length > 1 ? platformFilters : undefined,
    productionOnly: true as const,
    page,
    pageSize,
    coverageIntent: buildCoverageIntent(filters),
  };
}

/** Active filter count per collapsible panel section. */
export function creatorSearchSectionFilterCounts(filters: CreatorSearchFilters) {
  const counts: Record<CreatorSearchFilterSectionId, number> = {
    search: 0,
    creator: 0,
    audience: 0,
    performance: 0,
    content: 0,
    ai: 0,
    advanced: 0,
  };

  for (const chip of buildActiveFilterChips(filters)) {
    counts[chip.section] += 1;
  }

  return counts;
}

/** Total removable active filter chips (excludes top-bar search when omitted). */
export function countActiveCreatorSearchFilterChips(
  filters: CreatorSearchFilters,
  topBarSearch = ""
): number {
  return buildActiveFilterChips(filters, topBarSearch).length;
}

function pushCriterion(
  criteria: CampaignSearchCriterion[],
  seed: Omit<CampaignSearchCriterion, "id"> & { id?: string }
): void {
  criteria.push({
    id: seed.id ?? `filter-${criteria.length + 1}`,
    kind: seed.kind,
    label: seed.label,
    value: seed.value,
    weight: seed.weight,
    enabled: seed.enabled,
    meta: seed.meta,
  });
}

/**
 * Converts manual Discovery filter state into campaign relevance criteria
 * for zero-results recommendations (reuses campaign-relevance-scoring.ts).
 */
export function creatorSearchFiltersToCriteria(
  filters: CreatorSearchFilters
): CampaignSearchCriterion[] {
  const criteria: CampaignSearchCriterion[] = [];

  for (const category of filters.categories) {
    pushCriterion(criteria, {
      kind: "category",
      label: "Category",
      value: category,
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "category", rawValue: category },
    });
  }
  for (const platform of normalizePlatformFilterValues(filters.platforms)) {
    pushCriterion(criteria, {
      kind: "platform",
      label: "Platform",
      value: platform,
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "platform", rawValue: platform },
    });
  }
  for (const code of filters.countries) {
    pushCriterion(criteria, {
      kind: "country",
      label: "Creator country",
      value: code.trim().toUpperCase(),
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "creator_country", rawValue: code },
    });
  }
  for (const code of filters.audienceCountries) {
    pushCriterion(criteria, {
      kind: "country",
      label: "Audience country",
      value: code.trim().toUpperCase(),
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "audience_country", rawValue: code },
    });
  }
  for (const lang of filters.languages) {
    pushCriterion(criteria, {
      kind: "language",
      label: "Language",
      value: lang.trim().toLowerCase(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "language", rawValue: lang },
    });
  }
  for (const lang of filters.contentLanguages) {
    pushCriterion(criteria, {
      kind: "language",
      label: "Content language",
      value: lang.trim().toLowerCase(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "language" as DiscoverySearchFilterKey, rawValue: lang },
    });
  }
  for (const interest of filters.audienceInterestTags) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Audience interest",
      value: interest,
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "niche", rawValue: interest },
    });
  }
  for (const tag of filters.contentTags) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Content tag",
      value: tag,
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "content_tag", rawValue: tag },
    });
  }
  if (filters.contentKeyword.trim()) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Keyword",
      value: filters.contentKeyword.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "content_keyword", rawValue: filters.contentKeyword.trim() },
    });
  }
  if (filters.gender.trim()) {
    pushCriterion(criteria, {
      kind: "audience",
      label: "Gender",
      value: filters.gender.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "audience_gender", rawValue: filters.gender.trim() },
    });
  }
  if (filters.ageMin.trim()) {
    pushCriterion(criteria, {
      kind: "audience",
      label: "Min age",
      value: filters.ageMin.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "audience_age_min", rawValue: filters.ageMin.trim() },
    });
  }
  if (filters.ageMax.trim()) {
    pushCriterion(criteria, {
      kind: "audience",
      label: "Max age",
      value: filters.ageMax.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "audience_age_max", rawValue: filters.ageMax.trim() },
    });
  }
  if (filters.minFollowers.trim()) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Min followers",
      value: filters.minFollowers.trim(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "follower_min", rawValue: filters.minFollowers.trim() },
    });
  }
  if (filters.maxFollowers.trim()) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Max followers",
      value: filters.maxFollowers.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "follower_max", rawValue: filters.maxFollowers.trim() },
    });
  }
  if (filters.minEngagement.trim()) {
    pushCriterion(criteria, {
      kind: "engagement",
      label: "Engagement",
      value: filters.minEngagement.trim(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "engagement_min", rawValue: filters.minEngagement.trim() },
    });
  }
  if (filters.minBrandSafety.trim()) {
    pushCriterion(criteria, {
      kind: "brand_fit",
      label: "Brand safety",
      value: filters.minBrandSafety.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "brand_safety_min", rawValue: filters.minBrandSafety.trim() },
    });
  }
  if (filters.minThinkwayScore.trim()) {
    pushCriterion(criteria, {
      kind: "authenticity",
      label: "Thinkway score",
      value: filters.minThinkwayScore.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "brand_fit_min", rawValue: filters.minThinkwayScore.trim() },
    });
  }

  return criteria;
}
```


---

## 3 — Toolbar, active filters, result list

Top toolbar, sort controls, active filter chips, virtualized exact-row result list.

#### `features/discovery/components/creator-search/creator-search-top-bar.tsx`

```tsx
"use client";

import { WandSparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CreatorSearchPopover } from "./creator-search-popover";
import {
  CreatorSearchFiltersPopover,
  CreatorSearchFollowersPopover,
  CreatorSearchSortPopover,
} from "./creator-search-toolbar-popovers";
import {
  DISCOVERY_TOOLBAR_ICON_PROPS,
  discoveryToolbarBtnClass,
} from "./creator-search-toolbar-utils";
import type { CreatorSearchFilters, CreatorSearchSortState } from "./creator-search-types";

export type CreatorSearchToolbarControlsProps = {
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  searchLoading?: boolean;
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  filters: CreatorSearchFilters;
  onFiltersChange: (filters: CreatorSearchFilters) => void;
  onOpenFilters: () => void;
  showCampaignRelevance?: boolean;
  className?: string;
};

/** Icon popovers + AI Search — lives in the results header row. */
export function CreatorSearchToolbarControls({
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  searchLoading,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  onOpenFilters,
  showCampaignRelevance = false,
  className,
}: CreatorSearchToolbarControlsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("discovery-search-exact-toolbar", className)}>
        <CreatorSearchPopover
          searchQuery={searchQuery}
          onDebouncedSearchChange={onDebouncedSearchChange}
          onSearchSubmit={onSearchSubmit}
          loading={searchLoading}
        />

        <CreatorSearchFiltersPopover
          filters={filters}
          onChange={onFiltersChange}
          onOpenAllFilters={onOpenFilters}
        />

        <CreatorSearchFollowersPopover
          filters={filters}
          onChange={onFiltersChange}
        />

        <CreatorSearchSortPopover
          sort={sort}
          onSortChange={onSortChange}
          showCampaignRelevance={showCampaignRelevance}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={discoveryToolbarBtnClass()} asChild>
              <Link href="/ai" aria-label="AI Search">
                <WandSparklesIcon {...DISCOVERY_TOOLBAR_ICON_PROPS} />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">AI Search</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-filter-bar.tsx`

```tsx
"use client";

import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { buildActiveFilterChips, type CreatorSearchFilters } from "./creator-search-types";

type SharedProps = {
  filters: CreatorSearchFilters;
  search: string;
  onOpenAllFilters: () => void;
  total: number;
  loading?: boolean;
};

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold text-white">
      {count}
    </span>
  );
}

/** Desktop filter trigger — opens the right-side filter drawer. */
export function CreatorSearchFilterToolbarButton({
  filters,
  search,
  onOpenAllFilters,
}: Omit<SharedProps, "total" | "loading">) {
  const totalActive = buildActiveFilterChips(filters, search).length;

  return (
    <div className="hidden shrink-0 items-center gap-2 lg:flex">
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 text-xs"
        onClick={onOpenAllFilters}
      >
        <SlidersHorizontalIcon className="size-3.5" />
        Filters
        <CountBadge count={totalActive} />
      </Button>
    </div>
  );
}

/** Mobile sticky bottom bar — Filters opens drawer; Show results closes it. */
export function CreatorSearchFilterBottomBar({
  filters,
  search = "",
  onOpenAllFilters,
  onShowResults,
  total,
  loading,
}: Pick<
  SharedProps,
  "filters" | "search" | "onOpenAllFilters" | "total" | "loading"
> & {
  onShowResults: () => void;
}) {
  const totalActive = buildActiveFilterChips(filters, search).length;

  return (
    <div className="sticky bottom-0 z-20 flex shrink-0 items-center gap-2 border-t border-[#e2e8f0] dark:border-border bg-white/95 dark:bg-background/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
      <Button
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1.5 text-xs"
        onClick={onOpenAllFilters}
      >
        <SlidersHorizontalIcon className="size-3.5" />
        Filters
        <CountBadge count={totalActive} />
      </Button>
      <Button
        size="sm"
        className="h-9 min-w-0 flex-1 gap-1.5 text-xs"
        onClick={onShowResults}
        disabled={loading}
      >
        {loading ? "Searching…" : `Show ${total.toLocaleString()} results`}
      </Button>
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-active-filters.tsx`

```tsx
"use client";

import { XIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import {
  buildActiveFilterChips,
  clearCreatorSearchSectionFilters,
  countActiveCreatorSearchFilterChips,
  CREATOR_SEARCH_ACTIVE_FILTER_GROUPS,
  type ActiveFilterChip,
  type CreatorSearchFilterSectionId,
  type CreatorSearchFilters,
} from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  search?: string;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
  onClearAll?: () => void;
};

function FilterChipButton({
  chip,
  filters,
  onChange,
  onClearSearch,
}: {
  chip: ActiveFilterChip;
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
}) {
  return (
    <button
      key={chip.id}
      type="button"
      onClick={() => {
        if (chip.id === "topSearch") {
          onClearSearch?.();
          return;
        }
        onChange({ ...filters, ...chip.clear });
      }}
      className={cn(
        "group inline-flex items-center gap-1 rounded-full border border-[#9edfc8] dark:border-emerald-500/35 bg-[#ecfdf5] dark:bg-emerald-500/10 py-1 pr-1.5 pl-2.5",
        "text-[11px] font-medium text-[#168a66] dark:text-emerald-300 transition-colors hover:bg-[#d1fae5] dark:hover:bg-emerald-500/20"
      )}
    >
      <span className="max-w-[220px] truncate">{chip.label}</span>
      <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function CreatorSearchActiveFilters({
  filters,
  search = "",
  onChange,
  onClearSearch,
  onClearAll,
}: Props) {
  const chips = useMemo(() => buildActiveFilterChips(filters, search), [filters, search]);
  const totalCount = countActiveCreatorSearchFilterChips(filters, search);

  const groupedChips = useMemo(() => {
    const groups = new Map<CreatorSearchFilterSectionId, ActiveFilterChip[]>();
    for (const chip of chips) {
      const existing = groups.get(chip.section) ?? [];
      existing.push(chip);
      groups.set(chip.section, existing);
    }
    return CREATOR_SEARCH_ACTIVE_FILTER_GROUPS.filter((group) => (groups.get(group.id)?.length ?? 0) > 0).map(
      (group) => ({
        ...group,
        chips: groups.get(group.id) ?? [],
      })
    );
  }, [chips]);

  if (chips.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-background px-4 py-2 md:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {totalCount} active filter{totalCount === 1 ? "" : "s"}
        </p>
        {onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc] dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {groupedChips.map((group) => (
          <div key={group.id} className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="mr-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              {group.label} ({group.chips.length})
            </span>
            {group.chips.map((chip) => (
              <FilterChipButton
                key={chip.id}
                chip={chip}
                filters={filters}
                onChange={onChange}
                onClearSearch={onClearSearch}
              />
            ))}
            <button
              type="button"
              onClick={() => onChange(clearCreatorSearchSectionFilters(group.id, filters))}
              className="shrink-0 text-[10px] font-medium text-[#0057FF] underline-offset-2 hover:text-[#0046cc] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear section
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-sort-toolbar.tsx`

```tsx
"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CREATOR_SEARCH_SORT_FIELDS,
  defaultDirectionForSortField,
  type CreatorSearchSortDirection,
  type CreatorSearchSortField,
  type CreatorSearchSortState,
} from "./creator-search-types";

type Props = {
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  className?: string;
  showCampaignRelevance?: boolean;
};

export function CreatorSearchSortToolbar({
  sort,
  onSortChange,
  className,
  showCampaignRelevance = false,
}: Props) {
  const sortOptions = showCampaignRelevance
    ? CREATOR_SEARCH_SORT_FIELDS
    : CREATOR_SEARCH_SORT_FIELDS.filter((option) => option.value !== "relevance");

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <ArrowUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <Select
          value={sort.field}
          onValueChange={(value) =>
            onSortChange({
              field: value as CreatorSearchSortField,
              direction: defaultDirectionForSortField(value as CreatorSearchSortField),
            })
          }
        >
          <SelectTrigger className="h-8 w-[120px] border-border bg-background text-xs sm:w-[130px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort.direction}
          onValueChange={(value) =>
            onSortChange({ ...sort, direction: value as CreatorSearchSortDirection })
          }
        >
          <SelectTrigger className="hidden h-8 w-[108px] border-border bg-background text-xs sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">
              <span className="flex items-center gap-1.5">
                <ArrowUpIcon className="size-3" />
                Asc
              </span>
            </SelectItem>
            <SelectItem value="desc">
              <span className="flex items-center gap-1.5">
                <ArrowDownIcon className="size-3" />
                Desc
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-result-list.tsx`

```tsx
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2Icon, RotateCwIcon, SearchXIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  DiscoveryEmptyState,
  DiscoverySearchExactListSkeleton,
} from "@/features/discovery/components/design-system";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorCheckboxState } from "@/features/creators/picker/creator-selection-hooks";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

import { CreatorSearchExactEmptyState } from "./creator-search-exact-empty-state";
import {
  CreatorSearchRecommendedSection,
  type CreatorSearchRecommendation,
} from "./creator-search-recommended-section";
import {
  CreatorSearchExactHeader,
  CreatorSearchExactRow,
} from "./creator-search-exact-row";
import {
  CreatorSearchHybridSectionHeader,
  type CreatorSearchHybridListItem,
} from "./creator-search-hybrid-sections";
import type { CreatorSearchIntentMode } from "./creator-search-intent-engine";
import {
  CreatorSearchToolbarControls,
  type CreatorSearchToolbarControlsProps,
} from "./creator-search-top-bar";
import type { CreatorSearchSortState } from "./creator-search-types";

const ROW_ESTIMATE = 148;
const SECTION_ESTIMATE = 52;

type Props = {
  creators: UnifiedCreatorResult[];
  hybridListItems?: CreatorSearchHybridListItem[];
  searchMode?: CreatorSearchIntentMode;
  sort?: CreatorSearchSortState;
  onSortChange?: (sort: CreatorSearchSortState) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  total: number;
  selectedIds: Set<string>;
  shortlistedIds: Set<string>;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onToggleSelectAll: () => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
  onRefreshMetrics?: (
    creator: UnifiedCreatorResult,
    platformAccountId?: string | null
  ) => void;
  onStopRefresh?: (creator: UnifiedCreatorResult) => void;
  onStopAllRefresh?: () => void;
  inFlightCount?: number;
  onRetry: () => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  platformFilter?: string[];
  showAddMissingCreator?: boolean;
  exactCreatorEmptyState?: boolean;
  searchQuery?: string;
  canSimplifyExactQuery?: boolean;
  onSearchWithFewerWords?: () => void;
  onMissingCreatorAdded?: (creator: UnifiedCreatorResult) => void;
  onMissingCreatorEnrichmentStatusChange?: (
    unifiedId: string,
    status: CreatorEnrichmentStatus
  ) => void;
  onMissingCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
  onCreatorDeleted?: (creator: UnifiedCreatorResult) => void;
  apifySourceUnifiedIds?: Set<string>;
  workerOfflineHint?: boolean;
  showCampaignRelevance?: boolean;
  showExactMatchesZeroHeader?: boolean;
  recommendations?: CreatorSearchRecommendation[];
  loadingRecommendations?: boolean;
  toolbar: CreatorSearchToolbarControlsProps;
};

type VirtualRowProps = {
  creator: UnifiedCreatorResult;
  selected: boolean;
  addedToShortlist: boolean;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  workerOfflineHint?: boolean;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
};

const CreatorSearchVirtualRow = memo(function CreatorSearchVirtualRow({
  creator,
  selected,
  addedToShortlist,
  platformFilter,
  isApifyAcquired,
  workerOfflineHint,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
}: VirtualRowProps) {
  const handleOpenCreator = useCallback(
    () => onOpenCreator(creator),
    [onOpenCreator, creator]
  );
  const handleToggleSelect = useCallback(
    () => onToggleSelect(creator),
    [onToggleSelect, creator]
  );
  const handleToggleShortlist = useCallback(
    () => onToggleShortlist(creator),
    [onToggleShortlist, creator]
  );
  const handleReject = useCallback(
    () => onRejectCreator(creator),
    [onRejectCreator, creator]
  );

  return (
    <CreatorSearchExactRow
      creator={creator}
      selected={selected}
      addedToShortlist={addedToShortlist}
      platformFilter={platformFilter}
      isApifyAcquired={isApifyAcquired}
      workerOfflineHint={workerOfflineHint}
      onToggleSelect={handleToggleSelect}
      onOpenCreator={handleOpenCreator}
      onToggleShortlist={handleToggleShortlist}
      onReject={handleReject}
    />
  );
});

export function CreatorSearchResultList({
  creators,
  hybridListItems,
  searchMode = "discovery",
  sort,
  loading,
  loadingMore,
  hasMore,
  error,
  total,
  selectedIds,
  shortlistedIds,
  onToggleSelectAll,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
  onStopAllRefresh,
  inFlightCount = 0,
  onRetry,
  loadMoreRef,
  platformFilter,
  showAddMissingCreator = false,
  exactCreatorEmptyState = false,
  searchQuery = "",
  canSimplifyExactQuery = false,
  onSearchWithFewerWords,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
  toolbar,
  apifySourceUnifiedIds,
  workerOfflineHint,
  showExactMatchesZeroHeader = false,
  recommendations = [],
  loadingRecommendations = false,
  onToggleSelect,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerToolbar = <CreatorSearchToolbarControls {...toolbar} />;

  const listItems = useMemo<CreatorSearchHybridListItem[]>(() => {
    if (hybridListItems && hybridListItems.length > 0) return hybridListItems;
    return creators.map((creator, index) => ({
      kind: "creator" as const,
      id: creator.unified_id,
      creator,
      rank: index + 1,
    }));
  }, [creators, hybridListItems]);

  const visibleCreatorIds = useMemo(
    () =>
      listItems
        .filter((item): item is Extract<CreatorSearchHybridListItem, { kind: "creator" }> => item.kind === "creator")
        .map((item) => item.creator.unified_id),
    [listItems]
  );

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      listItems[index]?.kind === "section" ? SECTION_ESTIMATE : ROW_ESTIMATE,
    overscan: 12,
    getItemKey: (index) => listItems[index]?.id ?? index,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    virtualizer.scrollToIndex(0);
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset layout when sort identity changes
  }, [sort?.field, sort?.direction]);

  const allSelected = useMemo(
    () => resolveCreatorCheckboxState(visibleCreatorIds, selectedIds),
    [visibleCreatorIds, selectedIds]
  );

  const hasCreators = visibleCreatorIds.length > 0;
  const exactMatchesCountLabel = showExactMatchesZeroHeader
    ? `Exact Matches — ${total.toLocaleString()} creator${total === 1 ? "" : "s"}`
    : undefined;

  return (
    <div className="discovery-search-exact-root">
      <div className="discovery-search-exact-header-bar">
        <CreatorSearchExactHeader
          total={total}
          allSelected={allSelected}
          hasCreators={hasCreators}
          onToggleSelectAll={onToggleSelectAll}
          toolbar={headerToolbar}
          countLabel={exactMatchesCountLabel}
        />
        {inFlightCount > 0 && onStopAllRefresh ? (
          <div className="flex justify-end pb-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="h-7 shrink-0 rounded-full text-xs"
              onClick={onStopAllRefresh}
            >
              Stop all refresh ({inFlightCount})
            </Button>
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="discovery-search-exact-scroll">
        {error ? (
          <DiscoveryEmptyState
            title="Search failed"
            description={error}
            icon={SearchXIcon}
            className="[&>div:first-child]:bg-destructive/10 [&>div:first-child]:text-destructive"
          >
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onRetry()}>
              <RotateCwIcon className="size-3.5" />
              Try again
            </Button>
          </DiscoveryEmptyState>
        ) : loading && !hasCreators ? (
          <DiscoverySearchExactListSkeleton />
        ) : !hasCreators ? (
          <>
            {exactCreatorEmptyState ? (
              <CreatorSearchExactEmptyState
                query={searchQuery}
                canSimplifyQuery={canSimplifyExactQuery}
                onSearchWithFewerWords={() => onSearchWithFewerWords?.()}
                onMissingCreatorAdded={onMissingCreatorAdded}
                onMissingCreatorEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                onMissingCreatorUpdated={onMissingCreatorUpdated}
              />
            ) : (
              <DiscoveryEmptyState
                title={
                  showAddMissingCreator
                    ? "No creators match your search"
                    : showExactMatchesZeroHeader
                      ? "No exact matches"
                      : "No creators match your filters"
                }
                description={
                  showAddMissingCreator
                    ? "Try a different spelling or handle, or add the creator by profile link."
                    : showExactMatchesZeroHeader
                      ? "Your filters are still applied. Review recommended creators below for the closest matches."
                      : "Try widening the follower range, removing a category, or clearing some filters."
                }
                icon={SearchXIcon}
              >
                <AddMissingCreatorEmptyState
                  visible={showAddMissingCreator}
                  className="mt-1"
                  onSuccess={onMissingCreatorAdded}
                  onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
                  onCreatorUpdated={onMissingCreatorUpdated}
                />
              </DiscoveryEmptyState>
            )}
            {showExactMatchesZeroHeader ? (
              <CreatorSearchRecommendedSection
                recommendations={recommendations}
                loading={loadingRecommendations}
                platformFilter={platformFilter}
                selectedIds={selectedIds}
                shortlistedIds={shortlistedIds}
                onToggleSelect={onToggleSelect}
                onOpenCreator={onOpenCreator}
                onToggleShortlist={onToggleShortlist}
                onRejectCreator={onRejectCreator}
              />
            ) : null}
          </>
        ) : (
          <>
            {searchMode === "hybrid" && hasCreators ? (
              <p className="pb-2 text-[11px] text-muted-foreground">Hybrid match</p>
            ) : null}
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = listItems[virtualRow.index];
                if (!item) return null;

                if (item.kind === "section") {
                  return (
                    <div
                      key={item.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <CreatorSearchHybridSectionHeader
                        title={item.title}
                        subtitle={item.subtitle}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <CreatorSearchVirtualRow
                      creator={item.creator}
                      selected={selectedIds.has(item.creator.unified_id)}
                      addedToShortlist={shortlistedIds.has(item.creator.unified_id)}
                      platformFilter={platformFilter}
                      isApifyAcquired={apifySourceUnifiedIds?.has(item.creator.unified_id)}
                      workerOfflineHint={workerOfflineHint}
                      onToggleSelect={onToggleSelect}
                      onOpenCreator={onOpenCreator}
                      onToggleShortlist={onToggleShortlist}
                      onRejectCreator={onRejectCreator}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!error ? <div ref={loadMoreRef} className="h-12" aria-hidden /> : null}
        {loadingMore ? (
          <div className="flex justify-center py-3">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!hasMore && hasCreators && !error ? (
          <p className="py-3 text-center text-[10px] text-muted-foreground">End of results</p>
        ) : null}
      </div>
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-exact-empty-state.tsx`

```tsx
"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import { DiscoveryEmptyState } from "@/features/discovery/components/design-system";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

type Props = {
  query: string;
  onSearchWithFewerWords: () => void;
  canSimplifyQuery: boolean;
  onMissingCreatorAdded?: (creator: UnifiedCreatorResult) => void;
  onMissingCreatorEnrichmentStatusChange?: (
    unifiedId: string,
    status: CreatorEnrichmentStatus
  ) => void;
  onMissingCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export function CreatorSearchExactEmptyState({
  query,
  onSearchWithFewerWords,
  canSimplifyQuery,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
}: Props) {
  return (
    <DiscoveryEmptyState
      title={`No creators found matching '${query}'.`}
      description="We looked for an exact handle or name match and did not find this creator in Thinkway."
    >
      <AddMissingCreatorEmptyState
        visible
        onSuccess={onMissingCreatorAdded}
        onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
        onCreatorUpdated={onMissingCreatorUpdated}
      />

      {canSimplifyQuery ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onSearchWithFewerWords}
        >
          Search with fewer words
        </Button>
      ) : null}

      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
        <Link href="/ai">
          <SparklesIcon className="size-3.5" />
          AI Search
        </Link>
      </Button>
    </DiscoveryEmptyState>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-hybrid-sections.tsx`

```tsx
"use client";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type CreatorSearchHybridListItem =
  | {
      kind: "section";
      id: string;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "creator";
      id: string;
      creator: UnifiedCreatorResult;
      rank: number;
    };

type BuildHybridListItemsInput = {
  exactMatches: UnifiedCreatorResult[];
  allCreators: UnifiedCreatorResult[];
  didYouMeanCount?: number;
};

export function CreatorSearchHybridSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2.5 md:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Build virtualized list rows for hybrid mode (exact matches, did-you-mean, related). */
export function buildCreatorSearchHybridListItems({
  exactMatches,
  allCreators,
  didYouMeanCount = 3,
}: BuildHybridListItemsInput): CreatorSearchHybridListItem[] {
  const exactIds = new Set(exactMatches.map((creator) => creator.unified_id));
  const fuzzyCreators = allCreators.filter((creator) => !exactIds.has(creator.unified_id));
  const items: CreatorSearchHybridListItem[] = [];
  let rank = 1;

  if (exactMatches.length > 0) {
    items.push({
      kind: "section",
      id: "section-exact",
      title: "Exact matches",
      subtitle: "Creators matching this handle or name exactly",
    });
    for (const creator of exactMatches) {
      items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
    }

    if (fuzzyCreators.length > 0) {
      items.push({
        kind: "section",
        id: "section-related",
        title: "Related creators",
        subtitle: "Similar results from your search",
      });
      for (const creator of fuzzyCreators) {
        items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
      }
    }

    return items;
  }

  const didYouMean = fuzzyCreators.slice(0, didYouMeanCount);
  const related = fuzzyCreators.slice(didYouMeanCount);

  if (didYouMean.length > 0) {
    items.push({
      kind: "section",
      id: "section-did-you-mean",
      title: "Did you mean?",
      subtitle: "Closest matches — check spelling or try the exact handle",
    });
    for (const creator of didYouMean) {
      items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
    }
  }

  if (related.length > 0) {
    items.push({
      kind: "section",
      id: "section-related",
      title: "Related creators",
      subtitle: "More creators related to your search",
    });
    for (const creator of related) {
      items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
    }
  }

  return items;
}

export function countCreatorSearchHybridResults(items: CreatorSearchHybridListItem[]): number {
  return items.filter((item) => item.kind === "creator").length;
}
```

#### `features/discovery/components/creator-search/creator-search-recommended-section.tsx`

```tsx
"use client";

import { Loader2Icon } from "lucide-react";
import { memo, useCallback } from "react";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorSearchExactRow } from "./creator-search-exact-row";

export type CreatorSearchRecommendation = {
  creator: UnifiedCreatorResult;
  relevanceScore: number;
  matchedAttributes: string[];
};

type Props = {
  recommendations: CreatorSearchRecommendation[];
  loading?: boolean;
  platformFilter?: string[];
  selectedIds: Set<string>;
  shortlistedIds: Set<string>;
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
};

const CreatorSearchRecommendedRow = memo(function CreatorSearchRecommendedRow({
  recommendation,
  selected,
  addedToShortlist,
  platformFilter,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
}: {
  recommendation: CreatorSearchRecommendation;
  selected: boolean;
  addedToShortlist: boolean;
  platformFilter?: string[];
  onToggleSelect: (creator: UnifiedCreatorResult) => void;
  onOpenCreator: (creator: UnifiedCreatorResult) => void;
  onToggleShortlist: (creator: UnifiedCreatorResult) => void;
  onRejectCreator: (creator: UnifiedCreatorResult) => void;
}) {
  const { creator, relevanceScore, matchedAttributes } = recommendation;

  const handleToggleSelect = useCallback(
    () => onToggleSelect(creator),
    [onToggleSelect, creator]
  );
  const handleOpenCreator = useCallback(
    () => onOpenCreator(creator),
    [onOpenCreator, creator]
  );
  const handleToggleShortlist = useCallback(
    () => onToggleShortlist(creator),
    [onToggleShortlist, creator]
  );
  const handleReject = useCallback(
    () => onRejectCreator(creator),
    [onRejectCreator, creator]
  );

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <CreatorSearchExactRow
        creator={creator}
        selected={selected}
        addedToShortlist={addedToShortlist}
        platformFilter={platformFilter}
        showCampaignRelevance
        onToggleSelect={handleToggleSelect}
        onOpenCreator={handleOpenCreator}
        onToggleShortlist={handleToggleShortlist}
        onReject={handleReject}
        meta={
          <div className="flex min-w-0 flex-col items-end gap-1 text-right">
            <span className="rounded-full bg-[rgba(0,87,255,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#0057FF]">
              {relevanceScore}% match
            </span>
            {matchedAttributes.length > 0 ? (
              <div className="flex max-w-[220px] flex-wrap justify-end gap-1">
                {matchedAttributes.slice(0, 4).map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-[#9edfc8] bg-[#ecfdf5] px-1.5 py-0.5 text-[9px] font-medium text-[#168a66]"
                  >
                    ✓ {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
});

export function CreatorSearchRecommendedSection({
  recommendations,
  loading = false,
  platformFilter,
  selectedIds,
  shortlistedIds,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onRejectCreator,
}: Props) {
  if (!loading && recommendations.length === 0) return null;

  return (
    <section className="border-t border-border/80 bg-muted/20">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="text-sm font-semibold text-foreground">Recommended Creators</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          We couldn&apos;t find exact matches. Showing the closest creators ranked by relevance.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Finding similar creators…
        </div>
      ) : (
        <div>
          {recommendations.map((recommendation) => (
            <CreatorSearchRecommendedRow
              key={recommendation.creator.unified_id}
              recommendation={recommendation}
              selected={selectedIds.has(recommendation.creator.unified_id)}
              addedToShortlist={shortlistedIds.has(recommendation.creator.unified_id)}
              platformFilter={platformFilter}
              onToggleSelect={onToggleSelect}
              onOpenCreator={onOpenCreator}
              onToggleShortlist={onToggleShortlist}
              onRejectCreator={onRejectCreator}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-exact-row.tsx`

```tsx
/**
 * @deprecated Import from `@/features/discovery/components/discovery-creator-exact-row` instead.
 * Re-exports preserved for Search module imports during consolidation.
 */
export {
  CreatorSearchExactHeader,
  CreatorSearchExactRow,
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
  resolveExactRowCategoriesLabel,
  type CreatorSearchExactRowProps,
  type DiscoveryCreatorExactRowProps,
} from "@/features/discovery/components/discovery-creator-exact-row";
```


---

## 4 — Creator exact row (canonical row + column headers)

Golden row/card layout: checkbox, avatar, stats columns, feed thumbs, row actions.

#### `features/discovery/components/discovery-creator-exact-row.tsx`

```tsx
"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { memo, type MouseEvent, type ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagBadge } from "@/components/creator/country-flag-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "@/features/discovery/components/discovery-creator-platform-stats";
import {
  buildDiscoveryCreatorViewModel,
  resolveDiscoveryCreatorMetaLabel,
} from "@/features/discovery/view-models/discovery-creator-view-model";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import { CreatorAvatarHoverTrigger } from "./creator-search/creator-avatar-hover-trigger";

/** @deprecated Use resolveDiscoveryCreatorMetaLabel from discovery-creator-view-model */
export { resolveDiscoveryCreatorMetaLabel as resolveExactRowCategoriesLabel };

export type DiscoveryCreatorExactRowProps = {
  creator: UnifiedCreatorResult;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenCreator: () => void;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  workerOfflineHint?: boolean;
  showCampaignRelevance?: boolean;
  className?: string;
  enriching?: boolean;
  selectable?: boolean;
  showFeed?: boolean;
  /** Search workspace — shortlist add state */
  addedToShortlist?: boolean;
  onToggleShortlist?: () => void;
  onReject?: () => void;
  /** Override default search accept/reject actions */
  actions?: ReactNode;
  /** Workspace meta (status, sync, quoted, etc.) between feed and actions */
  meta?: ReactNode;
  /** Row click opens creator detail (Search) or toggles selection (shortlist) */
  rowBehavior?: "open-detail" | "toggle-select";
};

export const DiscoveryCreatorExactRow = memo(function DiscoveryCreatorExactRow({
  creator,
  selected,
  addedToShortlist = false,
  platformFilter,
  isApifyAcquired,
  workerOfflineHint,
  showCampaignRelevance = false,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onReject,
  className,
  enriching = false,
  selectable = true,
  showFeed = true,
  actions,
  meta,
  rowBehavior = "open-detail",
}: DiscoveryCreatorExactRowProps) {
  const vm = buildDiscoveryCreatorViewModel(creator, {
    platformFilter,
    isApifyAcquired,
    showCampaignRelevance,
  });

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const searchActions =
    actions ??
    (onToggleShortlist || onReject ? (
      <>
        {onToggleShortlist ? (
          <button
            type="button"
            className={cn(
              "discovery-search-exact-accept",
              addedToShortlist && "is-added"
            )}
            onClick={(event) => {
              stop(event);
              onToggleShortlist();
            }}
          >
            <CheckIcon aria-hidden />
            <span>{addedToShortlist ? "Added" : "Add to shortlist"}</span>
          </button>
        ) : null}
        {onReject ? (
          <button
            type="button"
            className="discovery-search-exact-reject"
            aria-label={`Hide ${vm.displayName} from results`}
            onClick={(event) => {
              stop(event);
              onReject();
            }}
          >
            <XIcon aria-hidden />
          </button>
        ) : null}
      </>
    ) : null);

  const handleRowActivate = () => {
    if (rowBehavior === "toggle-select") {
      onToggleSelect();
      return;
    }
    onOpenCreator();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleRowActivate();
        }
      }}
      className={cn(
        "discovery-search-exact-row",
        selected && "is-selected",
        enriching && "discovery-search-exact-row--enriching",
        meta && "discovery-search-exact-row--with-meta",
        className
      )}
    >
      <div className="discovery-search-exact-photo-cell">
        {selectable ? (
          <span className="discovery-search-exact-select" onClick={stop}>
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label={`${selected ? "Deselect" : "Select"} ${vm.displayName}`}
            />
          </span>
        ) : null}
        <CreatorAvatarHoverTrigger
          creator={creator}
          displayName={vm.displayName}
          avatarUrl={vm.avatarUrl}
          profileUrl={vm.profileUrl}
          thinkwayStarLabel={vm.thinkwayStarLabel}
          fallbackStatusLabel={vm.updatedLabel}
          onOpenCreator={onOpenCreator}
          className="discovery-search-exact-photo-wrap"
        >
          {vm.profileUrl ? (
            <a
              href={vm.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${vm.displayName} profile`}
              className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40"
              onClick={stop}
            >
              <CreatorAvatarImage
                avatarUrl={vm.avatarUrl}
                profileUrl={vm.profileUrl}
                alt={vm.displayName}
                sizeClassName="size-[87px]"
                className="border-0 bg-[var(--surface,#f3f6fc)]"
              />
            </a>
          ) : (
            <CreatorAvatarImage
              avatarUrl={vm.avatarUrl}
              profileUrl={vm.profileUrl}
              alt={vm.displayName}
              sizeClassName="size-[87px]"
              className="border-0 bg-[var(--surface,#f3f6fc)]"
            />
          )}
          {vm.countryFlagCode ? (
            <span className="discovery-search-exact-flag">
              <CountryFlagBadge
                countryCode={vm.countryFlagCode}
                size="md"
                overlay
                className="size-full"
              />
            </span>
          ) : null}
          <span className="discovery-search-exact-star">★ {vm.thinkwayStarLabel}</span>
        </CreatorAvatarHoverTrigger>
      </div>

      <div className="discovery-search-exact-info-cell">
        <div className="discovery-search-exact-info-stack">
          <div className="discovery-search-exact-name" title={vm.displayName}>
            {vm.displayName}
          </div>
          {vm.handleLabel ? (
            <div className="discovery-search-exact-handle" title={vm.handleLabel}>
              {vm.handleLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="discovery-search-exact-category-cell">
        <InterestChips interests={vm.categories} emptyLabel="No categories" />
      </div>

      <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} />

      {showFeed ? <DiscoveryCreatorFeedThumbs publications={vm.feedPublications} /> : null}

      {meta ? (
        <div className="discovery-search-exact-meta-cell" onClick={stop}>
          {meta}
        </div>
      ) : null}

      {searchActions ? (
        <div className="discovery-search-exact-actions" onClick={stop}>
          {searchActions}
        </div>
      ) : null}
    </div>
  );
});

/** @deprecated Use DiscoveryCreatorExactRow */
export const CreatorSearchExactRow = DiscoveryCreatorExactRow;
/** @deprecated Use DiscoveryCreatorExactRowProps */
export type CreatorSearchExactRowProps = DiscoveryCreatorExactRowProps;

export function DiscoveryCreatorExactHeader({
  total,
  allSelected,
  hasCreators,
  onToggleSelectAll,
  toolbar,
  metaLabel,
  countLabel,
  showSelectAll = true,
}: {
  total: number;
  allSelected: boolean | "indeterminate";
  hasCreators: boolean;
  onToggleSelectAll: () => void;
  toolbar?: ReactNode;
  metaLabel?: ReactNode;
  countLabel?: string;
  showSelectAll?: boolean;
}) {
  const resolvedCountLabel =
    countLabel ?? `${total.toLocaleString()} Creator${total === 1 ? "" : "s"}`;

  return (
    <div className="discovery-search-exact-headers">
      <div className="discovery-search-exact-col-count">
        {showSelectAll ? (
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all loaded creators"
            disabled={!hasCreators}
          />
        ) : null}
        <span>{resolvedCountLabel}</span>
      </div>
      <span className="discovery-search-exact-col-info">Creator Name</span>
      <span className="discovery-search-exact-col-category">Category</span>
      <span className="discovery-search-exact-col-stats">Statistics</span>
      <div className="discovery-search-exact-col-feed">
        <span>Content from feed</span>
        {toolbar}
      </div>
      {metaLabel ? (
        <span className="discovery-search-exact-col-meta">{metaLabel}</span>
      ) : null}
    </div>
  );
}

/** @deprecated Use DiscoveryCreatorExactHeader */
export const CreatorSearchExactHeader = DiscoveryCreatorExactHeader;
```

#### `features/discovery/components/discovery-interest-chips.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";

export function InterestChips({
  interests,
  variant = "default",
  maxVisible = 3,
  emptyLabel = "No interests tagged",
}: {
  interests: string[];
  variant?: "default" | "compact";
  maxVisible?: number;
  emptyLabel?: string;
}) {
  if (interests.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">{emptyLabel}</span>;
  }

  const visible = interests.slice(0, maxVisible);
  const overflow = interests.length - visible.length;

  if (variant === "compact") {
    return (
      <div className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden">
        {visible.map((interest) => (
          <span
            key={interest}
            title={interest}
            className="min-w-0 max-w-[5.5rem] truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
          >
            {interest}
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={interests.slice(maxVisible).join(", ")}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {visible.map((interest) => (
        <span
          key={interest}
          title={interest}
          className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
        >
          {interest}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={interests.slice(maxVisible).join(", ")}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function RelevanceScore({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const rounded = Math.round(score);
  const bars = Math.max(1, Math.min(4, Math.ceil((rounded / 100) * 4)));
  return (
    <div className="flex items-center gap-1.5" title={`Campaign relevance ${rounded}%`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full", i < bars ? "bg-primary" : "bg-primary/20")}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-primary">{rounded}</span>
    </div>
  );
}
```

#### `features/discovery/components/discovery-creator-platform-stats.tsx`

```tsx
"use client";

import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import type {
  CreatorRecentPublication,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { formatCreatorCount, formatEngagementRate } from "./creator-search/creator-search-utils";

function FeedThumb({ publication }: { publication: CreatorRecentPublication }) {
  const src = creatorRecentPublicationDisplayUrl(publication);
  if (!src) {
    return <div className="discovery-search-exact-feed-thumb discovery-search-exact-feed-thumb--empty" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className="discovery-search-exact-feed-thumb"
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

export function DiscoveryCreatorFeedThumbs({
  publications,
}: {
  publications: CreatorRecentPublication[];
}) {
  if (publications.length === 0) {
    return (
      <div className="discovery-search-exact-feed-thumbs discovery-search-exact-feed-thumbs--empty">
        <div className="discovery-search-exact-feed-thumb discovery-search-exact-feed-thumb--empty" />
      </div>
    );
  }

  return (
    <div className="discovery-search-exact-feed-thumbs">
      {publications.map((pub, index) => (
        <FeedThumb key={`${pub.url ?? "pub"}-${index}`} publication={pub} />
      ))}
    </div>
  );
}

export function DiscoveryCreatorPlatformStatsBox({
  creator,
  platformFilter,
  isApifyAcquired,
  platformStats: platformStatsProp,
}: {
  creator?: UnifiedCreatorResult;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  platformStats?: ReturnType<typeof buildDiscoveryCreatorViewModel>["platformStats"];
}) {
  const platformStats =
    platformStatsProp ??
    (creator
      ? buildDiscoveryCreatorViewModel(creator, { platformFilter, isApifyAcquired }).platformStats
      : []);

  const rows =
    platformStats.length > 0
      ? platformStats
      : [
          {
            key: "empty",
            platform: null as string | null,
            followers: null,
            engagement: null,
            avgViews: null,
          },
        ];

  return (
    <div className="discovery-search-exact-stat-box">
      <div className="discovery-search-exact-stat-head" aria-hidden>
        <span className="discovery-search-exact-stat-platform-logo" />
        <span className="discovery-search-exact-stat-col-label">Followers</span>
        <span className="discovery-search-exact-stat-col-label">Engagement</span>
        <span className="discovery-search-exact-stat-col-label">Avg views</span>
      </div>
      <div className="discovery-search-exact-stat-platforms">
        {rows.map((row) => (
          <div key={row.key} className="discovery-search-exact-stat-platform">
            <div className="discovery-search-exact-stat-platform-logo">
              {row.platform ? (
                <PlatformIcon
                  platform={row.platform}
                  size="xs"
                  variant="logo"
                  className="!size-4"
                />
              ) : null}
            </div>
            <b className="discovery-search-exact-stat-value mono">
              {formatCreatorCount(row.followers)}
            </b>
            <b className="discovery-search-exact-stat-value mono">
              {formatEngagementRate(row.engagement)}
            </b>
            <b className="discovery-search-exact-stat-value mono">
              {formatCreatorCount(row.avgViews)}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### `features/discovery/components/discovery-creator-profile-summary.tsx`

```tsx
"use client";

import {
  buildDiscoveryCreatorViewModel,
  type DiscoveryCreatorViewModelOptions,
} from "@/features/discovery/view-models/discovery-creator-view-model";
import { useDiscoveryCreatorHoverDetails } from "@/features/discovery/hooks/use-discovery-creator-hover-details";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorDetailsSummaryCard } from "./creator-details-summary-card";

type Props = {
  creator: UnifiedCreatorResult;
  profileUrl?: string | null;
  size?: "compact" | "sheet";
  className?: string;
  onClick?: () => void;
  viewModelOptions?: DiscoveryCreatorViewModelOptions;
};

/** VM-driven profile header — shared by hover card, detail sheet, and drawer chrome. */
export function DiscoveryCreatorProfileSummary({
  creator,
  profileUrl: profileUrlOverride,
  size = "compact",
  className,
  onClick,
  viewModelOptions,
}: Props) {
  const vm = buildDiscoveryCreatorViewModel(creator, viewModelOptions);
  const { secondaryLine, statusLabel } = useDiscoveryCreatorHoverDetails(creator);

  return (
    <CreatorDetailsSummaryCard
      size={size}
      displayName={vm.displayName}
      avatarUrl={vm.avatarUrl}
      profileUrl={profileUrlOverride ?? vm.profileUrl}
      thinkwayStarLabel={vm.thinkwayStarLabel}
      secondaryLine={secondaryLine}
      statusLabel={statusLabel}
      className={className}
      onClick={onClick}
    />
  );
}
```

#### `features/discovery/components/creator-search/creator-avatar-hover-trigger.tsx`

```tsx
"use client";

import { type MouseEvent, type ReactNode } from "react";

import { useDelayedHover } from "@/lib/hooks/use-delayed-hover";
import { cn } from "@/lib/utils";

import { CreatorDetailsHoverCard } from "./creator-details-hover-card";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type CreatorAvatarHoverTriggerProps = {
  creator: UnifiedCreatorResult;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  thinkwayStarLabel: string;
  fallbackStatusLabel: string | null;
  onOpenCreator?: () => void;
  children: ReactNode;
  className?: string;
};

export function CreatorAvatarHoverTrigger({
  creator,
  displayName,
  avatarUrl,
  profileUrl,
  thinkwayStarLabel,
  fallbackStatusLabel,
  onOpenCreator,
  children,
  className,
}: CreatorAvatarHoverTriggerProps) {
  const { open, setOpen, onPointerEnter, onPointerLeave, keepOpen, scheduleClose } =
    useDelayedHover(1000);

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const openCreatorFromPreview = () => {
    setOpen(false);
    onOpenCreator?.();
  };

  return (
    <div
      className={cn("discovery-creator-avatar-hover-trigger", className)}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onFocus={onPointerEnter}
      onBlur={scheduleClose}
      onClick={stop}
    >
      {children}
      {open ? (
        <div
          className="discovery-creator-avatar-hover-trigger__panel"
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleClose}
        >
          <CreatorDetailsHoverCard
            creator={creator}
            displayName={displayName}
            avatarUrl={avatarUrl}
            profileUrl={profileUrl}
            thinkwayStarLabel={thinkwayStarLabel}
            fallbackStatusLabel={fallbackStatusLabel}
            onClick={onOpenCreator ? openCreatorFromPreview : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-details-hover-card.tsx`

```tsx
"use client";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { DiscoveryCreatorProfileSummary } from "../discovery-creator-profile-summary";

type CreatorDetailsHoverCardProps = {
  creator: UnifiedCreatorResult;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  thinkwayStarLabel: string;
  fallbackStatusLabel: string | null;
  className?: string;
  onClick?: () => void;
};

/** Hover preview card — uses shared VM + hover details hook. */
export function CreatorDetailsHoverCard({
  creator,
  className,
  onClick,
}: CreatorDetailsHoverCardProps) {
  return (
    <DiscoveryCreatorProfileSummary
      creator={creator}
      size="compact"
      className={className}
      onClick={onClick}
    />
  );
}
```


---

## 5 — Filter drawer (sheet host + panel + fields)

Right-side filter sheet. Draft filters while open; Apply commits to workspace state and triggers server browse.

#### `features/discovery/components/design-system/discovery-sheet-chrome.tsx`

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX } from "./discovery-design-tokens";

/** @deprecated Use DISCOVERY_FILTER_SHEET_CLASS — slim 360px legacy width. */
export const DISCOVERY_SHEET_CONTENT_CLASS =
  "flex h-full w-[min(360px,90vw)] max-w-[360px] flex-col border-l border-[#e2e8f0] p-0 sm:max-w-[360px]";

export const DISCOVERY_FILTER_SHEET_STYLE = {
  width: `min(${DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX}px, 100vw)`,
  maxWidth: `${DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX}px`,
} as const satisfies CSSProperties;

/** Filter drawer host — 70% of Creator Details width, matching detail sheet chrome. */
export const DISCOVERY_FILTER_SHEET_CLASS = cn(
  "discovery-filter-sheet flex flex-col gap-0 overflow-hidden border-l border-border bg-[#f8fafc] dark:bg-background p-0",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none shadow-[-8px_0_40px_rgba(15,23,42,0.1)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.35)]"
);

type DiscoveryFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  side?: "right" | "left";
  className?: string;
};

export function DiscoveryFilterSheet({
  open,
  onOpenChange,
  title = "Search filters",
  children,
  side = "right",
  className,
}: DiscoveryFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        showOverlay={false}
        style={DISCOVERY_FILTER_SHEET_STYLE}
        className={cn(DISCOVERY_FILTER_SHEET_CLASS, className)}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
```

#### `features/discovery/components/design-system/discovery-filter-drawer.tsx`

```tsx
"use client";

import {
  SearchIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const DISCOVERY_FILTER_SECTIONS_STORAGE_KEY = "discovery-search-filter-sections";

export const DISCOVERY_FILTER_DRAWER_BODY_CLASS =
  "discovery-filter-drawer-body flex min-h-0 flex-1 flex-col bg-[#eef2f8] px-4 pb-4 pt-3.5 dark:bg-muted";

export const DISCOVERY_FILTER_DRAWER_SCROLL_CLASS =
  "discovery-filter-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-[rgba(0,87,255,0.14)] bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(0,87,255,0.06)] [scrollbar-color:#e2e8f0_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#e2e8f0] dark:border-border dark:bg-card dark:shadow-none dark:[scrollbar-color:var(--border)_transparent] dark:[&::-webkit-scrollbar-thumb]:bg-border";

export function DiscoveryFilterSectionCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="discovery-filter-drawer-section__count flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0057FF] px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

export function useDiscoveryFilterSectionState(
  sectionId: string,
  defaultOpen = false
): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISCOVERY_FILTER_SECTIONS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (sectionId in parsed) setOpen(parsed[sectionId]);
    } catch {
      /* ignore malformed storage */
    }
  }, [sectionId]);

  const setSectionOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        const raw = localStorage.getItem(DISCOVERY_FILTER_SECTIONS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        parsed[sectionId] = next;
        localStorage.setItem(DISCOVERY_FILTER_SECTIONS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        /* ignore storage failures */
      }
    },
    [sectionId]
  );

  return [open, setSectionOpen];
}

type DiscoveryFilterDrawerSectionProps = {
  sectionId: string;
  title: string;
  icon?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  onClearSection?: () => void;
  children: ReactNode;
};

export function DiscoveryFilterDrawerSection({
  sectionId,
  title,
  icon,
  count = 0,
  defaultOpen = false,
  onClearSection,
  children,
}: DiscoveryFilterDrawerSectionProps) {
  const [open, setOpen] = useDiscoveryFilterSectionState(sectionId, defaultOpen);
  const modified = count > 0;

  return (
    <section
      className={cn(
        "discovery-filter-drawer-section mb-3 last:mb-0",
        modified && "discovery-filter-drawer-section--modified",
        !open && "discovery-filter-drawer-section--collapsed"
      )}
    >
      <div className="discovery-filter-drawer-section__header mb-2 flex items-stretch gap-1">
        <button
          type="button"
          className="discovery-filter-drawer-section__toggle flex min-w-0 flex-1 items-center justify-between text-left"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span className="creator-detail-sheet-section-title mb-0 min-w-0 flex-1">
            {icon ? (
              <span className="creator-detail-sheet-section-title__icon" aria-hidden>
                {icon}
              </span>
            ) : null}
            <span className="creator-detail-sheet-section-title__text">{title}</span>
            <DiscoveryFilterSectionCountBadge count={count} />
          </span>
          <span
            className={cn(
              "ml-2 shrink-0 text-[#0057FF] opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              !open && "-rotate-90"
            )}
          >
            <svg
              className="block size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </span>
        </button>
        {modified && onClearSection ? (
          <button
            type="button"
            onClick={onClearSection}
            className="discovery-filter-drawer-section__clear shrink-0 self-center px-2 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc] dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "discovery-filter-drawer-section__panel grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="discovery-filter-drawer-section__card">{children}</div>
        </div>
      </div>
    </section>
  );
}

type DiscoveryFilterActiveChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type DiscoveryFilterActiveSummaryProps = {
  chips: DiscoveryFilterActiveChip[];
  onClearAll: () => void;
};

export function DiscoveryFilterActiveSummary({
  chips,
  onClearAll,
}: DiscoveryFilterActiveSummaryProps) {
  if (chips.length === 0) return null;

  return (
    <div className="discovery-filter-drawer-active-summary mb-3 shrink-0">
      <div className="discovery-filter-drawer-active-summary__card overflow-hidden rounded-2xl border border-[rgba(0,87,255,0.2)] bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-3.5 shadow-[0_10px_32px_rgba(0,87,255,0.08),0_2px_8px_rgba(15,23,42,0.06)] dark:border-[rgba(0,87,255,0.28)] dark:bg-[linear-gradient(135deg,rgba(0,87,255,0.1)_0%,rgba(24,24,27,0.98)_100%)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.35)]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748b] dark:text-muted-foreground">
            {chips.length} active filter{chips.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc] dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className={cn(
                "group inline-flex max-w-full items-center gap-1 rounded-full border border-[rgba(0,87,255,0.18)] dark:border-[rgba(0,87,255,0.28)] bg-white dark:bg-card py-1 pr-1.5 pl-2.5",
                "text-[11px] font-medium text-[#0057FF] dark:text-blue-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10"
              )}
            >
              <span className="truncate">{chip.label}</span>
              <XIcon className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type DiscoveryFilterDrawerProps = {
  title?: string;
  onClose?: () => void;
  activeSummary?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

/** Filter workspace shell — aligned with Creator Details drawer chrome. */
export function DiscoveryFilterDrawer({
  title = "Filters",
  onClose,
  activeSummary,
  children,
  footer,
  className,
}: DiscoveryFilterDrawerProps) {
  return (
    <div
      className={cn(
        "discovery-filter-drawer flex h-full min-h-0 flex-col overflow-hidden bg-[#f8fafc] dark:bg-background",
        className
      )}
    >
      <div className="discovery-filter-drawer__header-wrap creator-detail-sheet-command-bar-wrap shrink-0 border-b border-[rgba(0,87,255,0.08)] pb-3.5 dark:border-border">
        <div className="creator-detail-sheet-command-bar">
          <div className="creator-detail-sheet-command-bar__actions">
            <div className="creator-detail-sheet-command-bar__context min-w-0">
              <SlidersHorizontalIcon
                className="creator-detail-sheet-command-bar__context-icon"
                aria-hidden
              />
              <span className="min-w-0 truncate">
                <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
                  Discovery
                </span>
                <span className="block truncate text-sm font-bold tracking-[-0.02em] text-[#0f172a] dark:text-foreground">
                  {title}
                </span>
              </span>
            </div>
            {onClose ? (
              <div className="creator-detail-sheet-command-bar__action-group">
                <button
                  type="button"
                  onClick={onClose}
                  title="Close"
                  className="creator-detail-sheet-action-btn"
                  aria-label="Close filters"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={DISCOVERY_FILTER_DRAWER_BODY_CLASS}>
        {activeSummary}
        <div className={DISCOVERY_FILTER_DRAWER_SCROLL_CLASS}>{children}</div>
      </div>

      <div className="creator-detail-sheet-footer border-t border-[rgba(0,87,255,0.08)] dark:border-[rgba(0,87,255,0.16)] bg-[#f8fafc] dark:bg-background">
        {footer}
      </div>
    </div>
  );
}

type DiscoveryFilterDrawerFooterProps = {
  onClear: () => void;
  onApply?: () => void;
  applyLabel: string;
  clearLabel?: string;
  loading?: boolean;
  disabled?: boolean;
};

export function DiscoveryFilterDrawerFooter({
  onClear,
  onApply,
  applyLabel,
  clearLabel = "Clear Filters",
  loading,
  disabled,
}: DiscoveryFilterDrawerFooterProps) {
  return (
    <div className="creator-detail-sheet-footer__actions w-full justify-between">
      <button type="button" onClick={onClear} className="creator-detail-sheet-action-btn">
        {clearLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={disabled || loading || !onApply}
        className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary min-w-[220px] flex-1 disabled:opacity-60"
      >
        {applyLabel}
      </button>
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-filter-panel.tsx`

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import {
  DiscoveryFilterActiveSummary,
  DiscoveryFilterDrawer,
  DiscoveryFilterDrawerFooter,
  DiscoveryFilterDrawerSection,
} from "@/features/discovery/components/design-system";

import {
  AiField,
  AudienceField,
  BrandSafetyField,
  CategoryField,
  CommercialPricingField,
  ContentSearchField,
  EngagementField,
  FollowerRangeField,
  LastPostField,
  LocationField,
  NameField,
  PlatformField,
} from "./creator-search-filter-fields";
import { creatorSearchFiltersUrlEqual } from "@/lib/creators/creator-search-url-params";
import {
  buildActiveFilterChips,
  clearCreatorSearchSectionFilters,
  cloneCreatorSearchFilters,
  creatorSearchSectionFilterCounts,
  type CreatorSearchFilterSectionId,
  type CreatorSearchFilters,
} from "./creator-search-types";

type Props = {
  open: boolean;
  filters: CreatorSearchFilters;
  onApply: (next: CreatorSearchFilters) => void;
  onClearAll: () => void;
  onClose?: () => void;
  loading?: boolean;
};

export function CreatorSearchFilterPanel({
  open,
  filters,
  onApply,
  onClearAll,
  onClose,
  loading,
}: Props) {
  const [draftFilters, setDraftFilters] = useState(() => cloneCreatorSearchFilters(filters));

  useEffect(() => {
    if (open) {
      setDraftFilters(cloneCreatorSearchFilters(filters));
    }
  }, [open, filters]);

  const sectionCounts = creatorSearchSectionFilterCounts(draftFilters);
  const hasDraftChanges = !creatorSearchFiltersUrlEqual(draftFilters, filters);

  const activeSummaryChips = useMemo(
    () =>
      buildActiveFilterChips(draftFilters).map((chip) => ({
        id: chip.id,
        label: chip.label,
        onRemove: () => setDraftFilters((prev) => ({ ...prev, ...chip.clear })),
      })),
    [draftFilters]
  );

  function clearSection(section: CreatorSearchFilterSectionId) {
    setDraftFilters((prev) => clearCreatorSearchSectionFilters(section, prev));
  }

  function handleApply() {
    if (hasDraftChanges) {
      onApply(cloneCreatorSearchFilters(draftFilters));
    }
    onClose?.();
  }

  function handleClearEverything() {
    onClearAll();
    setDraftFilters(cloneCreatorSearchFilters());
  }

  return (
    <DiscoveryFilterDrawer
      title="Search filters"
      onClose={onClose}
      activeSummary={
        <DiscoveryFilterActiveSummary
          chips={activeSummaryChips}
          onClearAll={handleClearEverything}
        />
      }
      footer={
        <DiscoveryFilterDrawerFooter
          onClear={handleClearEverything}
          onApply={handleApply}
          applyLabel={
            loading
              ? "Searching…"
              : hasDraftChanges
                ? "Apply filters"
                : "Show results"
          }
          clearLabel="Clear everything"
          loading={loading}
          disabled={!onClose}
        />
      }
    >
      <DiscoveryFilterDrawerSection
        sectionId="creator"
        title="Creator"
        icon={<UserIcon className="size-3" />}
        count={sectionCounts.creator}
        defaultOpen
        onClearSection={() => clearSection("creator")}
      >
        <NameField filters={draftFilters} onChange={setDraftFilters} />
        <PlatformField filters={draftFilters} onChange={setDraftFilters} />
        <CategoryField filters={draftFilters} onChange={setDraftFilters} />
        <LocationField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="search"
        title="Search"
        icon={<SearchIcon className="size-3" />}
        count={sectionCounts.search}
        onClearSection={() => clearSection("search")}
      >
        <ContentSearchField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="audience"
        title="Audience"
        icon={<UsersIcon className="size-3" />}
        count={sectionCounts.audience}
        onClearSection={() => clearSection("audience")}
      >
        <AudienceField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="performance"
        title="Performance"
        icon={<TrendingUpIcon className="size-3" />}
        count={sectionCounts.performance}
        onClearSection={() => clearSection("performance")}
      >
        <FollowerRangeField filters={draftFilters} onChange={setDraftFilters} />
        <EngagementField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="ai"
        title="AI Intelligence"
        icon={<SparklesIcon className="size-3" />}
        count={sectionCounts.ai}
        onClearSection={() => clearSection("ai")}
      >
        <AiField filters={draftFilters} onChange={setDraftFilters} />
        <BrandSafetyField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>

      <DiscoveryFilterDrawerSection
        sectionId="advanced"
        title="Advanced"
        icon={<Settings2Icon className="size-3" />}
        count={sectionCounts.advanced}
        onClearSection={() => clearSection("advanced")}
      >
        <LastPostField filters={draftFilters} onChange={setDraftFilters} />
        <CommercialPricingField filters={draftFilters} onChange={setDraftFilters} />
      </DiscoveryFilterDrawerSection>
    </DiscoveryFilterDrawer>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-filter-fields.tsx`

```tsx
"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { toggleCategoryInList } from "@/lib/creators/category-filter";
import {
  TIER_FILTER_RANGES,
  tierFilterPresetFields,
} from "@/lib/creators/influencer-tier";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

import {
  AGE_RANGE_MAX_OPTIONS,
  AGE_RANGE_OPTIONS,
  CONTENT_TAG_SUGGESTIONS,
  DISCOVERY_FILTER_COUNTRIES,
  DISCOVERY_FILTER_LANGUAGES,
  LAST_POST_WITHIN_OPTIONS,
} from "./creator-search-filter-constants";
import type { CreatorSearchFilters } from "./creator-search-types";

type FieldProps = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
};

const FOLLOWER_PRESETS = TIER_FILTER_RANGES.map((range) => ({
  id: range.id,
  label: range.label,
  ...tierFilterPresetFields(range),
}));

const ENGAGEMENT_PRESETS = ["1", "2", "3", "5"] as const;

const THINKWAY_SCORE_PRESETS = ["40", "50", "60", "70", "80"] as const;

const QUICK_CATEGORIES = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Travel",
  "Lifestyle",
  "Tech",
  "Gaming",
] as const;

const QUICK_INTERESTS = [
  "Beauty & Cosmetics",
  "Fashion",
  "Health & Wellness",
  "Food & Drink",
  "Travel",
  "Photography",
] as const;

const GENDER_OPTIONS = [
  { value: "", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "discovery-filter-field-label mb-[7px] text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="discovery-filter-field-hint mt-[5px] text-[10px] text-[#94a3b8] dark:text-muted-foreground">{children}</p>
  );
}

const filterInputClass =
  "discovery-filter-input h-9 rounded-[10px] border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card px-3 text-xs text-[#0f172a] dark:text-foreground shadow-none placeholder:text-[#94a3b8] dark:placeholder:text-muted-foreground focus-visible:border-[#0057FF] focus-visible:ring-[3px] focus-visible:ring-[rgba(0,87,255,0.12)]";

const filterAddButtonClass =
  "discovery-filter-add-btn inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card text-[#94a3b8] dark:text-muted-foreground transition-all duration-120 hover:border-[#0057FF] hover:bg-[#0057FF] hover:text-white disabled:opacity-40";

const filterChipInactiveClass =
  "border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card text-[#475569] dark:text-muted-foreground hover:border-[rgba(0,87,255,0.24)] hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#0057FF] dark:hover:text-blue-300";

const FILTER_CHIP_PREVIEW_COUNT = 6;

function ExpandableChipGrid<T>({
  items,
  previewCount = FILTER_CHIP_PREVIEW_COUNT,
  getKey,
  isHighlighted,
  renderChip,
}: {
  items: readonly T[];
  previewCount?: number;
  getKey: (item: T) => string;
  isHighlighted?: (item: T) => boolean;
  renderChip: (item: T) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = isHighlighted ?? (() => false);

  const visibleItems = expanded
    ? items
    : items.filter((item, index) => index < previewCount || isActive(item));

  const hiddenCount = items.filter(
    (item, index) => index >= previewCount && !isActive(item)
  ).length;

  if (items.length <= previewCount) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Fragment key={getKey(item)}>{renderChip(item)}</Fragment>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((item) => (
          <Fragment key={getKey(item)}>{renderChip(item)}</Fragment>
        ))}
      </div>
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc]"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </>
  );
}

export function FilterInput(props: React.ComponentProps<typeof Input>) {
  return <Input className={cn(filterInputClass, props.className)} {...props} />;
}

export function FilterSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select className={cn(filterInputClass, "cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function FilterChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "discovery-filter-chip inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[20px] border px-2.5 text-[11px] font-medium transition-all duration-[140ms]",
        active
          ? "border-[rgba(0,87,255,0.32)] bg-[rgba(0,87,255,0.1)] font-semibold text-[#0057FF] dark:text-blue-300"
          : "border-[rgba(0,87,255,0.14)] dark:border-border bg-white dark:bg-card text-[#475569] dark:text-muted-foreground hover:border-[rgba(0,87,255,0.24)] hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#0057FF] dark:hover:text-blue-300"
      )}
    >
      <span>{label}</span>
      {active ? (
        <span className="ml-px text-[12px] leading-none text-[#0057FF]">×</span>
      ) : (
        <span className="ml-px flex size-3.5 items-center justify-center rounded-full bg-[rgba(0,87,255,0.1)] text-[10px] font-bold text-[#0057FF]">
          +
        </span>
      )}
    </button>
  );
}

export function PlatformFilterChip({
  platform,
  active,
  onToggle,
}: {
  platform: string;
  active: boolean;
  onToggle: () => void;
}) {
  const label = PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "discovery-filter-platform-chip inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-2.5 text-[11px] font-semibold transition-all duration-[140ms]",
        active
          ? "border-[rgba(0,87,255,0.38)] bg-[rgba(0,87,255,0.1)] text-[#0057FF] shadow-[0_1px_3px_rgba(0,87,255,0.12)]"
          : filterChipInactiveClass
      )}
    >
      <PlatformIcon platform={platform} size="xs" variant="logo" className="size-5 shrink-0" />
      <span>{label}</span>
      {active ? (
        <XIcon className="size-3 shrink-0 opacity-70" aria-hidden />
      ) : (
        <PlusIcon className="size-3 shrink-0 text-[#0057FF] opacity-50" aria-hidden />
      )}
    </button>
  );
}

export function RatePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "discovery-filter-rate-pill inline-flex h-7 shrink-0 items-center rounded-[10px] border px-3 text-[11px] font-semibold transition-all duration-[140ms]",
        active
          ? "border-[#0057FF] bg-[#0057FF] text-white"
          : filterChipInactiveClass
      )}
    >
      {label}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)]",
        className
      )}
      role="group"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value || "any"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 border-r border-[rgba(0,87,255,0.12)] dark:border-[rgba(0,87,255,0.2)] px-2 py-[7px] text-center text-[11px] font-medium transition-colors last:border-r-0",
              selected
                ? "bg-[rgba(0,87,255,0.1)] font-semibold text-[#0057FF] dark:text-blue-300"
                : "text-[#94a3b8] dark:text-muted-foreground hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#475569] dark:hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RangeRow({
  min,
  max,
  onMinChange,
  onMaxChange,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
  type = "text",
}: {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  type?: "text" | "number";
}) {
  return (
    <div className="flex items-center gap-2">
      <FilterInput
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={minPlaceholder}
        type={type}
        className="flex-1"
      />
      <span className="shrink-0 text-xs text-[#94a3b8]">—</span>
      <FilterInput
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder={maxPlaceholder}
        type={type}
        className="flex-1"
      />
    </div>
  );
}

function ClearLink({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="text-[10px] font-medium text-[#0057FF] underline-offset-2 hover:text-[#0046cc] hover:underline"
    >
      Clear
    </button>
  );
}

function FieldGroup({
  label,
  onClear,
  showClear,
  children,
  className,
}: {
  label: string;
  onClear?: () => void;
  showClear?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "discovery-filter-field-group border-t border-[rgba(0,87,255,0.1)] pt-5 first:border-t-0 first:pt-0",
        className
      )}
    >
      <div className="mb-[7px] flex items-center justify-between gap-2">
        <FieldLabel className="mb-0">{label}</FieldLabel>
        {showClear && onClear ? <ClearLink onClear={onClear} /> : null}
      </div>
      {children}
    </div>
  );
}

function toggleInList(list: string[], value: string, normalize?: (value: string) => string) {
  const key = normalize ? normalize(value) : value;
  const has = list.some((entry) => (normalize ? normalize(entry) : entry) === key);
  if (has) {
    return list.filter((entry) => (normalize ? normalize(entry) : entry) !== key);
  }
  return [...list, key];
}

function CountryPillGrid({
  selected,
  onChange,
  draft,
  onDraftChange,
  placeholder,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  placeholder: string;
}) {
  function addDraftCountry() {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (selected.includes(code)) {
      onDraftChange("");
      return;
    }
    onChange([...selected, code]);
    onDraftChange("");
  }

  return (
    <>
      <div className="mb-2 flex gap-1.5">
        <FilterInput
          value={draft}
          onChange={(e) => onDraftChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraftCountry();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addDraftCountry}
          disabled={!draft.trim()}
          className={filterAddButtonClass}
          aria-label="Add country"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <FilterChip
              key={code}
              label={DISCOVERY_FILTER_COUNTRIES.find((entry) => entry.code === code)?.label ?? code}
              active
              onToggle={() => onChange(selected.filter((value) => value !== code))}
            />
          ))}
        </div>
      ) : null}
      <ExpandableChipGrid
        items={DISCOVERY_FILTER_COUNTRIES}
        previewCount={6}
        getKey={({ code }) => code}
        isHighlighted={({ code }) => selected.includes(code)}
        renderChip={({ code, label }) => (
          <FilterChip
            label={label}
            active={selected.includes(code)}
            onToggle={() => onChange(toggleInList(selected, code))}
          />
        )}
      />
    </>
  );
}

function LanguagePillGrid({
  selected,
  onChange,
  draft,
  onDraftChange,
  placeholder,
  label,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  function addDraftLanguage() {
    const code = draft.trim().toLowerCase();
    if (!code) return;
    if (selected.some((entry) => entry.toLowerCase() === code)) {
      onDraftChange("");
      return;
    }
    onChange([...selected, code]);
    onDraftChange("");
  }

  return (
    <>
      <div className="mb-2 flex gap-1.5">
        <FilterInput
          value={draft}
          onChange={(e) => onDraftChange(e.target.value.toLowerCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraftLanguage();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
          aria-label={label ?? "Language code"}
        />
        <button
          type="button"
          onClick={addDraftLanguage}
          disabled={!draft.trim()}
          className={filterAddButtonClass}
          aria-label="Add language"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <FilterChip
              key={code}
              label={
                DISCOVERY_FILTER_LANGUAGES.find((entry) => entry.code === code)?.label ?? code
              }
              active
              onToggle={() => onChange(selected.filter((value) => value !== code))}
            />
          ))}
        </div>
      ) : null}
      <ExpandableChipGrid
        items={DISCOVERY_FILTER_LANGUAGES}
        previewCount={6}
        getKey={({ code }) => code}
        isHighlighted={({ code }) => selected.includes(code)}
        renderChip={({ code, label: langLabel }) => (
          <FilterChip
            label={langLabel}
            active={selected.includes(code)}
            onToggle={() => onChange(toggleInList(selected, code, (value) => value.toLowerCase()))}
          />
        )}
      />
    </>
  );
}

export function ContentSearchField({ filters, onChange }: FieldProps) {
  const [draftTag, setDraftTag] = useState("");
  const [draftContentLanguage, setDraftContentLanguage] = useState("");

  function addDraftTag() {
    const value = draftTag.trim().replace(/^#+/, "");
    if (!value) return;
    if (filters.contentTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setDraftTag("");
      return;
    }
    onChange({ ...filters, contentTags: [...filters.contentTags, value] });
    setDraftTag("");
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel className="mb-0">Advanced search</FieldLabel>
        <button
          type="button"
          role="switch"
          aria-checked={filters.advancedSearch}
          onClick={() => onChange({ ...filters, advancedSearch: !filters.advancedSearch })}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
            filters.advancedSearch
              ? "border-[#0057FF] bg-[#0057FF]"
              : "border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-[#f1f5f9] dark:bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
              filters.advancedSearch ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      <FieldGroup label="Keyword / hashtag" className="mt-3">
        <FilterInput
          value={filters.contentKeyword}
          onChange={(e) => onChange({ ...filters, contentKeyword: e.target.value })}
          placeholder="e.g. travel, #beauty"
        />
        <div className="mt-2">
          <ExpandableChipGrid
            items={CONTENT_TAG_SUGGESTIONS}
            previewCount={3}
            getKey={(tag) => tag}
            isHighlighted={(tag) =>
              filters.contentTags.some((selected) => selected.toLowerCase() === tag.toLowerCase())
            }
            renderChip={(tag) => (
              <FilterChip
                label={tag.startsWith("#") ? tag : `#${tag}`}
                active={filters.contentTags.some(
                  (selected) => selected.toLowerCase() === tag.toLowerCase()
                )}
                onToggle={() =>
                  onChange({
                    ...filters,
                    contentTags: toggleInList(filters.contentTags, tag, (value) =>
                      value.toLowerCase()
                    ),
                  })
                }
              />
            )}
          />
        </div>
      </FieldGroup>

      {filters.advancedSearch ? (
        <FieldGroup label="Add hashtag">
          <div className="flex gap-1.5">
            <FilterInput
              value={draftTag}
              onChange={(e) => setDraftTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraftTag();
                }
              }}
              placeholder="Custom tag…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={addDraftTag}
              disabled={!draftTag.trim()}
              className={filterAddButtonClass}
              aria-label="Add hashtag"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>
        </FieldGroup>
      ) : null}

      <FieldGroup
        label="Content language"
        showClear={filters.contentLanguages.length > 0}
        onClear={() => onChange({ ...filters, contentLanguages: [] })}
      >
        <LanguagePillGrid
          selected={filters.contentLanguages}
          onChange={(contentLanguages) => onChange({ ...filters, contentLanguages })}
          draft={draftContentLanguage}
          onDraftChange={setDraftContentLanguage}
          placeholder="ISO code e.g. en"
          label="Content language code"
        />
      </FieldGroup>

    </>
  );
}

export function LastPostField({ filters, onChange }: FieldProps) {
  return (
    <FieldGroup label="Last post within" className="mt-0">
      <FilterSelect
        value={filters.lastPostWithin}
        onChange={(e) => onChange({ ...filters, lastPostWithin: e.target.value })}
        aria-label="Last post within"
      >
        {LAST_POST_WITHIN_OPTIONS.map((option) => (
          <option key={option.value || "any"} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>
      <FieldHint>Filters creators with synced recent publication dates when available.</FieldHint>
    </FieldGroup>
  );
}

export function BrandSafetyField({ filters, onChange }: FieldProps) {
  return (
    <FieldGroup label="Min. brand safety score" className="mt-0">
      <FilterInput
        value={filters.minBrandSafety}
        onChange={(e) => onChange({ ...filters, minBrandSafety: e.target.value })}
        type="number"
        placeholder="60"
      />
    </FieldGroup>
  );
}

export function CommercialPricingField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FieldGroup label="Pricing range (USD)" className="mt-0">
        <RangeRow
          min={filters.minEstimatedCost}
          max={filters.maxEstimatedCost}
          onMinChange={(value) => onChange({ ...filters, minEstimatedCost: value })}
          onMaxChange={(value) => onChange({ ...filters, maxEstimatedCost: value })}
          type="number"
        />
      </FieldGroup>
      <FieldGroup label="Exclusivity">
        <div className="flex flex-wrap gap-1.5">
          {MOCKUP_CHIP_LABELS.exclusivity.map((label) => (
            <MockupChip key={label} label={label} />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Contract status">
        <div className="flex flex-wrap gap-1.5">
          {MOCKUP_CHIP_LABELS.contractStatus.map((label) => (
            <MockupChip key={label} label={label} />
          ))}
        </div>
      </FieldGroup>
    </>
  );
}

export function PlatformField({ filters, onChange }: FieldProps) {
  function toggle(platform: string) {
    const set = new Set(filters.platforms);
    if (set.has(platform)) set.delete(platform);
    else set.add(platform);
    onChange({ ...filters, platforms: [...set] });
  }
  return (
    <FieldGroup
      label="Social platform"
      showClear={filters.platforms.length > 0}
      onClear={() => onChange({ ...filters, platforms: [] })}
    >
      <ExpandableChipGrid
        items={DISCOVERY_PLATFORMS}
        previewCount={4}
        getKey={(platform) => platform}
        isHighlighted={(platform) => filters.platforms.includes(platform)}
        renderChip={(platform) => (
          <PlatformFilterChip
            platform={platform}
            active={filters.platforms.includes(platform)}
            onToggle={() => toggle(platform)}
          />
        )}
      />
    </FieldGroup>
  );
}

export function FollowerRangeField({ filters, onChange }: FieldProps) {
  const activePreset = FOLLOWER_PRESETS.find(
    (p) => p.min === filters.minFollowers && p.max === filters.maxFollowers
  );
  function applyPreset(preset: (typeof FOLLOWER_PRESETS)[number]) {
    if (activePreset?.id === preset.id) {
      onChange({ ...filters, minFollowers: "", maxFollowers: "" });
    } else {
      onChange({ ...filters, minFollowers: preset.min, maxFollowers: preset.max });
    }
  }
  return (
    <FieldGroup
      label="Follower range"
      showClear={Boolean(filters.minFollowers || filters.maxFollowers)}
      onClear={() => onChange({ ...filters, minFollowers: "", maxFollowers: "" })}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FOLLOWER_PRESETS.map((preset) => (
          <FilterChip
            key={preset.id}
            label={preset.label}
            active={activePreset?.id === preset.id}
            onToggle={() => applyPreset(preset)}
          />
        ))}
      </div>
      <RangeRow
        min={filters.minFollowers}
        max={filters.maxFollowers}
        onMinChange={(value) => onChange({ ...filters, minFollowers: value })}
        onMaxChange={(value) => onChange({ ...filters, maxFollowers: value })}
        type="number"
      />
      <FieldHint>Custom follower range</FieldHint>
    </FieldGroup>
  );
}

export function EngagementField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FieldGroup label="Minimum engagement rate">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ENGAGEMENT_PRESETS.map((value) => (
            <RatePill
              key={value}
              label={`${value}%+`}
              active={filters.minEngagement === value}
              onToggle={() =>
                onChange({
                  ...filters,
                  minEngagement: filters.minEngagement === value ? "" : value,
                })
              }
            />
          ))}
        </div>
        <FilterInput
          value={filters.minEngagement}
          onChange={(e) => onChange({ ...filters, minEngagement: e.target.value })}
          type="number"
          placeholder="Custom %"
        />
      </FieldGroup>
      <FieldGroup label="Minimum average views">
        <FilterInput
          value={filters.minViews}
          onChange={(e) => onChange({ ...filters, minViews: e.target.value })}
          type="number"
          placeholder="e.g. 10000"
        />
      </FieldGroup>
    </>
  );
}

export function LocationField({ filters, onChange }: FieldProps) {
  const [draftCountry, setDraftCountry] = useState("");
  const [draftLanguage, setDraftLanguage] = useState("");

  return (
    <>
      <FieldGroup label="Creator country">
        <CountryPillGrid
          selected={filters.countries}
          onChange={(countries) => onChange({ ...filters, countries })}
          draft={draftCountry}
          onDraftChange={setDraftCountry}
          placeholder="ISO code e.g. EG"
        />
      </FieldGroup>
      <FieldGroup
        label="Language"
        showClear={filters.languages.length > 0}
        onClear={() => onChange({ ...filters, languages: [] })}
      >
        <LanguagePillGrid
          selected={filters.languages}
          onChange={(languages) => onChange({ ...filters, languages })}
          draft={draftLanguage}
          onDraftChange={setDraftLanguage}
          placeholder="ISO code e.g. en"
          label="Creator language code"
        />
      </FieldGroup>
      <FieldGroup label="Verification">
        <FilterSelect disabled aria-label="Verification (coming soon)" className="cursor-not-allowed opacity-60">
          <option>Any</option>
          <option>Verified</option>
          <option>Unverified</option>
        </FilterSelect>
      </FieldGroup>
    </>
  );
}

export function CategoryField({ filters, onChange }: FieldProps) {
  const [draftCategory, setDraftCategory] = useState("");

  function addDraftCategory() {
    const value = draftCategory.trim();
    if (!value) return;
    if (filters.categories.includes(value)) {
      setDraftCategory("");
      return;
    }
    onChange({ ...filters, categories: [...filters.categories, value] });
    setDraftCategory("");
  }

  const customCategories = filters.categories.filter(
    (category) =>
      !QUICK_CATEGORIES.some((quick) => quick.toLowerCase() === category.toLowerCase())
  );

  return (
    <>
      <FieldGroup label="Category">
        <div className="mb-2 flex gap-1.5">
          <FilterInput
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraftCategory();
              }
            }}
            placeholder="Add category…"
            className="flex-1"
          />
          <button
            type="button"
            onClick={addDraftCategory}
            disabled={!draftCategory.trim()}
            className={filterAddButtonClass}
            aria-label="Add category"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        {customCategories.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {customCategories.map((category) => (
              <span
                key={category}
                className="inline-flex h-6 items-center gap-[5px] rounded-[8px] border border-[rgba(0,87,255,0.24)] bg-[rgba(0,87,255,0.08)] px-2 text-[11px] font-medium text-[#0057FF]"
              >
                {category}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filters,
                      categories: filters.categories.filter((value) => value !== category),
                    })
                  }
                  className="flex size-3.5 items-center justify-center rounded-full bg-[rgba(0,87,255,0.12)] text-[10px] text-[#0057FF] transition-colors hover:bg-[rgba(0,87,255,0.22)]"
                  aria-label={`Remove ${category}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <ExpandableChipGrid
          items={QUICK_CATEGORIES}
          previewCount={4}
          getKey={(category) => category}
          isHighlighted={(category) =>
            filters.categories.some(
              (selected) => selected.toLowerCase() === category.toLowerCase()
            )
          }
          renderChip={(category) => (
            <FilterChip
              label={category}
              active={filters.categories.some(
                (selected) => selected.toLowerCase() === category.toLowerCase()
              )}
              onToggle={() =>
                onChange({
                  ...filters,
                  categories: toggleCategoryInList(filters.categories, category),
                })
              }
            />
          )}
        />
      </FieldGroup>
    </>
  );
}

const MOCKUP_CHIP_LABELS = {
  exclusivity: ["None", "Full", "Partial"],
  contractStatus: ["Active", "Expired", "None"],
} as const;

function MockupChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[20px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card px-2.5 text-[11px] font-medium text-[#475569] dark:text-muted-foreground">
      <span>{label}</span>
      <span className="ml-px flex size-3.5 items-center justify-center rounded-full bg-[rgba(0,87,255,0.1)] text-[10px] font-bold text-[#0057FF]">
        +
      </span>
    </span>
  );
}

export function AudienceField({ filters, onChange }: FieldProps) {
  const [draftAudienceCountry, setDraftAudienceCountry] = useState("");
  const [draftInterest, setDraftInterest] = useState("");

  function addDraftInterest() {
    const value = draftInterest.trim();
    if (!value) return;
    if (
      filters.audienceInterestTags.some(
        (tag) => tag.toLowerCase() === value.toLowerCase()
      )
    ) {
      setDraftInterest("");
      return;
    }
    onChange({ ...filters, audienceInterestTags: [...filters.audienceInterestTags, value] });
    setDraftInterest("");
  }

  return (
    <>
      <FieldGroup label="Audience country" className="mt-0">
        <CountryPillGrid
          selected={filters.audienceCountries}
          onChange={(audienceCountries) => onChange({ ...filters, audienceCountries })}
          draft={draftAudienceCountry}
          onDraftChange={setDraftAudienceCountry}
          placeholder="ISO code e.g. AE"
        />
      </FieldGroup>

      <FieldGroup label="Gender">
        <FilterSelect
          value={filters.gender.toLowerCase()}
          onChange={(e) => onChange({ ...filters, gender: e.target.value })}
          aria-label="Audience gender"
        >
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value || "any"} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
        <FieldHint>Applied when audience demographic data is available on the creator.</FieldHint>
      </FieldGroup>

      <FieldGroup label="Age range">
        <div className="flex items-center gap-2">
          <FilterSelect
            value={filters.ageMin}
            onChange={(e) => onChange({ ...filters, ageMin: e.target.value })}
            aria-label="Minimum audience age"
            className="flex-1"
          >
            {AGE_RANGE_OPTIONS.map((option) => (
              <option key={`min-${option.value || "any"}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <span className="shrink-0 text-xs text-[#94a3b8]">to</span>
          <FilterSelect
            value={filters.ageMax}
            onChange={(e) => onChange({ ...filters, ageMax: e.target.value })}
            aria-label="Maximum audience age"
            className="flex-1"
          >
            {AGE_RANGE_MAX_OPTIONS.map((option) => (
              <option key={`max-${option.value || "any"}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </div>
        <FieldHint>Requires enriched audience age distribution (future backend filter).</FieldHint>
      </FieldGroup>

      <FieldGroup label="Audience interests">
        <div className="mb-2 flex gap-1.5">
          <FilterInput
            value={draftInterest}
            onChange={(e) => setDraftInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraftInterest();
              }
            }}
            placeholder="Add topic…"
            className="flex-1"
          />
          <button
            type="button"
            onClick={addDraftInterest}
            disabled={!draftInterest.trim()}
            className={filterAddButtonClass}
            aria-label="Add audience interest"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        {filters.audienceInterestTags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {filters.audienceInterestTags.map((interest) => (
              <FilterChip
                key={interest}
                label={interest}
                active
                onToggle={() =>
                  onChange({
                    ...filters,
                    audienceInterestTags: filters.audienceInterestTags.filter(
                      (value) => value !== interest
                    ),
                  })
                }
              />
            ))}
          </div>
        ) : null}
        <ExpandableChipGrid
          items={QUICK_INTERESTS}
          previewCount={4}
          getKey={(interest) => interest}
          isHighlighted={(interest) =>
            filters.audienceInterestTags.some(
              (selected) => selected.toLowerCase() === interest.toLowerCase()
            )
          }
          renderChip={(interest) => (
            <FilterChip
              label={interest}
              active={filters.audienceInterestTags.some(
                (selected) => selected.toLowerCase() === interest.toLowerCase()
              )}
              onToggle={() =>
                onChange({
                  ...filters,
                  audienceInterestTags: toggleInList(
                    filters.audienceInterestTags,
                    interest,
                    (value) => value.toLowerCase()
                  ),
                })
              }
            />
          )}
        />
      </FieldGroup>
    </>
  );
}

export function CommercialField({ filters, onChange }: FieldProps) {
  return (
    <>
      <CommercialPricingField filters={filters} onChange={onChange} />
      <BrandSafetyField filters={filters} onChange={onChange} />
    </>
  );
}

export function AiField({ filters, onChange }: FieldProps) {
  return (
    <>
      <FieldGroup label="Minimum Thinkway score" className="mt-0">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {THINKWAY_SCORE_PRESETS.map((value) => (
            <RatePill
              key={value}
              label={`${value}+`}
              active={filters.minThinkwayScore === value}
              onToggle={() =>
                onChange({
                  ...filters,
                  minThinkwayScore: filters.minThinkwayScore === value ? "" : value,
                })
              }
            />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Brand fit category">
        <FilterInput
          value={filters.aiNiche}
          onChange={(e) => onChange({ ...filters, aiNiche: e.target.value })}
          placeholder="e.g. Camera & Photography"
        />
      </FieldGroup>
      <FieldGroup label="Source confidence">
        <RangeRow
          min={filters.minBrandFit}
          max={filters.minAiScore}
          onMinChange={(value) => onChange({ ...filters, minBrandFit: value })}
          onMaxChange={(value) => onChange({ ...filters, minAiScore: value })}
          minPlaceholder="Min %"
          maxPlaceholder="Max %"
          type="number"
        />
      </FieldGroup>
    </>
  );
}

export function NameField({ filters, onChange }: FieldProps) {
  return (
    <FieldGroup label="Search by handle or name">
      <FilterInput
        value={filters.handle}
        onChange={(e) => onChange({ ...filters, handle: e.target.value })}
        placeholder="@username"
      />
    </FieldGroup>
  );
}

/** @deprecated Use FilterChip — kept for filter bar compatibility */
export function TogglePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return <FilterChip label={label} active={active} onToggle={onToggle} />;
}
```


---

## 6 — Bulk selection flyout (N selected action bar)

Fixed bottom bar when rows are selected. Search wraps it via CreatorSearchBulkBar.

#### `features/discovery/components/design-system/discovery-selection-flyout.tsx`

```tsx
"use client";

import { MoreHorizontalIcon, XIcon } from "lucide-react";
import type { LucideIcon } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DiscoverySelectionFlyoutAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
};

type DiscoverySelectionFlyoutProps = {
  open: boolean;
  selectedCount: number;
  entityLabel: string;
  actions: DiscoverySelectionFlyoutAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  selectableCount?: number;
  busy?: boolean;
  emptyActionsMessage?: string;
  maxVisibleActions?: number;
};

export const DISCOVERY_SELECTION_FLYOUT_CONTENT_CLASS =
  "pb-[4.5rem] max-md:pb-[4rem]";

export function discoverySelectionFlyoutContentClass(open: boolean, className?: string) {
  return cn(open && DISCOVERY_SELECTION_FLYOUT_CONTENT_CLASS, className);
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function partitionActions(
  actions: DiscoverySelectionFlyoutAction[],
  maxSecondary: number
): {
  primary: DiscoverySelectionFlyoutAction | undefined;
  secondary: DiscoverySelectionFlyoutAction[];
  overflow: DiscoverySelectionFlyoutAction[];
} {
  if (actions.length === 0) {
    return { primary: undefined, secondary: [], overflow: [] };
  }

  const explicitPrimary = actions.find(
    (action) => action.variant === "primary" || action.variant === undefined
  );
  const primary = explicitPrimary ?? actions[0];
  const rest = actions.filter((action) => action.id !== primary.id);

  const secondary: DiscoverySelectionFlyoutAction[] = [];
  const overflow: DiscoverySelectionFlyoutAction[] = [];

  for (const action of rest) {
    if (
      secondary.length < maxSecondary &&
      !action.destructive &&
      (action.variant === "outline" || action.variant === "ghost")
    ) {
      secondary.push(action);
    } else {
      overflow.push(action);
    }
  }

  return { primary, secondary, overflow };
}

function DiscoveryFlyoutDivider() {
  return (
    <div
      className="discovery-selection-flyout__divider mx-0.5 hidden h-5 w-px shrink-0 bg-[rgba(0,87,255,0.14)] sm:block"
      aria-hidden
    />
  );
}

/** Bulk selection flyout — Discovery command-bar chrome (Search, Shortlists). */
export function DiscoverySelectionFlyout({
  open,
  selectedCount,
  entityLabel,
  actions,
  onClearSelection,
  onSelectAll,
  selectableCount,
  busy,
  emptyActionsMessage,
  maxVisibleActions = 2,
}: DiscoverySelectionFlyoutProps) {
  const visible = open && selectedCount > 0;
  const { primary, secondary, overflow } = partitionActions(
    actions,
    Math.max(0, maxVisibleActions - 1)
  );

  const showSelectAll =
    onSelectAll != null &&
    selectableCount != null &&
    selectableCount > 0 &&
    selectedCount < selectableCount;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4",
        "max-md:bottom-4 max-md:pb-[env(safe-area-inset-bottom,0px)]"
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "discovery-selection-flyout pointer-events-auto w-max max-w-[min(calc(100vw-2rem),720px)] transition-all duration-300 ease-out",
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
        role="toolbar"
        aria-label="Selection actions"
      >
        <div className="discovery-selection-flyout__bar flex min-w-0 items-center gap-1.5 overflow-x-auto px-2.5 py-2 sm:gap-2 sm:px-3">
          <div className="flex shrink-0 items-center gap-1.5 pr-0.5">
            <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b] dark:text-muted-foreground">
              <span className="tabular-nums text-[#0057FF]">{selectedCount}</span>{" "}
              {pluralize(selectedCount, entityLabel)} selected
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={busy}
              className="discovery-selection-flyout__clear flex size-7 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card text-[#64748b] dark:text-muted-foreground transition-colors hover:border-[rgba(0,87,255,0.24)] hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#0057FF] dark:hover:text-blue-300 disabled:opacity-50"
              aria-label="Clear selection"
            >
              <XIcon className="size-3.5" />
            </button>
            {showSelectAll ? (
              <button
                type="button"
                onClick={onSelectAll}
                disabled={busy}
                className="hidden shrink-0 text-[11px] font-medium text-[#0057FF] hover:text-[#0046cc] sm:inline-flex"
              >
                Select all
              </button>
            ) : null}
          </div>

          {primary || secondary.length > 0 || overflow.length > 0 || emptyActionsMessage ? (
            <>
              <DiscoveryFlyoutDivider />
              <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
                {primary ? (
                  <DiscoveryFlyoutPrimaryButton action={primary} busy={busy} />
                ) : null}
                {secondary.map((action) => (
                  <DiscoveryFlyoutSecondaryButton key={action.id} action={action} busy={busy} />
                ))}
                {overflow.length > 0 ? (
                  <DiscoveryFlyoutOverflowMenu actions={overflow} busy={busy} />
                ) : null}
                {!primary &&
                secondary.length === 0 &&
                overflow.length === 0 &&
                emptyActionsMessage ? (
                  <span className="shrink-0 text-[11px] text-[#64748b] dark:text-muted-foreground">{emptyActionsMessage}</span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DiscoveryFlyoutPrimaryButton({
  action,
  busy,
}: {
  action: DiscoverySelectionFlyoutAction;
  busy?: boolean;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || busy || action.loading}
      className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {action.label}
    </button>
  );
}

function DiscoveryFlyoutSecondaryButton({
  action,
  busy,
}: {
  action: DiscoverySelectionFlyoutAction;
  busy?: boolean;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || busy}
      className="creator-detail-sheet-action-btn inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-xs disabled:opacity-50"
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="hidden sm:inline">{action.label}</span>
    </button>
  );
}

function DiscoveryFlyoutOverflowMenu({
  actions,
  busy,
}: {
  actions: DiscoverySelectionFlyoutAction[];
  busy?: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <>
      <DiscoveryFlyoutDivider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="creator-detail-sheet-action-btn size-8 shrink-0 px-0 text-[#64748b] hover:text-[#0057FF]"
            disabled={busy}
            aria-label="More actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="discovery-selection-flyout-menu min-w-[11.5rem] w-auto rounded-2xl border border-[rgba(0,87,255,0.2)] bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] p-1.5 shadow-[0_10px_32px_rgba(0,87,255,0.12),0_2px_8px_rgba(15,23,42,0.06)] ring-0"
        >
          <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b]">
            More actions
          </DropdownMenuLabel>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                disabled={action.disabled || busy}
                variant={action.destructive ? "destructive" : "default"}
                onClick={action.onClick}
                className="discovery-selection-flyout-menu__item gap-2 rounded-[10px] px-2.5 py-2 text-xs font-medium text-[#334155] focus:bg-[rgba(0,87,255,0.08)] focus:text-[#0057FF] data-[variant=destructive]:focus:bg-red-50 data-[variant=destructive]:focus:text-red-600 [&_svg]:size-3.5 [&_svg]:text-[#64748b] focus:[&_svg]:text-[#0057FF]"
              >
                {Icon ? <Icon aria-hidden /> : null}
                <span className="whitespace-nowrap">{action.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
```

#### `features/discovery/components/creator-search/creator-search-bulk-bar.tsx`

```tsx
"use client";

import {
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  PlusIcon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";

import {
  DiscoverySelectionFlyout,
  type DiscoverySelectionFlyoutAction,
} from "@/features/discovery/components/design-system";

type Props = {
  selectedCount: number;
  onClearSelection: () => void;
  onAddToList: () => void;
  onCreateList: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
  onAiMatch: () => void;
  onGenerateQuotation: () => void;
  onRefreshMetrics?: () => void;
  onStopRefresh?: () => void;
  stopRefreshDisabled?: boolean;
  busy?: boolean;
};

export function CreatorSearchBulkBar({
  selectedCount,
  onClearSelection,
  onAddToList,
  onCreateList,
  onCompare,
  onExport,
  onShare,
  onAiMatch,
  onGenerateQuotation,
  onRefreshMetrics,
  onStopRefresh,
  stopRefreshDisabled,
  busy,
}: Props) {
  const actions: DiscoverySelectionFlyoutAction[] = [
    {
      id: "add",
      label: "Add to list",
      icon: ListPlusIcon,
      variant: "primary",
      disabled: busy,
      onClick: onAddToList,
    },
    {
      id: "create-list",
      label: "Create list",
      icon: PlusIcon,
      variant: "outline",
      disabled: busy,
      onClick: onCreateList,
    },
    {
      id: "refresh-metrics",
      label: "Refresh Metrics",
      icon: RefreshCwIcon,
      variant: "outline",
      disabled: busy || !onRefreshMetrics,
      onClick: () => onRefreshMetrics?.(),
    },
    {
      id: "stop-refresh",
      label: "Stop refresh",
      icon: SquareIcon,
      variant: "outline",
      disabled: busy || stopRefreshDisabled || !onStopRefresh,
      onClick: () => onStopRefresh?.(),
    },
    {
      id: "compare",
      label: "Compare",
      icon: GitCompareArrowsIcon,
      variant: "outline",
      onClick: onCompare,
    },
    {
      id: "export",
      label: "Export",
      icon: DownloadIcon,
      variant: "outline",
      onClick: onExport,
    },
    {
      id: "share",
      label: "Share",
      icon: Share2Icon,
      variant: "outline",
      onClick: onShare,
    },
    {
      id: "quotation",
      label: "Generate quotation",
      icon: FileTextIcon,
      variant: "outline",
      disabled: busy,
      onClick: onGenerateQuotation,
    },
    {
      id: "ai-match",
      label: "AI Match",
      icon: SparklesIcon,
      variant: "outline",
      onClick: onAiMatch,
    },
  ];

  return (
    <DiscoverySelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={3}
    />
  );
}
```


---

## 7 — Row overflow menu (⋯ actions)

Per-row DiscoveryCreatorActionsMenu used inside exact rows.

#### `features/discovery/components/discovery-creator-actions-menu.tsx`

```tsx
"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  ListPlusIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { DeleteDiscoveryCreatorDialog } from "@/features/discovery/delete-creator/delete-discovery-creator-dialog";
import { isEnrichmentInProgress, resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import { PlatformIcon, PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { cn } from "@/lib/utils";

/** Extracted from creator_action_menu_light.html / creator_action_menu.html */
const MENU = {
  width: "220px",
  radius: "12px",
  itemPadding: "11px 16px",
  itemGap: "12px",
  iconBadge: { size: "30px", radius: "8px", iconSize: "14px" },
  title: { size: "12px", weight: 600, marginBottom: "1px" },
  subtitle: { size: "10px" },
  trailingIcon: { size: "12px", strokeWidth: 2 },
  checkbox: { size: "16px", radius: "4px", borderWidth: "1.5px" },
  light: {
    bg: "#ffffff",
    border: "#e2e8f0",
    shadow: "0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.05)",
    divider: "#f1f5f9",
    title: "#0f172a",
    subtitle: "#94a3b8",
    trailingStroke: "#cbd5e1",
    checkboxBorder: "#e2e8f0",
    hover: "#f8fafc",
    active: "#f1f5f9",
    badges: {
      viewDetails: { bg: "#eff6ff", icon: "#3b82f6" },
      addToList: { bg: "#ecfdf5", icon: "#10b981" },
      select: { bg: "#fffbeb", icon: "#f59e0b" },
      stopRefresh: { bg: "#fff7ed", icon: "#f97316" },
      refreshMetrics: { bg: "#eff6ff", icon: "#3b82f6" },
      delete: { bg: "#fef2f2", icon: "#ef4444" },
    },
  },
  dark: {
    bg: "#0f1117",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
    divider: "rgba(255,255,255,0.06)",
    title: "#ffffff",
    subtitle: "rgba(255,255,255,0.35)",
    trailingStroke: "rgba(255,255,255,0.25)",
    checkboxBorder: "rgba(255,255,255,0.2)",
    hover: "rgba(255,255,255,0.05)",
    active: "rgba(255,255,255,0.08)",
    badges: {
      viewDetails: { bg: "rgba(99,102,241,0.15)", icon: "#818cf8" },
      addToList: { bg: "rgba(16,185,129,0.15)", icon: "#34d399" },
      select: { bg: "rgba(245,158,11,0.15)", icon: "#fbbf24" },
      stopRefresh: { bg: "rgba(249,115,22,0.15)", icon: "#fb923c" },
      refreshMetrics: { bg: "rgba(99,102,241,0.15)", icon: "#818cf8" },
      delete: { bg: "rgba(239,68,68,0.15)", icon: "#f87171" },
    },
  },
  instagramGradient: "linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)",
} as const;

type MenuBadgeVariant = "viewDetails" | "addToList" | "select" | "stopRefresh" | "refreshMetrics" | "delete";

type DiscoveryActionMenuItemProps = {
  title: string;
  subtitle: ReactNode;
  icon: ReactNode;
  iconStyle?: React.CSSProperties;
  iconClassName?: string;
  trailing?: "external" | "chevron" | "checkbox";
  checked?: boolean;
  showDivider?: boolean;
};

function DiscoveryActionMenuItem({
  title,
  subtitle,
  icon,
  iconStyle,
  iconClassName,
  trailing = "chevron",
  checked = false,
  showDivider = true,
}: DiscoveryActionMenuItemProps) {
  return (
    <span
      className={cn(
        "flex w-full items-center",
        showDivider && "border-b border-[#f1f5f9] dark:border-white/[0.06]"
      )}
      style={{ gap: MENU.itemGap, padding: MENU.itemPadding }}
    >
      <span
        className={cn("flex shrink-0 items-center justify-center", iconClassName)}
        style={{
          width: MENU.iconBadge.size,
          height: MENU.iconBadge.size,
          borderRadius: MENU.iconBadge.radius,
          ...iconStyle,
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className="block font-semibold text-[#0f172a] dark:text-white"
          style={{
            fontSize: MENU.title.size,
            marginBottom: MENU.title.marginBottom,
          }}
        >
          {title}
        </span>
        <span
          className="block text-[#94a3b8] dark:text-white/[0.35]"
          style={{ fontSize: MENU.subtitle.size }}
        >
          {subtitle}
        </span>
      </span>
      <span className="flex shrink-0 items-center justify-center">
        {trailing === "external" ? (
          <ExternalLinkIcon
            aria-hidden
            className="text-[#cbd5e1] dark:text-white/25"
            style={{ width: MENU.trailingIcon.size, height: MENU.trailingIcon.size }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ) : null}
        {trailing === "chevron" ? (
          <ChevronRightIcon
            aria-hidden
            className="text-[#cbd5e1] dark:text-white/25"
            style={{ width: MENU.trailingIcon.size, height: MENU.trailingIcon.size }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ) : null}
        {trailing === "checkbox" ? (
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center border-[#e2e8f0] dark:border-white/20",
              checked && "border-[#1D9E75] bg-[#1D9E75] text-white"
            )}
            style={{
              width: MENU.checkbox.size,
              height: MENU.checkbox.size,
              borderRadius: MENU.checkbox.radius,
              borderWidth: MENU.checkbox.borderWidth,
            }}
          >
            {checked ? (
              <CheckIcon
                style={{ width: "10px", height: "10px" }}
                strokeWidth={3}
              />
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const menuItemClassName = cn(
  "rounded-none px-0 py-0 text-sm font-normal outline-none transition-colors duration-100",
  "focus:bg-[#f8fafc] data-[highlighted]:bg-[#f8fafc] active:bg-[#f1f5f9]",
  "dark:focus:bg-white/[0.05] dark:data-[highlighted]:bg-white/[0.05] dark:active:bg-white/[0.08]"
);

function InstagramGlyph() {
  return (
    <svg
      aria-hidden
      width={MENU.iconBadge.iconSize}
      height={MENU.iconBadge.iconSize}
      fill="#fff"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function badgeClassName(variant: MenuBadgeVariant): string {
  return cn(
    variant === "viewDetails" && "bg-[#eff6ff] dark:bg-[rgba(99,102,241,0.15)]",
    variant === "addToList" && "bg-[#ecfdf5] dark:bg-[rgba(16,185,129,0.15)]",
    variant === "select" && "bg-[#fffbeb] dark:bg-[rgba(245,158,11,0.15)]",
    variant === "stopRefresh" && "bg-[#fff7ed] dark:bg-[rgba(249,115,22,0.15)]",
    variant === "refreshMetrics" && "bg-[#eff6ff] dark:bg-[rgba(99,102,241,0.15)]",
    variant === "delete" && "bg-[#fef2f2] dark:bg-[rgba(239,68,68,0.15)]"
  );
}

function iconColorClass(variant: MenuBadgeVariant): string {
  return cn(
    variant === "viewDetails" && "text-[#3b82f6] dark:text-[#818cf8]",
    variant === "addToList" && "text-[#10b981] dark:text-[#34d399]",
    variant === "select" && "text-[#f59e0b] dark:text-[#fbbf24]",
    variant === "stopRefresh" && "text-[#f97316] dark:text-[#fb923c]",
    variant === "refreshMetrics" && "text-[#3b82f6] dark:text-[#818cf8]",
    variant === "delete" && "text-[#ef4444] dark:text-[#f87171]"
  );
}

function MenuIcon({
  variant,
  children,
}: {
  variant: MenuBadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={iconColorClass(variant)}
      style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
    >
      {children}
    </span>
  );
}
function normalizePlatformKey(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (value === "ig") return "instagram";
  if (value === "tt") return "tiktok";
  if (value === "yt") return "youtube";
  if (value === "fb") return "facebook";
  if (value === "sc") return "snapchat";
  return value;
}

function PlatformMenuIcon({ platform }: { platform: string }) {
  const key = normalizePlatformKey(platform);

  if (key === "instagram") {
    return <InstagramGlyph />;
  }

  const style = PLATFORM_ICON_STYLES[key];
  if (style?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={style.imageUrl}
        alt=""
        style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
        className="object-contain"
      />
    );
  }

  return <PlatformIcon platform={platform} size="xs" className="size-[14px] rounded-md" />;
}

function platformMenuIconStyle(platform: string): React.CSSProperties {
  const key = normalizePlatformKey(platform);
  if (key === "instagram") {
    return { background: MENU.instagramGradient };
  }
  const style = PLATFORM_ICON_STYLES[key];
  return style ? {} : { background: "#f1f5f9" };
}

function platformMenuIconClassName(platform: string): string {
  const key = normalizePlatformKey(platform);
  if (key === "instagram") return "";
  return PLATFORM_ICON_STYLES[key]?.className ?? "bg-[#f1f5f9] dark:bg-white/10";
}

export type DiscoveryCreatorActionsMenuProps = {
  creator: UnifiedCreatorResult;
  profileUrl: string | null;
  selected: boolean;
  onOpenCreator: () => void;
  onAddToList?: () => void;
  onToggleSelect: () => void;
  onRefreshMetrics?: (platformAccountId?: string | null) => void;
  onStopRefresh?: () => void;
  onCreatorDeleted?: () => void;
  addLabel?: string;
};

export function DiscoveryCreatorActionsMenu({
  creator,
  profileUrl,
  selected,
  onOpenCreator,
  onAddToList,
  onToggleSelect,
  onRefreshMetrics,
  onStopRefresh,
  onCreatorDeleted,
  addLabel = "Add",
}: DiscoveryCreatorActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const platforms = sortPlatformsStable(creator.platforms);
  const metricsPlatform =
    platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ?? platforms[0];
  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const refreshInProgress = isEnrichmentInProgress(enrichmentStatus);
  const platformName = metricsPlatform ? platformLabel(metricsPlatform.platform) : "profile";
  const openTitle = metricsPlatform ? `Open on ${platformName}` : "Open profile";

  const menuItems: Array<{
    key: string;
    content: DiscoveryActionMenuItemProps;
    onSelect?: () => void;
    href?: string;
  }> = [];

  if (profileUrl) {
    menuItems.push({
      key: "open-profile",
      href: profileUrl,
      content: {
        title: openTitle,
        subtitle: (
          <>
            <span className="dark:hidden">View creator profile</span>
            <span className="hidden dark:inline">View profile</span>
          </>
        ),
        icon: metricsPlatform ? (
          <PlatformMenuIcon platform={metricsPlatform.platform} />
        ) : (
          <ExternalLinkIcon
            aria-hidden
            className="text-white"
            style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ),
        iconStyle: metricsPlatform
          ? platformMenuIconStyle(metricsPlatform.platform)
          : { background: MENU.instagramGradient },
        iconClassName: metricsPlatform ? platformMenuIconClassName(metricsPlatform.platform) : undefined,
        trailing: "external",
      },
    });
  }

  menuItems.push({
    key: "view-details",
    onSelect: onOpenCreator,
    content: {
      title: "View details",
      subtitle: "Full creator profile",
      icon: (
        <MenuIcon variant="viewDetails">
          <EyeIcon strokeWidth={2} className="size-full" aria-hidden />
        </MenuIcon>
      ),
      iconClassName: badgeClassName("viewDetails"),
      trailing: "chevron",
    },
  });

  if (refreshInProgress && onStopRefresh) {
    menuItems.push({
      key: "stop-refresh",
      onSelect: onStopRefresh,
      content: {
        title: "Stop refresh",
        subtitle:
          enrichmentStatus === "queued"
            ? "Waiting in queue"
            : enrichmentStatus === "running"
              ? "Collecting metrics…"
              : "Cancel in-progress sync",
        icon: (
          <MenuIcon variant="stopRefresh">
            <Loader2Icon strokeWidth={2} className="size-full animate-spin" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("stopRefresh"),
        trailing: "chevron",
      },
    });
  } else if (onRefreshMetrics) {
    menuItems.push({
      key: "refresh-metrics-submenu",
      content: {
        title: "Refresh metrics",
        subtitle: "Update followers & engagement",
        icon: (
          <MenuIcon variant="refreshMetrics">
            <RefreshCwIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("refreshMetrics"),
        trailing: "chevron",
      },
    });
  }

  if (onAddToList) {
    menuItems.push({
      key: "add-to-list",
      onSelect: onAddToList,
      content: {
        title: `${addLabel} to list`,
        subtitle: "Save to shortlist",
        icon: (
          <MenuIcon variant="addToList">
            <PlusIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("addToList"),
        trailing: "chevron",
      },
    });
  }

  if (creator.influencer_id) {
    menuItems.push({
      key: "delete-creator",
      onSelect: () => setDeleteOpen(true),
      content: {
        title: "Delete from Discovery",
        subtitle: "Remove when not linked to campaigns or lists",
        icon: (
          <MenuIcon variant="delete">
            <Trash2Icon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("delete"),
        trailing: "chevron",
      },
    });
  }

  menuItems.push({
    key: "select",
    onSelect: onToggleSelect,
    content: {
      title: selected ? "Deselect" : "Select",
      subtitle: selected ? "Remove from selection" : "Add to selection",
      icon: (
        <MenuIcon variant="select">
          <CheckIcon strokeWidth={2} className="size-full" aria-hidden />
        </MenuIcon>
      ),
      iconClassName: badgeClassName("select"),
      trailing: "checkbox",
      checked: selected,
    },
  });

  const lastIndex = menuItems.length - 1;

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {onAddToList ? (
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary lg:inline-flex"
          onClick={onAddToList}
        >
          <ListPlusIcon className="size-3.5" />
          {addLabel}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className={cn(
            "min-w-0 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white p-0 ring-0",
            "shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_4px_rgba(15,23,42,0.05)]",
            "dark:border-white/10 dark:bg-[#0f1117]",
            "dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]"
          )}
          style={{ width: MENU.width }}
        >
          {menuItems.map((item, index) => {
            const itemContent = {
              ...item.content,
              showDivider: index < lastIndex,
            };

            if (item.key === "refresh-metrics-submenu" && onRefreshMetrics) {
              return (
                <DropdownMenuSub key={item.key}>
                  <DropdownMenuSubTrigger className={menuItemClassName}>
                    <DiscoveryActionMenuItem {...itemContent} />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[180px] rounded-xl border border-border bg-popover p-1 shadow-lg">
                    {platforms.map((platform) => (
                      <DropdownMenuItem
                        key={platform.id}
                        className="gap-2 rounded-lg text-xs"
                        onSelect={() => onRefreshMetrics(platform.id)}
                      >
                        <PlatformIcon platform={platform.platform} size="xs" className="size-4 rounded-full" />
                        {platformLabel(platform.platform)}
                      </DropdownMenuItem>
                    ))}
                    {platforms.length > 1 ? (
                      <DropdownMenuItem
                        className="gap-2 rounded-lg text-xs font-medium"
                        onSelect={() => onRefreshMetrics(null)}
                      >
                        <RefreshCwIcon className="size-3.5" aria-hidden />
                        Refresh all
                      </DropdownMenuItem>
                    ) : platforms.length === 1 ? (
                      <DropdownMenuItem
                        className="gap-2 rounded-lg text-xs"
                        onSelect={() => onRefreshMetrics(platforms[0]!.id)}
                      >
                        <RefreshCwIcon className="size-3.5" aria-hidden />
                        Refresh
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }

            if (item.href) {
              return (
                <DropdownMenuItem key={item.key} asChild className={menuItemClassName}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    <DiscoveryActionMenuItem {...itemContent} />
                  </a>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                key={item.key}
                className={menuItemClassName}
                onSelect={item.onSelect}
              >
                <DiscoveryActionMenuItem {...itemContent} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {creator.influencer_id ? (
        <DeleteDiscoveryCreatorDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          creator={creator}
          onDeleted={onCreatorDeleted}
        />
      ) : null}
    </div>
  );
}
```


---

## 8 — App sidebar (shared shell)

Collapsible sidebar used on every dashboard route including Discovery Search.

#### `components/layout/collapsible-app-sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BrainIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronRightIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  HomeIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  ListIcon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PercentIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  SendIcon,
  TagsIcon,
  TargetIcon,
  UploadIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { UserAccount } from "@/components/layout/user-account";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";
import {
  APP_SIDEBAR_WIDTH_COLLAPSED,
  APP_SIDEBAR_WIDTH_CSS_VAR,
  APP_SIDEBAR_WIDTH_EXPANDED,
  getAppSidebarLayoutWidth,
  resolveAppSidebarExpanded,
} from "@/lib/layout/app-sidebar-width";
import { cn } from "@/lib/utils";

type NavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavSubheaderItem = {
  kind: "subheader";
  label: string;
};

type NavEntry = NavLinkItem | NavSubheaderItem;

type NavGroupIconTone = "blue" | "violet" | "teal" | "amber" | "navy";

type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconTone: NavGroupIconTone;
  items: NavEntry[];
};

type NavRailItem = {
  groupLabel: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const GROUP_ICON_TONE_CLASS: Record<NavGroupIconTone, string> = {
  blue: "thinkway-sidebar-grp-icon",
  violet: "thinkway-sidebar-grp-icon",
  teal: "thinkway-sidebar-grp-icon",
  amber: "thinkway-sidebar-grp-icon",
  navy: "thinkway-sidebar-grp-icon",
};

/** Global nav order — overview, workspace, commercial, finance, insights, admin. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboardIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/", label: "Home", icon: LayoutDashboardIcon },
      { kind: "link", href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    label: "Workspace",
    icon: MegaphoneIcon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { kind: "link", href: "/studio", label: "Studio", icon: LayoutDashboardIcon },
      { kind: "link", href: "/ai", label: "Campaign AI", icon: SparklesIcon },
    ],
  },
  {
    label: "Discovery",
    icon: SearchIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/discovery/search", label: "Search", icon: SearchIcon },
      { kind: "link", href: "/discovery/shortlists", label: "Shortlists", icon: ListIcon },
      {
        kind: "link",
        href: "/discovery/quotations",
        label: "Client Quotations",
        icon: FileTextIcon,
      },
      {
        kind: "link",
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: TargetIcon,
      },
      { kind: "link", href: "/discovery/import", label: "Import Center", icon: UploadIcon },
    ],
  },
  {
    label: "Clients and vendors CRM",
    icon: UsersIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/groups", label: "Holding Groups", icon: LayersIcon },
      { kind: "link", href: "/clients", label: "Clients", icon: Building2Icon },
      { kind: "link", href: "/brands", label: "Brands", icon: SparklesIcon },
      { kind: "link", href: "/vendors", label: "Vendors", icon: UsersIcon },
    ],
  },
  {
    label: "Commercial",
    icon: FileSignatureIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/ios/vendor", label: "Vendor IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/billing", label: "Billing", icon: ReceiptIcon },
      { kind: "link", href: "/finance/po-tracker", label: "PO Tracker", icon: ReceiptIcon },
    ],
  },
  {
    label: "Finance",
    icon: WalletIcon,
    iconTone: "amber",
    items: [
      { kind: "subheader", label: "Billing & documents" },
      { kind: "link", href: "/finance/invoices", label: "Invoices", icon: FileTextIcon },
      {
        kind: "link",
        href: "/finance/client-credit-notes",
        label: "Client credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/client-debit-notes",
        label: "Client debit notes",
        icon: CirclePlusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-credit-notes",
        label: "Vendor credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-debit-notes",
        label: "Vendor debit notes",
        icon: CirclePlusIcon,
      },
      { kind: "subheader", label: "Treasury & cash" },
      { kind: "link", href: "/collections", label: "Collections", icon: CoinsIcon },
      { kind: "link", href: "/treasury", label: "Treasury", icon: WalletIcon },
      { kind: "link", href: "/finance/posting-center", label: "Posting center", icon: SendIcon },
      { kind: "subheader", label: "Compliance & planning" },
      { kind: "link", href: "/finance/vat", label: "VAT & Tax", icon: PercentIcon },
      { kind: "link", href: "/finance/exchange-rates", label: "Exchange rates", icon: RefreshCwIcon },
      { kind: "link", href: "/finance/periods", label: "Periods", icon: CalendarRangeIcon },
      { kind: "link", href: "/planning", label: "Planning", icon: CalendarClockIcon },
      { kind: "subheader", label: "Move from Acc to another" },
      { kind: "link", href: "/operations/move", label: "Move", icon: ArrowRightLeftIcon },
      {
        kind: "link",
        href: "/operations/reassignment",
        label: "Reassignment",
        icon: ArrowRightLeftIcon,
      },
    ],
  },
  {
    label: "Insights",
    icon: BarChart3Icon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/reports", label: "Reports", icon: BarChart3Icon },
      // Intelligence — gated by INTELLIGENCE_ARCHIVED (see docs/INTELLIGENCE_ARCHIVE.md)
      ...(isIntelligenceEnabled()
        ? [{ kind: "link" as const, href: "/intelligence", label: "Intelligence", icon: BrainIcon }]
        : []),
      { kind: "link", href: "/links", label: "Link Generator", icon: Link2Icon },
    ],
  },
  {
    label: "Administration",
    icon: Settings2Icon,
    iconTone: "navy",
    items: [
      { kind: "link", href: "/settings/users", label: "Users", icon: Settings2Icon },
      { kind: "link", href: "/settings/roles", label: "Roles", icon: UserCogIcon },
      { kind: "link", href: "/settings/permissions", label: "Permissions", icon: ShieldIcon },
      {
        kind: "link",
        href: "/settings/access-control",
        label: "Access Control",
        icon: ShieldIcon,
      },
      { kind: "link", href: "/settings/client-access", label: "Client Access", icon: UsersIcon },
      {
        kind: "link",
        href: "/settings/client-classification-review",
        label: "Classification Review",
        icon: TagsIcon,
      },
      { kind: "link", href: "/settings/email", label: "Email", icon: Settings2Icon },
      { kind: "link", href: "/system/health", label: "System Health", icon: ActivityIcon },
    ],
  },
];

const ALL_GROUP_LABELS = navGroups.map((g) => g.label);
const STORAGE_EXPANDED = "thinkway-sidebar-expanded";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups";

const RAIL_PRIMARY_HREF: Record<string, string> = {
  Overview: "/",
  Workspace: "/campaigns",
  Discovery: "/discovery/search",
  "Clients and vendors CRM": "/clients",
  Commercial: "/ios/client",
  Finance: "/finance/invoices",
  Insights: "/reports",
  Administration: "/settings/users",
};

const RAIL_LABEL: Record<string, string> = {
  "Clients and vendors CRM": "Clients & vendors",
};

/** Clearer rail glyphs — aligned to section meaning. */
const RAIL_ICON_OVERRIDE: Partial<
  Record<string, ComponentType<{ className?: string }>>
> = {
  Overview: HomeIcon,
};

/** Legacy section labels from pre-reorg sidebar — map into current groups. */
const LEGACY_COLLAPSED_LABEL_MAP: Record<string, string[]> = {
  Organization: ["Workspace", "Clients and vendors CRM", "Administration"],
  Clients: ["Clients and vendors CRM"],
  Operations: ["Finance"],
  System: ["Administration"],
};

function getNavLinks(group: NavGroup): NavLinkItem[] {
  return group.items.filter((item): item is NavLinkItem => item.kind === "link");
}

function buildNavRailItems(): NavRailItem[] {
  return navGroups.map((group) => ({
    groupLabel: group.label,
    href: RAIL_PRIMARY_HREF[group.label] ?? getNavLinks(group)[0]?.href ?? "/",
    label: RAIL_LABEL[group.label] ?? group.label,
    icon: RAIL_ICON_OVERRIDE[group.label] ?? group.icon,
  }));
}

const navRailItems = buildNavRailItems();

function migrateCollapsedGroups(stored: Set<string>): Set<string> {
  const migrated = new Set<string>();
  let hadLegacy = false;

  for (const label of stored) {
    const mapped = LEGACY_COLLAPSED_LABEL_MAP[label];
    if (mapped) {
      hadLegacy = true;
      for (const next of mapped) migrated.add(next);
    } else if (ALL_GROUP_LABELS.includes(label)) {
      migrated.add(label);
    }
  }

  if (hadLegacy && typeof window !== "undefined") {
    localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...migrated]));
  }

  return migrated;
}

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isRailItemActive(pathname: string, groupLabel: string): boolean {
  const group = navGroups.find((entry) => entry.label === groupLabel);
  if (!group) return false;
  return getNavLinks(group).some((item) => isItemActive(pathname, item.href));
}

function SidebarRailTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="border-[#e2e8f0] bg-[#111827] px-2.5 py-1.5 text-[12px] font-medium text-white"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function findActiveGroupLabel(pathname: string): string | null {
  for (const group of navGroups) {
    if (getNavLinks(group).some((item) => isItemActive(pathname, item.href))) {
      return group.label;
    }
  }
  return null;
}

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set(ALL_GROUP_LABELS);
  try {
    const raw = localStorage.getItem(STORAGE_COLLAPSED_GROUPS);
    if (!raw) return new Set(ALL_GROUP_LABELS);
    const parsed = JSON.parse(raw) as string[];
    return migrateCollapsedGroups(new Set(parsed));
  } catch {
    return new Set(ALL_GROUP_LABELS);
  }
}

function readSidebarExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_EXPANDED);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function initialCollapsedGroups(pathname: string): Set<string> {
  const next = new Set(ALL_GROUP_LABELS);
  const active = findActiveGroupLabel(pathname);
  if (active) next.delete(active);
  return next;
}

export function CollapsibleAppSidebar({ userEmail }: CollapsibleAppSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    initialCollapsedGroups(pathname)
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setExpanded(readSidebarExpanded());
    const hasStored = localStorage.getItem(STORAGE_COLLAPSED_GROUPS) !== null;
    if (hasStored) {
      const stored = readCollapsedGroups();
      const next = new Set(stored);
      const active = findActiveGroupLabel(pathname);
      if (active) next.delete(active);
      setCollapsedGroups(next);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const activeGroup = findActiveGroupLabel(pathname);
    if (!activeGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup);
      localStorage.setItem(
        STORAGE_COLLAPSED_GROUPS,
        JSON.stringify([...next])
      );
      return next;
    });
  }, [pathname, hydrated]);

  const persistExpanded = useCallback((value: boolean) => {
    setExpanded(value);
    localStorage.setItem(STORAGE_EXPANDED, String(value));
  }, []);

  const displayExpanded = resolveAppSidebarExpanded(expanded);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      APP_SIDEBAR_WIDTH_CSS_VAR,
      getAppSidebarLayoutWidth(displayExpanded)
    );
  }, [displayExpanded, hydrated]);

  const sidebarWidth = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const sidebarControlButtonClass =
    "flex size-8 items-center justify-center rounded-lg border-none bg-transparent text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-primary active:scale-95";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="relative hidden shrink-0 self-stretch overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-0 md:block md:h-full md:max-h-full"
        style={{ width: sidebarWidth }}
      >
        <aside
          className={cn(
            "thinkway-app-sidebar absolute flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
            !displayExpanded && "thinkway-app-sidebar--rail"
          )}
          style={{
            left: 0,
            top: 0,
            height: "100%",
            width: sidebarWidth,
          }}
        >
          <div
            className={cn(
              "flex items-center",
              displayExpanded
                ? "gap-3 border-b border-sidebar-border px-5 pb-4 pt-5"
                : "justify-center border-b border-sidebar-border px-2 pb-3 pt-5"
            )}
          >
            <Link href="/" className="min-w-0 shrink-0" title="Thinkway">
              <ThinkwayLogo showText={displayExpanded} compact className="mb-0" />
            </Link>
            {displayExpanded ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span aria-hidden className="h-6 w-px shrink-0 bg-[#e2e8f0] dark:bg-border" />
                <SidebarRailTooltip label="Collapse to icons">
                  <button
                    type="button"
                    onClick={() => persistExpanded(false)}
                    className={sidebarControlButtonClass}
                    aria-label="Collapse to icons"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </button>
                </SidebarRailTooltip>
              </div>
            ) : null}
          </div>

          {!displayExpanded ? (
            <nav
              aria-label="Primary"
              className="thinkway-app-sidebar-rail flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-4"
            >
              {navRailItems.map((item) => {
                const active = isRailItemActive(pathname, item.groupLabel);
                const Icon = item.icon;
                return (
                  <SidebarRailTooltip key={item.groupLabel} label={item.label}>
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "thinkway-app-sidebar-rail-link flex size-10 items-center justify-center rounded-lg transition-colors duration-150",
                        active
                          ? "thinkway-app-sidebar-rail-link--active bg-[var(--sidebar-active-bg)] text-primary dark:text-blue-400"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-primary dark:hover:text-blue-400"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0 stroke-[1.85]" />
                    </Link>
                  </SidebarRailTooltip>
                );
              })}

              <div className="min-h-3 flex-1" aria-hidden />

              <SidebarRailTooltip label="Expand sidebar">
                <button
                  type="button"
                  onClick={() => persistExpanded(true)}
                  className={sidebarControlButtonClass}
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpenIcon className="size-4" />
                </button>
              </SidebarRailTooltip>
            </nav>
          ) : (
            <nav className="thinkway-app-sidebar-nav flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3">
              {navGroups.map((group, groupIndex) => {
                const groupCollapsed = collapsedGroups.has(group.label);
                const GroupIcon = group.icon;

                return (
                  <div
                    key={group.label}
                    className={cn(
                      "thinkway-app-sidebar-section flex flex-col",
                      groupIndex > 0 && "mt-3 border-t border-sidebar-border pt-3"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="thinkway-app-sidebar-section-head flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
                      aria-expanded={!groupCollapsed}
                      aria-label={`${groupCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                    >
                      <span className={GROUP_ICON_TONE_CLASS[group.iconTone]}>
                        <GroupIcon className="size-4 stroke-[1.75] text-sidebar-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.08em] text-sidebar-muted-foreground uppercase">
                        {group.label}
                      </span>
                      <ChevronRightIcon
                        className={cn(
                          "size-3.5 shrink-0 text-sidebar-muted-foreground/70 transition-transform duration-200",
                          !groupCollapsed && "rotate-90"
                        )}
                      />
                    </button>

                    <div
                      className={cn(
                        "thinkway-app-sidebar-section-items mt-1 ml-3 flex flex-col border-l border-sidebar-border pl-2",
                        groupCollapsed && "hidden"
                      )}
                    >
                      {group.items.map((item) => {
                        if (item.kind === "subheader") {
                          return (
                            <div
                              key={`subheader-${item.label}`}
                              className="px-2 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.07em] text-sidebar-muted-foreground uppercase"
                            >
                              {item.label}
                            </div>
                          );
                        }

                        const active = isItemActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={cn(
                              "thinkway-app-sidebar-link flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors duration-150",
                              active
                                ? "thinkway-app-sidebar-link--active bg-[var(--sidebar-active-bg)] text-primary dark:text-blue-400"
                                : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4 shrink-0 stroke-[1.75]",
                                active ? "text-primary dark:text-blue-400" : "text-sidebar-muted-foreground"
                              )}
                            />
                            <span
                              className={cn(
                                "truncate",
                                active && "font-semibold text-primary dark:text-blue-400"
                              )}
                            >
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          )}

          <div
            className={cn(
              "bg-sidebar",
              displayExpanded
                ? "border-t border-sidebar-border px-4 py-3"
                : "flex justify-center border-t border-sidebar-border px-2 pb-4 pt-1"
            )}
          >
            {displayExpanded ? (
              <UserAccount email={userEmail} />
            ) : (
              <UserAccount email={userEmail} compact />
            )}
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
```

#### `components/layout/dashboard-sidebar-auth.tsx`

```tsx
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { getAuthUser } from "@/lib/supabase/server";

export async function DashboardSidebarAuth() {
  const { user } = await getAuthUser();

  return <CollapsibleAppSidebar userEmail={user?.email ?? null} />;
}
```

#### `lib/layout/app-sidebar-width.ts`

```ts
/** Matches `--rail: 266px` in Thinkway_Client_Form final.html. */
export const APP_SIDEBAR_WIDTH_EXPANDED = "16.625rem";
export const APP_SIDEBAR_WIDTH_COLLAPSED = "4rem";
export const APP_SIDEBAR_WIDTH_HIDDEN = "0px";
export const APP_SIDEBAR_MARGIN = "0px";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Full sidebar panel vs icon rail — driven only by user collapse preference. */
export function resolveAppSidebarExpanded(userExpanded: boolean): boolean {
  return userExpanded;
}

/** Sidebar is always visible on desktop (no auto-hide). */
export function resolveAppSidebarVisible(): boolean {
  return true;
}

/** Layout width for main content offset. */
export function getAppSidebarLayoutWidth(displayExpanded: boolean): string {
  const base = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  return `calc(${base} + ${APP_SIDEBAR_MARGIN})`;
}

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
```

#### `lib/hooks/use-delayed-hover.ts`

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 2000;
const CLOSE_DELAY_MS = 120;

export function useDelayedHover(delayMs = DEFAULT_DELAY_MS) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const onPointerEnter = useCallback(() => {
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => setOpen(true), delayMs);
  }, [clearCloseTimer, clearOpenTimer, delayMs]);

  const onPointerLeave = useCallback(() => {
    clearOpenTimer();
    scheduleClose();
  }, [clearOpenTimer, scheduleClose]);

  const keepOpen = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearOpenTimer]);

  return {
    open,
    setOpen,
    onPointerEnter,
    onPointerLeave,
    keepOpen,
    scheduleClose,
  };
}
```


---

## 9 — Discovery design tokens (Tailwind class constants)

Shared Discovery class constants — not duplicated in thinkway-design-tokens.css.

#### `features/discovery/components/design-system/discovery-design-tokens.ts`

```ts
/**
 * Discovery platform design tokens — single source for class constants.
 * Golden reference: Discovery Search (`discovery-search-exact-*`, DiscoveryPageShell list variant).
 */

export {
  DISCOVERY_LIST_CARD_CLASS,
  DISCOVERY_TABLE_CELL_CLASS,
  DISCOVERY_TABLE_HEAD_CLASS,
  DISCOVERY_TABLE_ROW_CLASS,
  DiscoveryListCard,
} from "@/features/discovery/components/discovery-list-primitives";

/** List-variant page canvas (lavender scroll region). */
export const DISCOVERY_LIST_CANVAS_CLASS =
  "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background";

/** Embedded filter bar inside a list card. */
export const DISCOVERY_FILTER_BAR_CLASS =
  "flex flex-wrap items-center gap-2.5 border-b border-[var(--tw-border)] bg-background px-4 py-3.5";

/** Standalone filter bar (outside card). */
export const DISCOVERY_FILTER_BAR_STANDALONE_CLASS =
  "flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2";

/** Card section header strip (Import, list modules). */
export const DISCOVERY_SECTION_HEADER_CLASS =
  "border-b border-[var(--tw-border)] bg-muted/30 px-4 py-3.5";

/** Page header title — matches DiscoveryPageHeader. */
export const DISCOVERY_PAGE_TITLE_CLASS =
  "text-[18px] font-extrabold tracking-[-0.3px] text-[var(--text)] dark:text-foreground";

export const DISCOVERY_PAGE_DESC_CLASS = "mt-px text-xs text-[var(--text-3)]";

/** In-card section title. */
export const DISCOVERY_SECTION_TITLE_CLASS = "text-[12.5px] font-bold text-foreground";

export const DISCOVERY_SECTION_DESC_CLASS =
  "mt-0.5 max-w-2xl text-xs leading-relaxed text-[var(--text-3)]";

/** Exact-search toolbar row container. */
export const DISCOVERY_TOOLBAR_ROW_CLASS = "discovery-search-exact-toolbar";

/** Creator Details drawer max width (px) — keep in sync with `creator-detail-sheet.tsx`. */
export const CREATOR_DETAIL_SHEET_MAX_WIDTH_PX = 690;

/** Similar creators rail inside Creator Details (px). */
export const CREATOR_DETAIL_SHEET_SIMILAR_RAIL_WIDTH_PX = 210;

/** Discovery filter drawer = Creator Details width − 30%. */
export const DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX = Math.round(
  CREATOR_DETAIL_SHEET_MAX_WIDTH_PX * 0.7
);
```

#### `features/discovery/components/design-system/index.ts`

```ts
/**
 * Discovery platform design system — golden reference: Discovery Search.
 * Import from here for new Discovery UI; do not duplicate patterns per page.
 */

export * from "./discovery-design-tokens";
export * from "./discovery-toolbar";
export * from "./discovery-empty-state";
export * from "./discovery-loading-state";
export * from "./discovery-filter-bar";
export * from "./discovery-section-header";
export * from "./discovery-filtered-empty-state";
export * from "./discovery-selection-flyout";
export * from "./discovery-filter-drawer";
export * from "./discovery-sheet-chrome";
export * from "./discovery-workspace-chrome";
export * from "./discovery-dialog-chrome";
export * from "./discovery-search-skeleton";
export {
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
  CreatorSearchExactHeader,
  CreatorSearchExactRow,
  type DiscoveryCreatorExactRowProps,
  type CreatorSearchExactRowProps,
} from "../discovery-creator-exact-row";
export { InterestChips, RelevanceScore } from "../discovery-interest-chips";
export {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "../discovery-creator-platform-stats";
export { DiscoveryCreatorProfileSummary } from "../discovery-creator-profile-summary";
export { DiscoveryCreatorDetailHost } from "../discovery-creator-detail-host";
export {
  buildDiscoveryCreatorViewModel,
  formatThinkwayStarLabel,
  type DiscoveryCreatorViewModel,
  type DiscoveryCreatorViewModelOptions,
} from "../../view-models/discovery-creator-view-model";
```


---

## 10 — Product design tokens (CSS variables)

Canonical product tokens from thinkway-design-tokens.css (includes .dark block).

#### `app/thinkway-design-tokens.css`

```css
/* ═══════════════════════════════════════════════════════
   THINKWAY DESIGN TOKENS — v1.0 (canonical)
   Source: Thinkway_Brand_Kit.pdf v1.0 + THINKWAY_DESIGN_SPEC.md
   Imported globally via app/globals.css.
   Ref modules alias these names inside scoped roots (.outputs-center-ref, etc.).
   ═══════════════════════════════════════════════════════ */

:root {
  /* ---- Brand ---- */
  --navy: #060810;
  --ink: #0b0f1a;
  --muted: #6b7280;
  --lavender: #e8effe;

  --blue: #0057ff;
  --blue-hover: #0048dd;
  --blue-400: #1a6fff;
  --blue-300: #3d8bff;
  --blue-light: #eef3ff;
  --blue-text: #0048dd;

  --brand-gradient: linear-gradient(145deg, #0040cc, #0057ff, #1a6fff, #0048dd);

  /* ---- Semantic status (not brand) ---- */
  --green: #10b981;
  --green-bg: #ecfdf5;
  --green-text: #065f46;

  --amber: #f59e0b;
  --amber-bg: #fffbeb;
  --amber-text: #92400e;

  --red: #ef4444;
  --red-bg: #fef2f2;
  --red-text: #991b1b;

  --purple: #a855f7;
  --purple-bg: #faf5ff;
  --purple-text: #6b21a8;

  /* ---- Neutral scale ---- */
  --text: var(--ink);
  --text-2: #3f4757;
  --text-3: #6b7280;

  --border: #e3e8f2;
  --surface: #f3f6fc;
  --white: #ffffff;

  /* ---- Shape (HTML mock: 8 / 10 / 16). Prefer --tw-radius / --radius-lg in
     Discovery UI — globals.css overwrites --radius for shadcn (0.75rem). ---- */
  --radius: 8px;
  --radius-md: 10px;
  --radius-lg: 16px;

  /* ---- Motion ---- */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  /*
   * Shadcn-safe aliases — globals.css keeps --muted, --border, and --radius for
   * the legacy platform shell. --brand-gradient is canonical here (do not
   * override in globals). Product UI ref modules should prefer these names
   * when they need official spec values.
   */
  --tw-muted-text: #6b7280;
  --tw-border: #e3e8f2;
  --tw-radius: 8px;
  --tw-brand-gradient: linear-gradient(145deg, #0040cc, #0057ff, #1a6fff, #0048dd);
}

.mono,
.font-mono {
  font-family: var(--font-geist-mono), "Geist Mono", ui-monospace, "SF Mono", Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

/* Product tokens — dark mode (platform-v6, Discovery lists, clients) */
.dark {
  --ink: #fafafa;
  --text: #fafafa;
  --text-2: #d4d4d8;
  --text-3: #a1a1aa;
  --border: rgba(255, 255, 255, 0.08);
  --surface: #141419;
  --white: #18181b;
  --lavender: #0a0a0f;

  --blue-light: rgba(0, 87, 255, 0.12);
  --blue-text: #60a5fa;

  --green-bg: rgba(16, 185, 129, 0.12);
  --green-text: #34d399;

  --amber-bg: rgba(245, 158, 11, 0.12);
  --amber-text: #fbbf24;

  --red-bg: rgba(239, 68, 68, 0.12);
  --red-text: #f87171;

  --purple-bg: rgba(168, 85, 247, 0.12);
  --purple-text: #c084fc;

  --tw-border: rgba(255, 255, 255, 0.08);
  --tw-muted-text: #a1a1aa;
}
```

---

## 11 — CSS extracts (Discovery Search + sidebar)

### `app/thinkway-platform-v6.css` — Discovery exact-row, filter drawer, selection flyout

```css
.discovery-search-exact-root {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fff;
}

.discovery-search-exact-header-bar {
  flex-shrink: 0;
  padding: 16px 40px 0;
  border-bottom: 1px solid #eef0f3;
  background: #fff;
}

.discovery-search-exact-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  overscroll-behavior-y: contain;
  padding: 0 40px 40px;
}

.discovery-search-exact-headers {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  background: #fff;
}

.discovery-search-exact-col-count {
  width: 238px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.discovery-search-exact-col-info {
  width: 190px;
  flex-shrink: 0;
}

.discovery-search-exact-col-category {
  width: 148px;
  flex-shrink: 0;
}

.discovery-search-exact-col-stats {
  width: 260px;
  flex-shrink: 0;
}

.discovery-search-exact-col-feed {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.discovery-search-exact-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-left: auto;
}

.discovery-search-exact-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 22px 0;
  border-top: 1px solid #eef0f3;
  cursor: pointer;
  outline: none;
}

.discovery-search-exact-row:hover {
  background: rgba(0, 87, 255, 0.015);
}

.discovery-search-exact-row.is-selected {
  background: rgba(0, 87, 255, 0.04);
}

.discovery-search-exact-row--enriching {
  background: rgba(14, 165, 233, 0.06);
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.2);
}

.discovery-search-exact-meta-cell {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 12px;
  width: 220px;
}

.discovery-search-exact-col-meta {
  flex-shrink: 0;
  width: 220px;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ca3af;
}

.discovery-search-exact-row--with-meta .discovery-search-exact-feed-thumbs {
  flex: 0 1 auto;
  min-width: 120px;
  padding-right: 8px;
}

.discovery-search-exact-photo-cell {
  width: 238px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.discovery-search-exact-info-cell {
  width: 190px;
  flex-shrink: 0;
  min-width: 0;
  padding-right: 8px;
  display: flex;
  align-items: center;
}

.discovery-search-exact-info-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
}

.discovery-search-exact-category-cell {
  width: 148px;
  flex-shrink: 0;
  min-width: 0;
  align-self: center;
  padding-right: 12px;
}

.discovery-search-exact-photo-wrap {
  position: relative;
  flex-shrink: 0;
}

.discovery-creator-avatar-hover-trigger {
  position: relative;
  flex-shrink: 0;
}

.discovery-creator-avatar-hover-trigger__panel {
  position: absolute;
  left: calc(100% + 16px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  pointer-events: auto;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card {
  gap: 18px;
  min-width: 364px;
  max-width: 442px;
  padding: 16px 18px;
  border-radius: 21px;
  box-shadow:
    0 13px 42px rgba(0, 87, 255, 0.1),
    0 3px 10px rgba(15, 23, 42, 0.06);
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__avatar {
  width: 68px;
  height: 68px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__rating {
  bottom: -8px;
  gap: 4px;
  padding: 3px 9px;
  font-size: 14px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__rating svg {
  width: 14px;
  height: 14px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__title-row {
  gap: 8px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__name {
  font-size: 20px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__sparkle {
  width: 21px;
  height: 21px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__collabs {
  margin-top: 5px;
  font-size: 16px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__status {
  margin-top: 3px;
  font-size: 14px;
}

.discovery-filter-drawer-section--modified .creator-detail-sheet-section-title__icon {
  background: rgba(0, 87, 255, 0.16);
  color: #0057ff;
}

.discovery-filter-drawer-section__card {
  position: relative;
  overflow: hidden;
  padding: 18px 20px;
  border: 1px solid rgba(0, 87, 255, 0.16);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.42) 0%, #fff 24%);
  box-shadow: 0 2px 8px rgba(0, 87, 255, 0.06);
}

.discovery-filter-field-group + .discovery-filter-field-group {
  margin-top: 0;
}

.discovery-filter-drawer-section__card::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 2.5px;
  background: #0057ff;
  opacity: 0.4;
}

.discovery-filter-drawer-section--modified .discovery-filter-drawer-section__card::before {
  opacity: 0.85;
}

.discovery-filter-drawer-section--modified .creator-detail-sheet-section-title__text {
  color: #0057ff;
}

.discovery-filter-drawer-section__toggle .creator-detail-sheet-section-title__icon {
  background: rgba(0, 87, 255, 0.1);
  color: #0057ff;
}

.discovery-filter-drawer-active-summary__card .creator-detail-sheet-section-title {
  margin-bottom: 0;
}

.discovery-selection-flyout__bar {
  border: 1px solid rgba(0, 87, 255, 0.2);
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(239, 246, 255, 0.98) 0%,
    rgba(255, 255, 255, 0.98) 100%
  );
  box-shadow:
    0 10px 32px rgba(0, 87, 255, 0.1),
    0 2px 8px rgba(15, 23, 42, 0.06);
  scrollbar-width: none;
}

.discovery-selection-flyout__bar::-webkit-scrollbar {
  display: none;
}

.discovery-selection-flyout-menu {
  backdrop-filter: none;
}

.discovery-selection-flyout-menu__item {
  min-height: 2rem;
}

.discovery-selection-flyout-menu__item[data-disabled] {
  color: #94a3b8;
  opacity: 1;
}

.discovery-selection-flyout-menu__item[data-disabled] svg {
  color: #cbd5e1;
}

.discovery-search-exact-photo {
  width: 87px;
  height: 87px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  background: var(--surface, #f3f6fc);
}

.discovery-search-exact-photo--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.discovery-search-exact-flag {
  position: absolute;
  right: -2px;
  bottom: 2px;
  width: 22px;
  height: 22px;
  pointer-events: none;
  z-index: 1;
}

.discovery-search-exact-star {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 700;
  color: var(--amber-text, #92400e);
  background: #fff;
  border: 1px solid var(--border, #e3e8f2);
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.1);
}

.discovery-search-exact-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discovery-search-exact-handle {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discovery-search-exact-meta {
  font-size: 12.5px;
  color: #6b7280;
  margin-top: 4px;
}

.discovery-search-exact-bio {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: #6b7280;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.discovery-search-exact-country {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 11px;
  color: #6b7280;
}

.discovery-search-exact-audience,

.discovery-search-exact-dna {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: #6b7280;
}

.discovery-search-exact-platforms {
  margin-top: 4px;
}

.discovery-search-exact-info-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.discovery-search-exact-select {
  flex-shrink: 0;
}

.discovery-search-exact-applied {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.discovery-search-exact-stat-box {
  border: 1px solid var(--border, #e3e8f2);
  border-radius: 12px;
  padding: 8px 10px;
  width: 260px;
  flex-shrink: 0;
}

.discovery-search-exact-stat-head,

.discovery-search-exact-stat-platform {
  display: grid;
  grid-template-columns: 22px 1fr 1fr 1fr;
  align-items: center;
  column-gap: 8px;
  width: 100%;
}

.discovery-search-exact-stat-head {
  margin-bottom: 4px;
}

.discovery-search-exact-stat-col-label {
  font-size: 10px;
  font-weight: 600;
  color: #9ca3af;
  line-height: 1.2;
}

.discovery-search-exact-stat-platforms {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.discovery-search-exact-stat-platform + .discovery-search-exact-stat-platform {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #eef0f3;
}

.discovery-search-exact-stat-platform-logo {
  width: 22px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink, #0b0f1a);
}

.discovery-search-exact-stat-value {
  display: block;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.discovery-search-exact-feed-thumbs {
  display: flex;
  gap: 8px;
  flex: 1;
  align-items: center;
  padding: 0 20px;
  min-width: 0;
}

.discovery-search-exact-feed-thumbs--empty {
  min-height: 56px;
}

.discovery-search-exact-feed-empty {
  font-size: 11px;
  color: #9ca3af;
}

.discovery-search-exact-feed-thumb {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  flex-shrink: 0;
  object-fit: cover;
  background: var(--surface, #f3f6fc);
}

.discovery-search-exact-feed-thumb--empty {
  background: #eef1f6;
  border: 1px solid var(--border, #e3e8f2);
}

.discovery-search-exact-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.discovery-search-exact-accept {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 9px;
  background: var(--blue, #0057ff);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 120ms;
  white-space: nowrap;
}

.discovery-search-exact-accept:hover {
  filter: brightness(1.05);
}

.discovery-search-exact-accept.is-added {
  background: #10b981;
}

.discovery-search-exact-accept.is-added:hover {
  filter: brightness(1.05);
}

.discovery-search-exact-accept svg {
  width: 11px;
  height: 11px;
}

.discovery-search-exact-reject {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: 1.5px solid var(--border, #e3e8f2);
  color: #1f2937;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  cursor: pointer;
}

.discovery-search-exact-reject svg {
  width: 13px;
  height: 13px;
}

.discovery-search-exact-row-menu {
  border-radius: 10px;
  border: 1px solid var(--border, #e3e8f2);
  background: #fff;
}

.discovery-search-exact-reject:hover {
  border-color: #fca5a5;
  color: #dc2626;
}
```

### `app/globals.css` — Shell header + sidebar dark overrides (lines 250–330)

```css
   */
  table:not([data-slot="table"]) th {
    @apply bg-muted/60 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase;
  }

  .thinkway-shell-header {
    @apply border-b border-border bg-background/80 backdrop-blur-md;
  }

  .thinkway-workspace-chrome {
    @apply border-b border-border bg-background/90 backdrop-blur-md;
  }

  /* Platform shell — flush edges, soft top-left curve */
  .thinkway-platform-shell {
    border-top-left-radius: 48px;
    background: #ffffff;
    box-shadow:
      0 0 0 1px rgba(0, 87, 255, 0.04),
      0 20px 48px rgba(0, 87, 255, 0.08);
  }

  .thinkway-app-sidebar {
    box-shadow: 1px 0 0 rgba(238, 240, 243, 0.95);
  }

  .dark .thinkway-app-sidebar {
    box-shadow: 1px 0 0 var(--border);
  }

  .thinkway-app-sidebar-link--active {
    font-weight: 600;
  }

  .thinkway-app-sidebar--rail {
    box-shadow: none;
  }

  .thinkway-app-sidebar-rail-link--active {
    box-shadow: inset 0 0 0 1px rgba(0, 87, 255, 0.08);
  }

  /* Sidebar logo — readable on dark elevated rail */
  .dark .login-v2-logo-text {
    color: #fafafa;
  }

  .dark .login-v2-logo-text span {
    color: #0057ff;
  }

  .dark .thinkway-platform-shell {
    background: var(--surface-elevated);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 20px 48px rgba(0, 0, 0, 0.35);
  }

  .dark .thinkway-app-sidebar {
    background: var(--sidebar);
    border-color: var(--sidebar-border);
    color: var(--sidebar-foreground);
  }

  .thinkway-sidebar-grp-icon {
    @apply flex size-[18px] shrink-0 items-center justify-center text-sidebar-muted-foreground;
  }

  .dark .thinkway-sidebar-grp-icon {
    @apply text-sidebar-muted-foreground;
  }

  .dark .thinkway-app-sidebar .login-v2-logo-mark {
    background: rgba(0, 87, 255, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

}

@media (max-width: 767px) {
  :root {
```

---

*End of DISCOVERY SEARCH reference handoff.*
