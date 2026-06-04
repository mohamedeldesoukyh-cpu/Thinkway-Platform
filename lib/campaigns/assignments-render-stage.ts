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

/** When no env is set — expansion (grid + children, no footer/dialogs). */
const DEFAULT_STAGE: AssignmentsRenderStage = "expansion";

export function parseAssignmentsRenderStage(
  raw: string | null | undefined
): AssignmentsRenderStage {
  const value = raw?.trim().toLowerCase();
  if (value && ASSIGNMENTS_RENDER_STAGES.includes(value as AssignmentsRenderStage)) {
    return value as AssignmentsRenderStage;
  }
  return DEFAULT_STAGE;
}

/**
 * Server-only: resolve stage from runtime env (campaign page → client props).
 * In Vercel Production, ignores stale `static-table` unless explicitly set via
 * `ASSIGNMENTS_RENDER_STAGE=static-table` (emergency bisect).
 */
export function resolveAssignmentsRenderStage(): {
  stage: AssignmentsRenderStage;
  source: "server" | "next_public" | "default" | "production_recovery";
} {
  const serverRaw = process.env.ASSIGNMENTS_RENDER_STAGE;
  const publicRaw = process.env.NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE;

  if (serverRaw?.trim()) {
    return {
      stage: parseAssignmentsRenderStage(serverRaw),
      source: "server",
    };
  }

  const fromPublic = parseAssignmentsRenderStage(publicRaw);

  if (process.env.VERCEL_ENV === "production" && fromPublic === "static-table") {
    return { stage: "footer", source: "production_recovery" };
  }

  if (publicRaw?.trim()) {
    return { stage: fromPublic, source: "next_public" };
  }

  return { stage: DEFAULT_STAGE, source: "default" };
}

/** Client fallback when stage prop is not passed (local dev / legacy paths). */
export function getAssignmentsRenderStage(): AssignmentsRenderStage {
  return parseAssignmentsRenderStage(process.env.NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE);
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
  source: ReturnType<typeof resolveAssignmentsRenderStage>["source"]
): string {
  switch (source) {
    case "server":
      return "ASSIGNMENTS_RENDER_STAGE";
    case "next_public":
      return "NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE";
    case "production_recovery":
      return "production recovery (ignored static-table)";
    default:
      return "code default";
  }
}
