import type {
  ComponentStatus,
  DependencyGraph,
  HealthCheckResult,
} from "../types";

const TOPOLOGY: Array<{ id: string; label: string; dependsOn: string[] }> = [
  { id: "users", label: "Users", dependsOn: [] },
  { id: "nextjs", label: "Next.js", dependsOn: ["users"] },
  { id: "api", label: "API", dependsOn: ["nextjs"] },
  { id: "supabase", label: "Supabase", dependsOn: ["api"] },
  { id: "redis", label: "Redis", dependsOn: ["api"] },
  { id: "bullmq", label: "BullMQ", dependsOn: ["redis"] },
  { id: "storage", label: "Storage", dependsOn: ["supabase"] },
  { id: "openai", label: "AI", dependsOn: ["api"] },
  { id: "resend", label: "Email", dependsOn: ["api"] },
  { id: "apify", label: "Discovery", dependsOn: ["api", "bullmq", "openai"] },
  { id: "finance-domain", label: "Finance", dependsOn: ["supabase", "api"] },
];

function statusForNode(
  id: string,
  components: Map<string, HealthCheckResult>,
): { status: ComponentStatus; latencyMs: number | null; lastFailure: string | null } {
  if (id === "users") {
    return { status: "healthy", latencyMs: null, lastFailure: null };
  }
  if (id === "api") {
    const next = components.get("nextjs");
    return {
      status: next?.status ?? "unknown",
      latencyMs: next?.latencyMs ?? null,
      lastFailure: next?.lastFailure ?? null,
    };
  }
  if (id === "finance-domain") {
    const db = components.get("supabase");
    return {
      status: db?.status ?? "unknown",
      latencyMs: db?.latencyMs ?? null,
      lastFailure: db?.lastFailure ?? null,
    };
  }
  const component = components.get(id);
  return {
    status: component?.status ?? "unknown",
    latencyMs: component?.latencyMs ?? null,
    lastFailure: component?.lastFailure ?? null,
  };
}

export function buildDependencyGraph(
  components: HealthCheckResult[],
): DependencyGraph {
  const map = new Map(components.map((c) => [c.id, c]));
  const nodes = TOPOLOGY.map((node) => {
    const live = statusForNode(node.id, map);
    return {
      id: node.id,
      label: node.label,
      status: live.status,
      latencyMs: live.latencyMs,
      dependsOn: node.dependsOn,
      lastFailure: live.lastFailure,
    };
  });

  const edges: Array<{ from: string; to: string }> = [];
  for (const node of TOPOLOGY) {
    for (const parent of node.dependsOn) {
      edges.push({ from: parent, to: node.id });
    }
  }

  return { nodes, edges };
}
