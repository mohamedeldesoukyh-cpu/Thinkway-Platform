"use client";

import dynamic from "next/dynamic";

import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

/** Forecast / planning charts load only on the planning route. */
export const PlanningWorkspaceView = dynamic(
  () =>
    import("@/features/planning/components/planning-workspace-view").then((m) => ({
      default: m.PlanningWorkspaceView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <ThinkwayPageLoader label="Loading planning" />
      </div>
    ),
  }
);
