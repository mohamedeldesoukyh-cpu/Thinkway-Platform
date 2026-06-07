import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

export type ChildrenAccessOp = "length" | "map" | "iterable" | "filter" | "reduce";

const TRACE_ENABLED =
  process.env.OPERATIONAL_BILLING_TRACE === "1" ||
  process.env.NODE_ENV === "development";

export type OperationalRowTraceSnapshot = {
  stage: string;
  op: ChildrenAccessOp;
  id: unknown;
  kind: unknown;
  children: unknown;
  childrenType: string;
  hasChildrenKey: boolean;
  keys: string[];
  json: string;
};

function safeRowJson(row: unknown): string {
  try {
    return JSON.stringify(row).slice(0, 1000);
  } catch (error) {
    return `[unserializable: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

export function snapshotOperationalRow(
  row: unknown
): Omit<OperationalRowTraceSnapshot, "stage" | "op"> {
  const record =
    row != null && typeof row === "object"
      ? (row as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  return {
    id: record.id ?? null,
    kind: record.kind ?? null,
    children: record.children,
    childrenType: typeof record.children,
    hasChildrenKey: Object.prototype.hasOwnProperty.call(record, "children"),
    keys: Object.keys(record),
    json: safeRowJson(row),
  };
}

/** Log row shape and throw before children.length / .map / iteration when invariant is broken. */
export function traceChildrenAccess(
  stage: string,
  row: unknown,
  op: ChildrenAccessOp
): asserts row is OperationalBillingRow {
  if (!TRACE_ENABLED) return;

  const record =
    row != null && typeof row === "object"
      ? (row as Record<string, unknown>)
      : null;
  const children = record?.children;
  const valid = Array.isArray(children);

  if (!valid) {
    const snapshot: OperationalRowTraceSnapshot = {
      stage,
      op,
      ...snapshotOperationalRow(row),
    };
    const traceError = new Error(
      `[operational-billing-trace] ${stage}: invalid children before .${op} on row ${String(snapshot.id)}`
    );
    console.error("[operational-billing-trace] MALFORMED_ROW", snapshot);
    console.error(traceError.stack);
    throw traceError;
  }
}

export function traceOperationalTreeStage(
  stage: string,
  rows: OperationalBillingRow[] | null | undefined
): void {
  if (!TRACE_ENABLED) return;

  const walk = (node: OperationalBillingRow, path: string[]) => {
    traceChildrenAccess(`${stage}@${path.join(">")}`, node, "iterable");
    for (let index = 0; index < node.children.length; index += 1) {
      walk(node.children[index], [...path, `${node.kind}:${node.id}[${index}]`]);
    }
  };

  for (const row of rows ?? []) {
    walk(row, ["root"]);
  }

  console.log(`[operational-billing-trace] ${stage}: tree invariant OK`, {
    roots: rows?.length ?? 0,
  });
}

export function traceOperationalRowProducer(
  stage: string,
  row: OperationalBillingRow
): void {
  if (!TRACE_ENABLED) return;

  const snapshot = snapshotOperationalRow(row);
  const valid = Array.isArray(row.children);

  console.log(`[operational-billing-trace] producer:${stage}`, {
    id: snapshot.id,
    kind: snapshot.kind,
    childrenType: snapshot.childrenType,
    childrenLength: Array.isArray(row.children) ? row.children.length : null,
    hasChildrenKey: snapshot.hasChildrenKey,
  });

  if (!valid) {
    console.error("[operational-billing-trace] PRODUCER_MALFORMED", {
      stage,
      ...snapshot,
    });
    throw new Error(
      `[operational-billing-trace] producer:${stage} created row ${String(snapshot.id)} without array children`
    );
  }
}

export function logCampaignWorkspaceLoadError(
  stage: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[campaign-workspace-trace] ${stage} FAILED`, {
    message,
    stack,
    ...context,
  });
}
