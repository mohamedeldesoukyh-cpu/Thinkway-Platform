"use client";

import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";

/** Mock order: checkbox, expand, then the 12 campaign headers. */
export const BILLING_QUEUE_GRID_TRACKS = [
  { id: "select", width: "32px", key: "showSelect" },
  { id: "expand", width: "28px", key: "showExpand" },
  { id: "campaign_no", width: "90px", key: "showCampaignNo" },
  { id: "client", width: "128px", key: "showClient" },
  { id: "brand", width: "94px", key: "showBrand" },
  { id: "campaign", width: "minmax(120px,1fr)", key: "showCampaign" },
  { id: "currency", width: "50px", key: "showCurrency" },
  { id: "total", width: "100px", key: "showTotal" },
  { id: "achieved", width: "100px", key: "showAchieved" },
  { id: "invoiced", width: "100px", key: "showInvoiced" },
  { id: "remaining", width: "100px", key: "showRemaining" },
  { id: "bill_percent", width: "104px", key: "showBillPercent" },
  { id: "unachieved", width: "90px", key: "showUnachieved" },
  { id: "status", width: "112px", key: "showStatus" },
  { id: "actions", width: "82px", key: "showActions" },
] as const;

export type BillingQueueColumnVisibility = ReturnType<typeof useBillingQueueColumnVisibility>;

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
    showBillPercent: useIsOperationalColumnVisible("bill_percent"),
    showUnachieved: useIsOperationalColumnVisible("unachieved"),
    showStatus: useIsOperationalColumnVisible("status"),
    showActions: useIsOperationalColumnVisible("actions"),
  };
}

export function billingQueueGridTemplate(cols: BillingQueueColumnVisibility): string {
  return BILLING_QUEUE_GRID_TRACKS.filter((track) => cols[track.key])
    .map((track) => track.width)
    .join(" ");
}

export function formatQueueNumber(amount: number): string {
  return Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US");
}
