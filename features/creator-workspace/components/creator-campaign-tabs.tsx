"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  EnterpriseTabTrigger,
  EnterpriseTabsList,
} from "@/components/workspace/enterprise-tabs";

export const CREATOR_CAMPAIGN_TABS = [
  { value: "overview", label: "Overview" },
  { value: "brief", label: "Brief" },
  { value: "script", label: "Script" },
  { value: "deliverables", label: "Deliverables" },
  { value: "agreement", label: "Agreement" },
  { value: "publications", label: "Publications" },
  { value: "payment", label: "Payment" },
  { value: "messages", label: "Messages" },
] as const;

export type CreatorCampaignTabValue = (typeof CREATOR_CAMPAIGN_TABS)[number]["value"];

function isCampaignTab(value: string | null): value is CreatorCampaignTabValue {
  return CREATOR_CAMPAIGN_TABS.some((tab) => tab.value === value);
}

export function CreatorCampaignTabs({
  sections,
}: {
  sections: Record<CreatorCampaignTabValue, ReactNode>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const value = isCampaignTab(requested) ? requested : "overview";

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === "overview") params.delete("tab");
        else params.set("tab", next);
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
      className="gap-0"
    >
      <EnterpriseTabsList
        variant="underline"
        overflow="scroll"
        aria-label="Campaign"
        className="border-b border-border"
      >
        {CREATOR_CAMPAIGN_TABS.map((tab) => (
          <EnterpriseTabTrigger key={tab.value} value={tab.value} label={tab.label} />
        ))}
      </EnterpriseTabsList>
      {CREATOR_CAMPAIGN_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="pt-3">
          {sections[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
