"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

function tabFromLocation(): CreatorCampaignTabValue {
  if (typeof window === "undefined") return "overview";
  return resolveCampaignTab(new URLSearchParams(window.location.search).get("tab"));
}

export function CreatorCampaignTabs({
  sections,
}: {
  sections: Record<CreatorCampaignTabValue, ReactNode>;
}) {
  const searchParams = useSearchParams();
  const [value, setValue] = useState<CreatorCampaignTabValue>(() =>
    resolveCampaignTab(searchParams.get("tab"))
  );

  useEffect(() => {
    function onPopState() {
      setValue(tabFromLocation());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function setTab(next: CreatorCampaignTabValue) {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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
