import { isStructuredLoggingEnabled } from "@/lib/observability/environment";

/** Enable with AI_SEARCH_TRACE=1 (or AI_SEARCH_DIAG=1 for legacy compat). Server only. */
export const AI_SEARCH_TRACE_ENABLED =
  typeof window === "undefined" &&
  (process.env.AI_SEARCH_TRACE === "1" ||
    process.env.AI_SEARCH_DIAG === "1" ||
    process.env.AI_WORKFLOW_TRACE === "1" ||
    process.env.NODE_ENV === "development");

/** Structured prod metrics for discovery search/browse/hydration when trace console is off. */
export const DISCOVERY_STRUCTURED_METRICS_ENABLED =
  typeof window === "undefined" &&
  (isStructuredLoggingEnabled() || process.env.DISCOVERY_METRICS === "1");

function emitDiscoveryStructuredLog(
  stage: string,
  data: Record<string, unknown> | undefined,
  path: SearchTracePath,
  level: "info" | "warn" = "info"
): void {
  if (!DISCOVERY_STRUCTURED_METRICS_ENABLED) return;
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "discovery",
    message: `discovery.${stage}`,
    stage,
    path,
    ...(data ?? {}),
  });
  if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Workflow object-mapping trace — also enabled by AI_SEARCH_TRACE=1. */
export const AI_WORKFLOW_TRACE_ENABLED =
  typeof window === "undefined" &&
  (process.env.AI_WORKFLOW_TRACE === "1" ||
    process.env.AI_SEARCH_TRACE === "1" ||
    process.env.AI_SEARCH_DIAG === "1");

const CREATOR_COUNT_PATHS = [
  "creators",
  "items",
  "results",
  "profiles",
  "workflowCreators",
  "searchResults",
] as const;

export type ObjectShapeSnapshot = {
  label: string;
  keys: string[];
  creatorsLen: number | null;
  total: number | null;
  paths: Record<string, number | string | null>;
};

function readNestedPath(root: unknown, path: string): unknown {
  if (!root || typeof root !== "object") return undefined;
  let cur: unknown = root;
  for (const segment of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

/** Summarize creator-bearing object shape for workflow boundary tracing. */
export function logObjectShape(obj: unknown, label: string): ObjectShapeSnapshot {
  const keys =
    obj && typeof obj === "object" && !Array.isArray(obj)
      ? Object.keys(obj as object)
      : Array.isArray(obj)
        ? ["[array]"]
        : [];

  const paths: Record<string, number | string | null> = {};
  let creatorsLen: number | null = null;
  let total: number | null = null;

  const noteArrayPath = (path: string, val: unknown) => {
    if (Array.isArray(val)) {
      paths[path] = val.length;
      if (
        creatorsLen == null &&
        (path === "creators" ||
          path.endsWith(".creators") ||
          path === "workflowCreators" ||
          path === "searchResults" ||
          path === "data.searchResults")
      ) {
        creatorsLen = val.length;
      }
    } else if (val !== undefined) {
      paths[path] = typeof val === "number" ? val : String(val);
    }
  };

  for (const path of CREATOR_COUNT_PATHS) {
    noteArrayPath(path, readNestedPath(obj, path));
  }

  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    if (typeof record.total === "number") total = record.total;
    if (Array.isArray(record.creators)) creatorsLen = record.creators.length;

    const data = record.data;
    if (data && typeof data === "object") {
      const dataRecord = data as Record<string, unknown>;
      noteArrayPath("data.searchResults", dataRecord.searchResults);
      if (typeof dataRecord.searchTotal === "number") {
        paths["data.searchTotal"] = dataRecord.searchTotal;
        if (total == null) total = dataRecord.searchTotal;
      }
    }

    const structured = record.structured;
    if (structured && typeof structured === "object") {
      const structuredRecord = structured as Record<string, unknown>;
      noteArrayPath("structured.creators", structuredRecord.creators);
      if (typeof structuredRecord.total === "number") {
        paths["structured.total"] = structuredRecord.total;
      }

      const toolOutputs = structuredRecord.toolOutputs;
      if (Array.isArray(toolOutputs)) {
        for (const entry of toolOutputs) {
          if (!entry || typeof entry !== "object") continue;
          const toolEntry = entry as { tool?: string; output?: unknown };
          const toolName = toolEntry.tool ?? "unknown";
          if (toolEntry.output && typeof toolEntry.output === "object") {
            const output = toolEntry.output as Record<string, unknown>;
            const pathKey = `toolOutputs.${toolName}.creators`;
            noteArrayPath(pathKey, output.creators);
            if (toolName === "searchCreators" && typeof output.total === "number") {
              total = output.total;
              paths[`toolOutputs.${toolName}.total`] = output.total;
            }
          }
        }
      }
    }

    const metadata = record.metadata;
    if (metadata && typeof metadata === "object") {
      noteArrayPath(
        "metadata.workflowCreators",
        (metadata as Record<string, unknown>).workflowCreators
      );
    }
  }

  return { label, keys, creatorsLen, total, paths };
}

export function workflowTrace(
  stage: string,
  obj: unknown,
  label: string,
  extra?: Record<string, unknown>
): ObjectShapeSnapshot {
  if (!AI_WORKFLOW_TRACE_ENABLED) {
    return logObjectShape(obj, label);
  }
  const shape = logObjectShape(obj, label);
  const payload = { ...shape, ...extra };
  if (
    typeof shape.creatorsLen === "number" &&
    shape.creatorsLen === 0 &&
    shape.total != null &&
    shape.total > 0
  ) {
    console.warn(`[workflow-trace] COUNT_MISMATCH @ ${stage}`, payload);
  } else {
    console.info(`[workflow-trace] ${stage}`, payload);
  }
  return shape;
}

export type SearchTracePath = "ai" | "discovery" | "unknown";

export type SearchTraceOptions = {
  path?: SearchTracePath;
};

export function searchTrace(
  stage: string,
  data?: Record<string, unknown>,
  options?: SearchTraceOptions
): void {
  const path = options?.path ?? "unknown";
  if (AI_SEARCH_TRACE_ENABLED) {
    console.info(`[search-trace:${path}] ${stage}`, data ?? {});
  }
  if (DISCOVERY_STRUCTURED_METRICS_ENABLED) {
    emitDiscoveryStructuredLog(stage, data, path);
  }
}

export function traceCountDrop(
  stage: string,
  filter: string,
  countBefore: number,
  countAfter: number,
  extra?: Record<string, unknown>,
  options?: SearchTraceOptions
): void {
  const path = options?.path ?? "unknown";
  const data = { filter, countBefore, countAfter, ...extra };
  if (AI_SEARCH_TRACE_ENABLED) {
    if (countBefore > 0 && countAfter === 0) {
      console.warn(`[search-trace:${path}] COUNT_DROP @ ${stage}`, data);
    } else {
      console.info(`[search-trace:${path}] ${stage}`, data);
    }
  }
  if (DISCOVERY_STRUCTURED_METRICS_ENABLED && countBefore > 0 && countAfter === 0) {
    emitDiscoveryStructuredLog(
      stage,
      { filter, countBefore, countAfter, ...extra },
      path,
      "warn"
    );
  }
}
