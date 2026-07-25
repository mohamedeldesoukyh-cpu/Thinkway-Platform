#!/usr/bin/env node
/**
 * Vercel Ignored Build Step
 *
 * Exit 0 → skip the build
 * Exit 1 → continue the build
 *
 * Policy:
 * - Preview / Development (non-production Vercel env): always build
 * - Production Git deploys: skip unless the commit message contains
 *   `[deploy-production]` (explicit approval marker)
 *
 * CLI `vercel deploy --prod` is unaffected by this script (Git-only gate).
 */

const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || "";
const force =
  process.env.FORCE_PRODUCTION_DEPLOY === "1" ||
  process.env.FORCE_PRODUCTION_DEPLOY === "true";

const allowProduction =
  force || /\[deploy-production\]/i.test(message);

if (vercelEnv === "production") {
  if (allowProduction) {
    console.log(
      "[vercel-ignored-build-step] Production build allowed (approval marker present).",
    );
    process.exit(1);
  }
  console.log(
    "[vercel-ignored-build-step] Skipping Production Git deploy. " +
      "Push to `develop` for Development, or approve with commit marker " +
      "`[deploy-production]` / CLI `vercel deploy --prod`.",
  );
  process.exit(0);
}

console.log(
  `[vercel-ignored-build-step] Building ${vercelEnv || "preview"} deployment.`,
);
process.exit(1);
