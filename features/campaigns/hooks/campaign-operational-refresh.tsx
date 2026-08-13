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
  reloadVendorIos: () => Promise<void>;
};

const CampaignOperationalRefreshContext =
  createContext<CampaignOperationalRefreshContextValue | null>(null);

export function CampaignOperationalRefreshProvider({
  reloadOperationalBilling,
  reloadPublications,
  reloadVendorIos,
  children,
}: {
  reloadOperationalBilling: () => Promise<void>;
  reloadPublications: () => Promise<void>;
  reloadVendorIos: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <CampaignOperationalRefreshContext.Provider
      value={{ reloadOperationalBilling, reloadPublications, reloadVendorIos }}
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

/** Refetch publications bundle (grid, KPIs, sync health) after publication mutations. */
export function useRefreshCampaignAfterPublicationMutation() {
  const reloadPublications = useCampaignPublicationsRefresh();

  return useCallback(() => {
    void reloadPublications?.();
  }, [reloadPublications]);
}
