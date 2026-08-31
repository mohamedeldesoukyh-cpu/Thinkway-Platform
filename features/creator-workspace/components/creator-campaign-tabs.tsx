"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export const CREATOR_CAMPAIGN_TABS = [
  { value: "overview", label: "Overview" },
  { value: "brief", label: "Brief" },
  { value: "deliverables", label: "Deliverables" },
  { value: "agreement", label: "Agreement" },
  { value: "payment", label: "Payment" },
] as const;

export type CreatorCampaignTabValue = (typeof CREATOR_CAMPAIGN_TABS)[number]["value"];

const TAB_ALIASES: Record<string, CreatorCampaignTabValue> = {
  script: "deliverables",
  publications: "deliverables",
  messages: "deliverables",
};

function resolveCampaignTab(value: string | null): CreatorCampaignTabValue {
  if (!value) return "overview";
  if (value in TAB_ALIASES) return TAB_ALIASES[value];
  return CREATOR_CAMPAIGN_TABS.some((tab) => tab.value === value)
    ? (value as CreatorCampaignTabValue)
    : "overview";
}

export function CreatorCampaignTabs({
  sections,
}: {
  sections: Record<CreatorCampaignTabValue, ReactNode>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = resolveCampaignTab(searchParams.get("tab"));

  function setTab(next: CreatorCampaignTabValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <>
      <nav className="tabs" aria-label="Campaign">
        {CREATOR_CAMPAIGN_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-current={value === tab.value}
            onClick={() => setTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="tabpane">{sections[value]}</div>
    </>
  );
}
