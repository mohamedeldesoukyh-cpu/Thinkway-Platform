"use client";

import dynamic from "next/dynamic";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

export const StudioCampaignPicker = dynamic(
  () =>
    import("@/features/studio/components/studio-campaign-picker").then((m) => ({
      default: m.StudioCampaignPicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <ThinkwayPageLoader label="Loading Campaign Studio" />
      </div>
    ),
  }
);
