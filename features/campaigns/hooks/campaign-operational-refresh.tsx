"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type CampaignOperationalRefreshContextValue = {
  reloadOperationalBilling: () => Promise<void>;
  reloadPublications: () => Promise<void>;
};

const CampaignOperationalRefreshContext =
  createContext<CampaignOperationalRefreshContextValue | null>(null);

export function CampaignOperationalRefreshProvider({
  reloadOperationalBilling,
  reloadPublications,
  children,
}: {
  reloadOperationalBilling: () => Promise<void>;
  reloadPublications: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <CampaignOperationalRefreshContext.Provider
      value={{ reloadOperationalBilling, reloadPublications }}
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

/**
 * Refetch deferred billing bundles and refresh server props after IO / invoice mutations.
 * Never throws into React render — callers that need diagnostics should wrap and toast.
 */
export function useRefreshCampaignAfterOperationalMutation() {
  const router = useRouter();
  const reloadOperationalBilling = useCampaignOperationalRefresh();

  return useCallback(() => {
    try {
      void reloadOperationalBilling?.().catch((error: unknown) => {
        console.error("[campaign-operational-refresh] billing reload failed", error);
      });
      router.refresh();
    } catch (error) {
      console.error("[campaign-operational-refresh] refresh failed", error);
    }
  }, [reloadOperationalBilling, router]);
}

/** Refetch publications bundle (grid, KPIs, sync health) after publication mutations. */
export function useRefreshCampaignAfterPublicationMutation() {
  const reloadPublications = useCampaignPublicationsRefresh();

  return useCallback(() => {
    void reloadPublications?.();
  }, [reloadPublications]);
}
