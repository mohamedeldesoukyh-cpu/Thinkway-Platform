"use client";

import dynamic from "next/dynamic";

/** Outputs / PDF / presentation generation — load on demand. */
export const GenerateOutputsLauncher = dynamic(
  () =>
    import("@/features/campaign-outputs/components/generate-outputs-launcher").then(
      (m) => m.GenerateOutputsLauncher
    ),
  { ssr: false }
);
