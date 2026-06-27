"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadCampaignAssignmentsBillingBundle,
  loadCampaignBillingBundle,
  loadCampaignFinanceAuditBundle,
  loadCampaignFormOptionsBundle,
  loadCampaignPublicationsBundle,
  type CampaignAssignmentsBillingPayload,
  type CampaignBillingPayload,
  type CampaignDeferredBundle,
  type CampaignFormOptionsPayload,
} from "@/features/campaigns/actions/load-campaign-tab-data";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type {
  AssignmentBillingGroup,
  BillingLineRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import { emptyCampaignPerformanceSummary } from "@/features/campaigns/queries/campaign-performance-defaults";
import type {
  CampaignPerformanceCharts,
  CampaignPerformanceSummary,
  CampaignPublicationRow,
} from "@/features/campaigns/queries/publications";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import {
  isSilentDeferredBundleRefresh,
  shouldFetchDeferredBundle,
} from "@/features/campaigns/hooks/deferred-bundle-policy";
import {
  METRICS_SYNC_POLL_INTERVAL_MS,
  publicationsNeedAvatarSyncPoll,
  publicationsNeedMetricsSyncPoll,
  publicationsNeedScreenshotCapturePoll,
  SCREENSHOT_CAPTURE_POLL_INTERVAL_MS,
} from "@/features/campaigns/hooks/metrics-sync-poll-policy";
import { assignmentHierarchyBoundaryKey } from "@/lib/campaigns/assignment-row-debug";

export const OPERATIONAL_BILLING_BUNDLES: CampaignDeferredBundle[] = [
  "assignmentsBilling",
  "billing",
];

type BundleStatus = "idle" | "loading" | "loaded" | "error";

type BundleStatuses = Record<CampaignDeferredBundle, BundleStatus>;

const INITIAL_BUNDLE_STATUSES: BundleStatuses = {
  formOptions: "idle",
  assignmentsBilling: "idle",
  billing: "idle",
  publications: "idle",
  financeAudit: "idle",
};

/** Prefetched in parallel after mount — never blocks first paint. */
const PREFETCH_BUNDLES: CampaignDeferredBundle[] = [
  "formOptions",
  "assignmentsBilling",
  "billing",
  "publications",
  "financeAudit",
];

/** Bundles that block tab content with a skeleton until loaded. */
const TAB_BLOCKING_BUNDLES: Record<CampaignWorkspaceTabId, CampaignDeferredBundle[]> = {
  overview: [],
  "client-io": [],
  lines: [],
  "vendor-io": [],
  deliverables: ["publications"],
  publications: ["publications"],
  workflow: [],
  billing: ["billing"],
  timeline: ["financeAudit"],
};

/** Bundles associated with a tab for error surfacing. */
const TAB_BUNDLES: Record<CampaignWorkspaceTabId, CampaignDeferredBundle[]> = {
  overview: ["formOptions"],
  "client-io": [],
  lines: ["formOptions", "assignmentsBilling"],
  "vendor-io": [],
  deliverables: ["publications"],
  publications: ["publications"],
  workflow: [],
  billing: ["billing"],
  timeline: ["financeAudit"],
};

function scheduleBackgroundPrefetch(run: () => void): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
  const timer = window.setTimeout(run, 0);
  return () => window.clearTimeout(timer);
}

export type CampaignTabDataState = {
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  groups: { id: string; name: string; document_number: string }[];
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  billingLines: BillingLineRow[];
  campaignInvoiceRegister: FinanceInvoiceRegisterRow[];
  publications: CampaignPublicationRow[];
  performanceSummary: CampaignPerformanceSummary;
  performanceCharts: CampaignPerformanceCharts;
  publicationsSyncHealth: CampaignMetricsSyncHealth;
  publicationsSchemaWarnings: string[];
  publicationsLoadError: string | null;
  financeAudit: FinanceAuditTimelineEntry[];
  bundleStatuses: BundleStatuses;
  bundleErrors: Partial<Record<CampaignDeferredBundle, string>>;
  isTabLoading: (tabId: CampaignWorkspaceTabId) => boolean;
  tabLoadError: (tabId: CampaignWorkspaceTabId) => string | null;
  reloadOperationalBilling: () => Promise<void>;
  reloadPublications: () => Promise<void>;
};

