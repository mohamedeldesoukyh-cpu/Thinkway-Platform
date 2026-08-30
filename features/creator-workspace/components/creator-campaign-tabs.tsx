"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    >
      <div className="-mx-1 overflow-x-auto pb-1">
        <TabsList variant="line" className="h-auto min-w-full justify-start gap-1">
          {CREATOR_CAMPAIGN_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="min-h-11 shrink-0 px-3">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {CREATOR_CAMPAIGN_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="pt-4">
          {sections[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
