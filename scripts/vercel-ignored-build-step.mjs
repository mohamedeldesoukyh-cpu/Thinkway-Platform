#!/usr/bin/env node
/**
 * Vercel Ignored Build Step (defense in depth)
 *
 * Exit 0 → skip the build
 * Exit 1 → continue the build
 *
 * Policy:
 * - Preview / Development (non-production Vercel env): always build
 * - Production Git deploys: always skip
 *
 * Structural control: `vercel.json` → `git.deploymentEnabled.main = false`
 * disables automatic Production deploys from `main`. This script is a
 * second gate if Production Git builds are ever re-enabled.
 *
 * Approved Production path: explicit CLI `vercel deploy --prod` after
 * human approval (CLI deploys are not gated by this Git ignore step).
 */

const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();

if (vercelEnv === "production") {
  console.log(
    "[vercel-ignored-build-step] Skipping Production Git deploy. " +
      "Production requires explicit approval via `vercel deploy --prod`. " +
      "Push to `develop` for Development/Preview.",
  );
  process.exit(0);
}

console.log(
  `[vercel-ignored-build-step] Building ${vercelEnv || "preview"} deployment.`,
);
process.exit(1);