export function useCampaignTabData(
  campaignId: string,
  initialAssignmentHierarchy: AssignmentHierarchy
): CampaignTabDataState {
  const [accountManagers, setAccountManagers] = useState<
    CampaignFormOptionsPayload["accountManagers"]
  >([]);
  const [teams, setTeams] = useState<CampaignFormOptionsPayload["teams"]>([]);
  const [groups, setGroups] = useState<CampaignFormOptionsPayload["groups"]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<
    CampaignFormOptionsPayload["currencyOptions"]
  >([]);
  const [assignmentHierarchy, setAssignmentHierarchy] =
    useState<AssignmentHierarchy>(initialAssignmentHierarchy);
  const [billingGroups, setBillingGroups] = useState<AssignmentBillingGroup[]>([]);
  const [operationalBilling, setOperationalBilling] =
    useState<CampaignOperationalBillingDetail | null>(null);
  const [billingLines, setBillingLines] = useState<BillingLineRow[]>([]);
  const [campaignInvoiceRegister, setCampaignInvoiceRegister] = useState<
    FinanceInvoiceRegisterRow[]
  >([]);
  const [publications, setPublications] = useState<CampaignPublicationRow[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<CampaignPerformanceSummary>(
    emptyCampaignPerformanceSummary()
  );
  const [performanceCharts, setPerformanceCharts] = useState<CampaignPerformanceCharts>({
    performance_over_time: [],
    platform_split: [],
    content_type_split: [],
    top_creators_by_engagement: [],
    reach_by_creator: [],
    views_by_publication: [],
    engagement_distribution: [],
  });
  const [publicationsSyncHealth, setPublicationsSyncHealth] =
    useState<CampaignMetricsSyncHealth>({
      synced: 0,
      partial: 0,
      failed: 0,
      manual_required: 0,
      queued: 0,
      collecting: 0,
      total: 0,
    });
  const [publicationsSchemaWarnings, setPublicationsSchemaWarnings] = useState<string[]>([]);
  const [publicationsLoadError, setPublicationsLoadError] = useState<string | null>(null);
  const [financeAudit, setFinanceAudit] = useState<FinanceAuditTimelineEntry[]>([]);
  const [bundleStatuses, setBundleStatuses] =
    useState<BundleStatuses>(INITIAL_BUNDLE_STATUSES);
  const [bundleErrors, setBundleErrors] = useState<
    Partial<Record<CampaignDeferredBundle, string>>
  >({});

  const inFlightRef = useRef(new Set<CampaignDeferredBundle>());
  const bundleStatusesRef = useRef(bundleStatuses);
  bundleStatusesRef.current = bundleStatuses;

  useEffect(() => {
    setAssignmentHierarchy(initialAssignmentHierarchy);
  }, [initialAssignmentHierarchy]);

  const markBundleStatus = useCallback(
    (bundle: CampaignDeferredBundle, status: BundleStatus, error?: string) => {
      setBundleStatuses((prev) => ({ ...prev, [bundle]: status }));
      if (error) {
        setBundleErrors((prev) => ({ ...prev, [bundle]: error }));
      }
    },
    []
  );

  const applyAssignmentsBillingPayload = (data: CampaignAssignmentsBillingPayload) => {
    setBillingGroups(data.billingGroups);
    setOperationalBilling(data.operationalBilling);
  };

  const applyBillingPayload = (data: CampaignBillingPayload) => {
    setBillingLines(data.billingLines);
    setBillingGroups(data.billingGroups);
    setOperationalBilling(data.operationalBilling);
    setCampaignInvoiceRegister(data.campaignInvoiceRegister);
  };

  const loadBundle = useCallback(
    async (bundle: CampaignDeferredBundle, options?: { force?: boolean }) => {
      if (inFlightRef.current.has(bundle)) return;
      const status = bundleStatusesRef.current[bundle];
      if (!shouldFetchDeferredBundle(status, options)) {
        return;
      }

      inFlightRef.current.add(bundle);
      const silentRefresh = isSilentDeferredBundleRefresh(status, options);
      if (!silentRefresh) {
        markBundleStatus(bundle, "loading");
      }

      try {
        if (bundle === "formOptions") {
          const result = await loadCampaignFormOptionsBundle(campaignId);
          if (!result.ok) {
            markBundleStatus(bundle, "error", result.error);
            return;
          }
          setAccountManagers(result.data.accountManagers);
          setTeams(result.data.teams);
          setGroups(result.data.groups);
          setCurrencyOptions(result.data.currencyOptions);
        } else if (bundle === "assignmentsBilling") {
          const result = await loadCampaignAssignmentsBillingBundle(campaignId);
          if (!result.ok) {
            markBundleStatus(bundle, "error", result.error);
            return;
          }
          applyAssignmentsBillingPayload(result.data);
        } else if (bundle === "billing") {
          const result = await loadCampaignBillingBundle(campaignId);
          if (!result.ok) {
            markBundleStatus(bundle, "error", result.error);
            return;
          }
          applyBillingPayload(result.data);
        } else if (bundle === "publications") {
          const result = await loadCampaignPublicationsBundle(campaignId);
          if (!result.ok) {
            markBundleStatus(bundle, "error", result.error);
            return;
          }
          setPublications(result.data.publications);
          setPerformanceSummary(result.data.summary);
          setPerformanceCharts(result.data.charts);
          setPublicationsSyncHealth(result.data.syncHealth);
          setPublicationsSchemaWarnings(result.data.schemaWarnings);
          setPublicationsLoadError(result.data.loadError);
        } else if (bundle === "financeAudit") {
          const result = await loadCampaignFinanceAuditBundle(campaignId);
          if (!result.ok) {
            markBundleStatus(bundle, "error", result.error);
            return;
          }
          setFinanceAudit(result.data.financeAudit);
        }

        markBundleStatus(bundle, "loaded");
      } catch (error) {
        markBundleStatus(
          bundle,
          "error",
          error instanceof Error ? error.message : "Failed to load tab data."
        );
      } finally {
        inFlightRef.current.delete(bundle);
      }
    },
    [campaignId, markBundleStatus]
  );

  const reloadOperationalBilling = useCallback(async () => {
    await Promise.all(
      OPERATIONAL_BILLING_BUNDLES.map((bundle) => loadBundle(bundle, { force: true }))
    );
  }, [loadBundle]);

  const reloadPublications = useCallback(async () => {
    await loadBundle("publications", { force: true });
  }, [loadBundle]);

  const prevHierarchyKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const hierarchyKey = assignmentHierarchyBoundaryKey(initialAssignmentHierarchy);
    if (prevHierarchyKeyRef.current === null) {
      prevHierarchyKeyRef.current = hierarchyKey;
      return;
    }
    if (prevHierarchyKeyRef.current === hierarchyKey) return;
    prevHierarchyKeyRef.current = hierarchyKey;
    void reloadOperationalBilling();
  }, [initialAssignmentHierarchy, reloadOperationalBilling]);

  useEffect(() => {
    return scheduleBackgroundPrefetch(() => {
      for (const bundle of PREFETCH_BUNDLES) {
        void loadBundle(bundle);
      }
    });
  }, [campaignId, loadBundle]);

  const needsMetricsSyncPoll = useMemo(
    () => publicationsNeedMetricsSyncPoll(publications),
    [publications]
  );

  const needsAvatarSyncPoll = useMemo(
    () => publicationsNeedAvatarSyncPoll(publications),
    [publications]
  );

  const needsScreenshotCapturePoll = useMemo(
    () => publicationsNeedScreenshotCapturePoll(publications),
    [publications]
  );

  const loadBundleRef = useRef(loadBundle);
  loadBundleRef.current = loadBundle;

  useEffect(() => {
    if (!needsMetricsSyncPoll && !needsAvatarSyncPoll) return;

    const timer = window.setInterval(() => {
      void loadBundleRef.current("publications", { force: true });
    }, METRICS_SYNC_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [needsMetricsSyncPoll, needsAvatarSyncPoll]);

  useEffect(() => {
    if (!needsScreenshotCapturePoll) return;

    const timer = window.setInterval(() => {
      void loadBundleRef.current("publications", { force: true });
    }, SCREENSHOT_CAPTURE_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [needsScreenshotCapturePoll]);

  const isTabLoading = useCallback(
    (tabId: CampaignWorkspaceTabId) => {
      const bundles = TAB_BLOCKING_BUNDLES[tabId] ?? [];
      return bundles.some(
        (bundle) =>
          bundleStatuses[bundle] === "loading" || bundleStatuses[bundle] === "idle"
      );
    },
    [bundleStatuses]
  );

  const tabLoadError = useCallback(
    (tabId: CampaignWorkspaceTabId) => {
      const bundles = TAB_BUNDLES[tabId] ?? [];
      for (const bundle of bundles) {
        if (bundleStatuses[bundle] === "error") {
          return bundleErrors[bundle] ?? "Failed to load tab data.";
        }
      }
      return null;
    },
    [bundleErrors, bundleStatuses]
  );

  return {
    accountManagers,
    teams,
    groups,
    currencyOptions,
    assignmentHierarchy,
    billingGroups,
    operationalBilling,
    billingLines,
    campaignInvoiceRegister,
    publications,
    performanceSummary,
    performanceCharts,
    publicationsSyncHealth,
    publicationsSchemaWarnings,
    publicationsLoadError,
    financeAudit,
    bundleStatuses,
    bundleErrors,
    isTabLoading,
    tabLoadError,
    reloadOperationalBilling,
    reloadPublications,
  };
}
