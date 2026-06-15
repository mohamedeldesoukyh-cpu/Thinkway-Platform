"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";

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
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  billingLines: BillingLineRow[];
  campaignInvoiceRegister: FinanceInvoiceRegisterRow[];
  publications: CampaignPublicationRow[];
  publicationsLoadError: string | null;
  financeAudit: FinanceAuditTimelineEntry[];
  bundleStatuses: BundleStatuses;
  bundleErrors: Partial<Record<CampaignDeferredBundle, string>>;
  isTabLoading: (tabId: CampaignWorkspaceTabId) => boolean;
  tabLoadError: (tabId: CampaignWorkspaceTabId) => string | null;
};

export function useCampaignTabData(
  campaignId: string,
  initialAssignmentHierarchy: AssignmentHierarchy
): CampaignTabDataState {
  const [accountManagers, setAccountManagers] = useState<
    CampaignFormOptionsPayload["accountManagers"]
  >([]);
  const [teams, setTeams] = useState<CampaignFormOptionsPayload["teams"]>([]);
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
    async (bundle: CampaignDeferredBundle) => {
      if (inFlightRef.current.has(bundle)) return;
      const status = bundleStatusesRef.current[bundle];
      if (status === "loading" || status === "loaded") {
        return;
      }

      inFlightRef.current.add(bundle);
      markBundleStatus(bundle, "loading");

      try {
        if (bundle === "formOptions") {
          const result = await loadCampaignFormOptionsBundle(campaignId);
          if (!result.ok) {
            markBundleStatus(bundle, "error", result.error);
            return;
          }
          setAccountManagers(result.data.accountManagers);
          setTeams(result.data.teams);
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

  useEffect(() => {
    return scheduleBackgroundPrefetch(() => {
      for (const bundle of PREFETCH_BUNDLES) {
        void loadBundle(bundle);
      }
    });
  }, [campaignId, loadBundle]);

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
    currencyOptions,
    assignmentHierarchy,
    billingGroups,
    operationalBilling,
    billingLines,
    campaignInvoiceRegister,
    publications,
    publicationsLoadError,
    financeAudit,
    bundleStatuses,
    bundleErrors,
    isTabLoading,
    tabLoadError,
  };
}
