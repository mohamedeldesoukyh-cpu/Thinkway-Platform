/**
 * Assignments tab render isolation.
 *
 * Production recovery:
 * - Prefer server `ASSIGNMENTS_RENDER_STAGE` (runtime on Vercel after redeploy).
 * - `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE` is baked into client bundles at build time.
 *
 * Pass `assignmentsRenderStage` from the campaign page (server) into client tabs.
 */
export const ASSIGNMENTS_RENDER_STAGES = [
  "bypass",
  "static-table",
  "text-status",
  "columns",
  "safe-grid",
  "row-styling",
  "pills",
  "expansion",
  "deliverables-children",
  "checkboxes",
  "footer",
  "dialogs",
  "full",
] as const;

export type AssignmentsRenderStage = (typeof ASSIGNMENTS_RENDER_STAGES)[number];

export type AssignmentsRenderStageSource =
  | "server"
  | "next_public"
  | "default"
  | "production_recovery";

const STAGE_RANK: Record<AssignmentsRenderStage, number> = {
  bypass: 0,
  "static-table": 1,
  "text-status": 2,
  columns: 3,
  "safe-grid": 4,
  "row-styling": 5,
  pills: 6,
  expansion: 7,
  "deliverables-children": 8,
  checkboxes: 9,
  footer: 10,
  dialogs: 11,
  full: 12,
};

/** Code default when no env is set. */
const DEFAULT_STAGE: AssignmentsRenderStage = "footer";

const PRODUCTION_RECOVERY_TARGET: AssignmentsRenderStage = "footer";

export function parseAssignmentsRenderStage(
  raw: string | null | undefined
): AssignmentsRenderStage {
  const value = raw?.trim().toLowerCase();
  if (value && ASSIGNMENTS_RENDER_STAGES.includes(value as AssignmentsRenderStage)) {
    return value as AssignmentsRenderStage;
  }
  return DEFAULT_STAGE;
}

function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production";
}

function bisectAllowedInProduction(): boolean {
  return process.env.ASSIGNMENTS_ALLOW_RENDER_BISECT === "1";
}

/**
 * In Production, auto-upgrade stale bisect stages unless ASSIGNMENTS_ALLOW_RENDER_BISECT=1.
 * Upgrades: static-table, expansion → footer (operational actions without invoice sheets).
 */
function applyProductionRecovery(
  stage: AssignmentsRenderStage
): { stage: AssignmentsRenderStage; recovered: boolean } {
  if (!isProductionRuntime() || bisectAllowedInProduction()) {
    return { stage, recovered: false };
  }
  if (stage === "static-table" || stage === "expansion") {
    return { stage: PRODUCTION_RECOVERY_TARGET, recovered: true };
  }
  return { stage, recovered: false };
}

/**
 * Debug banner: shown during recovery bisects; hidden in Production when stage is `full`.
 */
export function shouldShowAssignmentsRenderStageBanner(
  stage: AssignmentsRenderStage
): boolean {
  if (process.env.ASSIGNMENTS_HIDE_RENDER_STAGE_BANNER === "1") return false;
  if (process.env.ASSIGNMENTS_SHOW_RENDER_STAGE_BANNER === "1") return true;
  if (isProductionRuntime()) return stage !== "full";
  return process.env.NODE_ENV === "development";
}

export type ResolvedAssignmentsRenderStage = {
  stage: AssignmentsRenderStage;
  source: AssignmentsRenderStageSource;
  showRenderStageBanner: boolean;
  requestedStage: AssignmentsRenderStage;
};

/**
 * Server-only: resolve stage from runtime env (campaign page → client props).
 */
export function resolveAssignmentsRenderStage(): ResolvedAssignmentsRenderStage {
  const serverRaw = process.env.ASSIGNMENTS_RENDER_STAGE?.trim();
  const publicRaw = process.env.NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE?.trim();

  let stage: AssignmentsRenderStage;
  let source: AssignmentsRenderStageSource;

  if (serverRaw) {
    stage = parseAssignmentsRenderStage(serverRaw);
    source = "server";
  } else if (publicRaw) {
    stage = parseAssignmentsRenderStage(publicRaw);
    source = "next_public";
  } else {
    stage = DEFAULT_STAGE;
    source = "default";
  }

  const requestedStage = stage;
  const recovered = applyProductionRecovery(stage);
  if (recovered.recovered) {
    stage = recovered.stage;
    source = "production_recovery";
  }

  return {
    stage,
    source,
    requestedStage,
    showRenderStageBanner: shouldShowAssignmentsRenderStageBanner(stage),
  };
}

/** Client fallback when stage prop is not passed (local dev / legacy paths). */
export function getAssignmentsRenderStage(): AssignmentsRenderStage {
  const parsed = parseAssignmentsRenderStage(
    process.env.NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE
  );
  return applyProductionRecovery(parsed).stage;
}

export function assignmentsStageAtLeast(
  current: AssignmentsRenderStage,
  required: AssignmentsRenderStage
): boolean {
  return STAGE_RANK[current] >= STAGE_RANK[required];
}

export function assignmentsStageLabel(stage: AssignmentsRenderStage): string {
  return stage.replace(/-/g, " ");
}

export function assignmentsRenderStageSourceLabel(
  source: AssignmentsRenderStageSource,
  requestedStage?: AssignmentsRenderStage
): string {
  switch (source) {
    case "server":
      return "ASSIGNMENTS_RENDER_STAGE";
    case "next_public":
      return "NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE";
    case "production_recovery":
      return requestedStage
        ? `production recovery (${requestedStage}→${PRODUCTION_RECOVERY_TARGET})`
        : "production recovery";
    default:
      return "code default";
  }
}
