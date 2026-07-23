"use client";

import dynamic from "next/dynamic";

export const OpenCampaignStudioLauncher = dynamic(
  () =>
    import("@/features/campaign-outputs/components/open-campaign-studio-launcher").then(
      (m) => m.OpenCampaignStudioLauncher
    ),
  { ssr: false }
);
