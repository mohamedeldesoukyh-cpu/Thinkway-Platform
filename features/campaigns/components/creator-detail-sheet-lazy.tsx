"use client";

import dynamic from "next/dynamic";

/** Code-split the heavy creator detail sheet off Discovery/search entry bundles. */
export const CreatorDetailSheet = dynamic(
  () =>
    import("@/features/campaigns/components/creator-detail-sheet").then((mod) => ({
      default: mod.CreatorDetailSheet,
    })),
  { ssr: false }
);
