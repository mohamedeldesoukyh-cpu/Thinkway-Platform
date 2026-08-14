"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { isBulkRefreshLocked } from "@/components/workspace/bulk-operations/bulk-refresh-gate";

type CampaignOperationalRefreshContextValue = {
  reloadOperationalBilling: () => Promise<void>;
  reloadPublications: () => Promise<void>;
  reloadAssignmentHierarchy: () => Promise<void>;
  reloadVendorIos: () => Promise<void>;
};

const CampaignOperationalRefreshContext =
  createContext<CampaignOperationalRefreshContextValue | null>(null);

export function CampaignOperationalRefreshProvider({
  reloadOperationalBilling,
  reloadPublications,
  reloadAssignmentHierarchy,
  reloadVendorIos,
  children,
}: {
  reloadOperationalBilling: () => Promise<void>;
  reloadPublications: () => Promise<void>;
  reloadAssignmentHierarchy: () => Promise<void>;
  reloadVendorIos: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <CampaignOperationalRefreshContext.Provider
      value={{
        reloadOperationalBilling,
        reloadPublications,
        reloadAssignmentHierarchy,
        reloadVendorIos,
      }}
    >
      {children}
    </CampaignOperationalRefreshContext.Provider>
  );
}

export function useCampaignOperationalRefresh() {
  return useContext(CampaignOperationalRefreshContext)?.reloadOperationalBilling ?? null;
}

export function useCampaignPublicationsRefresh() {
  return useContext(CampaignOperationalRefreshContext)?.reloadPublications ?? null;
}

export function useCampaignAssignmentHierarchyRefresh() {
  return (
    useContext(CampaignOperationalRefreshContext)?.reloadAssignmentHierarchy ?? null
  );
}

export function useCampaignVendorIosRefresh() {
  return useContext(CampaignOperationalRefreshContext)?.reloadVendorIos ?? null;
}

/**
 * Refetch deferred billing + Vendor IO register and refresh server props after IO / invoice mutations.
 * Never throws into React render — callers that need diagnostics should wrap and toast.
 */
export function useRefreshCampaignAfterOperationalMutation() {
  const router = useRouter();
  const reloadOperationalBilling = useCampaignOperationalRefresh();
  const reloadVendorIos = useCampaignVendorIosRefresh();

  return useCallback(() => {
    // Platform Bulk Runner owns refresh during multi-select jobs.
    // Mid-run router.refresh() remounts the workspace and aborts remaining items.
    if (isBulkRefreshLocked()) {
      return;
    }
    try {
      void reloadOperationalBilling?.().catch((error: unknown) => {
        console.error("[campaign-operational-refresh] billing reload failed", error);
      });
      void reloadVendorIos?.().catch((error: unknown) => {
        console.error("[campaign-operational-refresh] vendor IO reload failed", error);
      });
      // Defer outside the calling startTransition so RSC props actually remount.
      queueMicrotask(() => {
        try {
          router.refresh();
        } catch (error) {
          console.error("[campaign-operational-refresh] refresh failed", error);
        }
      });
    } catch (error) {
      console.error("[campaign-operational-refresh] refresh failed", error);
    }
  }, [reloadOperationalBilling, reloadVendorIos, router]);
}

/**
 * Refetch publications + Assignments hierarchy after publication create/edit.
 * Live dates sync into assignment posts on create — hierarchy must reload or Assignments stays stale.
 */
export function useRefreshCampaignAfterPublicationMutation() {
  const router = useRouter();
  const reloadPublications = useCampaignPublicationsRefresh();
  const reloadAssignmentHierarchy = useCampaignAssignmentHierarchyRefresh();

  return useCallback(() => {
    if (isBulkRefreshLocked()) {
      return;
    }
    void reloadPublications?.().catch((error: unknown) => {
      console.error("[campaign-publication-refresh] publications reload failed", error);
    });
    void reloadAssignmentHierarchy?.().catch((error: unknown) => {
      console.error(
        "[campaign-publication-refresh] assignment hierarchy reload failed",
        error
      );
    });
    queueMicrotask(() => {
      try {
        router.refresh();
      } catch (error) {
        console.error("[campaign-publication-refresh] refresh failed", error);
      }
    });
  }, [reloadPublications, reloadAssignmentHierarchy, router]);
}
