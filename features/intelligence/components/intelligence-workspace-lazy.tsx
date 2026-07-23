"use client";

import dynamic from "next/dynamic";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

export const IntelligenceWorkspace = dynamic(
  () =>
    import("@/features/intelligence/components/intelligence-workspace").then((m) => ({
      default: m.IntelligenceWorkspace,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <ThinkwayPageLoader label="Loading intelligence" />
      </div>
    ),
  }
);
