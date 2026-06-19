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
};

const CampaignOperationalRefreshContext =
  createContext<CampaignOperationalRefreshContextValue | null>(null);

export function CampaignOperationalRefreshProvider({
  reloadOperationalBilling,
  children,
}: {
  reloadOperationalBilling: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <CampaignOperationalRefreshContext.Provider value={{ reloadOperationalBilling }}>
      {children}
    </CampaignOperationalRefreshContext.Provider>
  );
}

export function useCampaignOperationalRefresh() {
  return useContext(CampaignOperationalRefreshContext)?.reloadOperationalBilling ?? null;
}

/** Refetch deferred billing bundles and refresh server props after IO / invoice mutations. */
export function useRefreshCampaignAfterOperationalMutation() {
  const router = useRouter();
  const reloadOperationalBilling = useCampaignOperationalRefresh();

  return useCallback(() => {
    void reloadOperationalBilling?.();
    router.refresh();
  }, [reloadOperationalBilling, router]);
}
