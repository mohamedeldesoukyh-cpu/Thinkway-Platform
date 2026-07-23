"use client";

import dynamic from "next/dynamic";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

/** Code-split AI workspace off the shared dashboard graph until /ai is opened. */
export const IntelligenceWorkspace = dynamic(
  () =>
    import("@/features/ai-workspace/components/intelligence-workspace").then((m) => ({
      default: m.IntelligenceWorkspace,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <ThinkwayPageLoader label="Loading AI workspace" />
      </div>
    ),
  }
);
