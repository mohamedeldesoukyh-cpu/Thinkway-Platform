"use client";

import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";

export function useBillingQueueColumnVisibility() {
  return {
    showExpand: useIsOperationalColumnVisible("expand"),
    showSelect: useIsOperationalColumnVisible("select"),
    showCampaignNo: useIsOperationalColumnVisible("campaign_no"),
    showClient: useIsOperationalColumnVisible("client"),
    showBrand: useIsOperationalColumnVisible("brand"),
    showCampaign: useIsOperationalColumnVisible("campaign"),
    showCurrency: useIsOperationalColumnVisible("currency"),
    showTotal: useIsOperationalColumnVisible("total"),
    showAchieved: useIsOperationalColumnVisible("achieved"),
    showInvoiced: useIsOperationalColumnVisible("invoiced"),
    showRemaining: useIsOperationalColumnVisible("remaining"),
    showUnachieved: useIsOperationalColumnVisible("unachieved"),
    showStatus: useIsOperationalColumnVisible("status"),
    showActions: useIsOperationalColumnVisible("actions"),
  };
}
