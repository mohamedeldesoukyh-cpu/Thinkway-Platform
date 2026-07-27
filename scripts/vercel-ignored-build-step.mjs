#!/usr/bin/env node
/**
 * Vercel Ignored Build Step (defense in depth)
 *
 * Vercel inverts normal process exit semantics for this hook:
 *   exit 0 → IGNORE the build (cancel / do not deploy)
 *   exit 1 → BUILD (continue the deployment)
 *
 * Default policy:
 * - Preview / Development (non-production Vercel env): always BUILD
 * - Production Git deploys: IGNORE unless an explicit override is present
 *
 * Manual overrides (Production only) — any one is enough:
 * 1. Commit message contains `[deploy-production]` or `[force-deploy]`
 * 2. Project env `THINKWAY_FORCE_PRODUCTION_GIT_DEPLOY=1` (emergency; remove after use)
 *
 * CLI deploys (`vercel deploy --prod`) are not gated by this Git ignore step.
 *
 * @see docs/RELEASE_WORKFLOW.md
 */

const FORCE_COMMIT_TOKENS = ["[deploy-production]", "[force-deploy]"];

/**
 * @param {{
 *   vercelEnv?: string | null;
 *   commitMessage?: string | null;
 *   forceEnv?: string | null;
 * }} input
 * @returns {{ ignore: boolean; reason: string }}
 */
export function resolveIgnoredBuildDecision(input) {
  const vercelEnv = (input.vercelEnv || "").toLowerCase();
  const commitMessage = input.commitMessage || "";
  const forceEnv = (input.forceEnv || "").trim();

  if (vercelEnv !== "production") {
    return {
      ignore: false,
      reason: `Building ${vercelEnv || "preview"} deployment.`,
    };
  }

  const forceFromEnv = forceEnv === "1" || forceEnv.toLowerCase() === "true";
  const lowerMsg = commitMessage.toLowerCase();
  const forceFromCommit = FORCE_COMMIT_TOKENS.some((token) =>
    lowerMsg.includes(token)
  );

  if (forceFromEnv || forceFromCommit) {
    return {
      ignore: false,
      reason:
        "Force Production Git deploy requested " +
        `(${forceFromCommit ? "commit token" : "THINKWAY_FORCE_PRODUCTION_GIT_DEPLOY"}). Building.`,
    };
  }

  return {
    ignore: true,
    reason:
      "Skipping Production Git deploy (no override). " +
      "Add `[deploy-production]` to the commit message, or deploy via " +
      "`vercel deploy --prod` after approval. Push to `develop` for Development/Preview.",
  };
}

function main() {
  const decision = resolveIgnoredBuildDecision({
    vercelEnv: process.env.VERCEL_ENV,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE,
    forceEnv: process.env.THINKWAY_FORCE_PRODUCTION_GIT_DEPLOY,
  });

  console.log(`[vercel-ignored-build-step] ${decision.reason}`);
  // exit 0 = ignore, exit 1 = build (Vercel convention)
  process.exit(decision.ignore ? 0 : 1);
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("vercel-ignored-build-step.mjs") ||
    process.argv[1].endsWith("vercel-ignored-build-step.js"));

if (isDirectRun) {
  main();
}
