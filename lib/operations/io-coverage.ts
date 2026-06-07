/**
 * Vendor IO coverage comparison for invoice reopen/regenerate governance.
 * CASE A: no commercial/operational delta → direct regenerate (same IO refs).
 * CASE B: IO exists + commercial delta → warning + revision under same IO serial.
 * CASE C: new uncovered lines/deliverables → block until IO generated.
 */

export type IoDeliverableSnapshot = {
  id: string;
  platform: string;
  deliverable_type: string;
  quantity: number;
  revenue_before_vat: number;
  cost_before_vat: number;
};

export type IoLineSnapshot = {
  line_id: string;
  line_name?: string;
  vendor_io_id?: string | null;
  active_vendor_io_id?: string | null;
  vendor_io_document_number?: string | null;
  /** Active Vendor IO stored amount — compared to cost_before_vat for drift revision. */
  vendor_io_amount?: number | null;
  influencer_id?: string | null;
  revenue_before_vat: number;
  cost_before_vat: number;
  deliverables: IoDeliverableSnapshot[];
};

export type IoCoverageLineCategory = "unchanged" | "revised" | "needs_io";

export type IoCoverageLineResult = {
  line_id: string;
  line_name: string;
  category: IoCoverageLineCategory;
  vendor_io_document_number: string | null;
  change_summary: string | null;
};

export type IoCoverageCase = "safe_regeneration" | "revision_warning" | "blocked";

export type IoCoverageAnalysis = {
  case: IoCoverageCase;
  lines: IoCoverageLineResult[];
  unchanged_line_ids: string[];
  revised_line_ids: string[];
  needs_io_line_ids: string[];
  warning_message: string | null;
  block_message: string | null;
  allows_direct_regeneration: boolean;
};

/** Explicit user selection — non-selected rows must never affect validation. */
export type IoCoverageSelectionScope = {
  lineIds: string[];
  deliverableIds?: string[];
};

const MONEY_EPSILON = 0.01;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function moneyEqual(a: number, b: number): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= MONEY_EPSILON;
}

export function hasExistingIoCoverage(
  input: Pick<
    IoLineSnapshot,
    "vendor_io_id" | "active_vendor_io_id" | "vendor_io_document_number"
  >
): boolean {
  return Boolean(
    input.active_vendor_io_id ?? input.vendor_io_id ?? input.vendor_io_document_number
  );
}

function deliverableFingerprint(d: IoDeliverableSnapshot): string {
  return [
    d.id,
    d.platform,
    d.deliverable_type,
    d.quantity,
    roundMoney(d.revenue_before_vat),
    roundMoney(d.cost_before_vat),
  ].join("|");
}

function lineHeaderFingerprint(
  line: Pick<IoLineSnapshot, "influencer_id" | "revenue_before_vat" | "cost_before_vat">
): string {
  return [
    line.influencer_id ?? "",
    roundMoney(line.revenue_before_vat),
    roundMoney(line.cost_before_vat),
  ].join("|");
}

export function hasCommercialDelta(
  baseline: IoLineSnapshot,
  current: IoLineSnapshot
): boolean {
  if (lineHeaderFingerprint(baseline) !== lineHeaderFingerprint(current)) {
    return true;
  }

  const baselineById = new Map(
    baseline.deliverables.map((d) => [d.id, deliverableFingerprint(d)])
  );
  const currentById = new Map(
    current.deliverables.map((d) => [d.id, deliverableFingerprint(d)])
  );

  for (const [id, fp] of baselineById) {
    const currentFp = currentById.get(id);
    if (!currentFp || currentFp !== fp) return true;
  }

  for (const id of currentById.keys()) {
    if (!baselineById.has(id)) return true;
  }

  return false;
}

export function requiresNewIoGeneration(
  current: IoLineSnapshot,
  baseline: IoLineSnapshot | null
): boolean {
  if (!hasExistingIoCoverage(current)) return true;

  // Line already has Vendor IO — absence of baseline only means "no prior invoice
  // snapshot in scope", not "needs new IO generation".
  if (!baseline) return false;

  const baselineIds = new Set(baseline.deliverables.map((d) => d.id));
  const newDeliverables = current.deliverables.filter((d) => !baselineIds.has(d.id));
  if (newDeliverables.length === 0) return false;

  return newDeliverables.some(
    (d) => d.revenue_before_vat > MONEY_EPSILON || d.quantity > 0
  );
}

export function hasVendorIoAmountDrift(current: IoLineSnapshot): boolean {
  if (!hasExistingIoCoverage(current)) return false;
  if (current.vendor_io_amount == null) return false;
  return !moneyEqual(current.cost_before_vat, current.vendor_io_amount);
}

export function requiresIoRevision(
  baseline: IoLineSnapshot | null,
  current: IoLineSnapshot
): boolean {
  if (!hasExistingIoCoverage(current)) return false;
  if (requiresNewIoGeneration(current, baseline)) return false;
  if (hasVendorIoAmountDrift(current)) return true;
  if (!baseline) return false;
  return hasCommercialDelta(baseline, current);
}

export function classifyIoCoverageLine(
  baseline: IoLineSnapshot | null,
  current: IoLineSnapshot
): IoCoverageLineResult {
  const lineName = current.line_name ?? current.line_id;
  const vioDoc =
    current.vendor_io_document_number ??
    (current.active_vendor_io_id || current.vendor_io_id ? "linked" : null);

  if (requiresNewIoGeneration(current, baseline)) {
    return {
      line_id: current.line_id,
      line_name: lineName,
      category: "needs_io",
      vendor_io_document_number: vioDoc,
      change_summary: baseline
        ? "New assignment or deliverable has no Vendor IO coverage."
        : "Assignment has never had Vendor IO generated.",
    };
  }

  if (requiresIoRevision(baseline, current)) {
    const amountDrift = hasVendorIoAmountDrift(current);
    const commercialDelta =
      baseline != null && hasCommercialDelta(baseline, current);
    return {
      line_id: current.line_id,
      line_name: lineName,
      category: "revised",
      vendor_io_document_number: vioDoc,
      change_summary:
        amountDrift && !commercialDelta
          ? "Vendor IO amount does not match creator cost."
          : "Commercial fields changed (price, deliverables, quantity, cost, or creator).",
    };
  }

  return {
    line_id: current.line_id,
    line_name: lineName,
    category: "unchanged",
    vendor_io_document_number: vioDoc,
    change_summary: null,
  };
}

export function analyzeIoCoverage(input: {
  currents: IoLineSnapshot[];
  baselines: Map<string, IoLineSnapshot>;
  scope?: IoCoverageSelectionScope;
}): IoCoverageAnalysis {
  const scopedLineIds = input.scope?.lineIds
    ? new Set(input.scope.lineIds)
    : null;
  const scopedDeliverableIds = input.scope?.deliverableIds?.length
    ? new Set(input.scope.deliverableIds)
    : null;

  const scopedCurrents = input.currents
    .filter((current) => !scopedLineIds || scopedLineIds.has(current.line_id))
    .map((current) => narrowSnapshotToScope(current, scopedDeliverableIds));

  const lines = scopedCurrents.map((current) => {
    const baseline = input.baselines.get(current.line_id) ?? null;
    const scopedBaseline = baseline
      ? narrowSnapshotToScope(baseline, scopedDeliverableIds)
      : null;
    return classifyIoCoverageLine(scopedBaseline, current);
  });

  const unchanged_line_ids = lines
    .filter((l) => l.category === "unchanged")
    .map((l) => l.line_id);
  const revised_line_ids = lines
    .filter((l) => l.category === "revised")
    .map((l) => l.line_id);
  const needs_io_line_ids = lines
    .filter((l) => l.category === "needs_io")
    .map((l) => l.line_id);

  if (needs_io_line_ids.length > 0) {
    return {
      case: "blocked",
      lines,
      unchanged_line_ids,
      revised_line_ids,
      needs_io_line_ids,
      warning_message: null,
      block_message:
        "Generate Vendor IO for new assignments or deliverables before invoicing.",
      allows_direct_regeneration: false,
    };
  }

  if (revised_line_ids.length > 0) {
    return {
      case: "revision_warning",
      lines,
      unchanged_line_ids,
      revised_line_ids,
      needs_io_line_ids,
      warning_message:
        "Vendor IO revision will be generated under same IO number.",
      block_message: null,
      allows_direct_regeneration: true,
    };
  }

  return {
    case: "safe_regeneration",
    lines,
    unchanged_line_ids,
    revised_line_ids,
    needs_io_line_ids,
    warning_message: null,
    block_message: null,
    allows_direct_regeneration: true,
  };
}

export function isSafeInvoiceRegeneration(analysis: IoCoverageAnalysis): boolean {
  return analysis.case === "safe_regeneration";
}

export const IO_COVERAGE_REVISION_WARNING =
  "Vendor IO revision will be generated under same IO number.";

function narrowSnapshotToScope(
  snapshot: IoLineSnapshot,
  deliverableIds: Set<string> | null
): IoLineSnapshot {
  if (!deliverableIds || deliverableIds.size === 0) {
    return snapshot;
  }

  const deliverables = snapshot.deliverables.filter((d) => deliverableIds.has(d.id));
  const revenue_before_vat = deliverables.reduce(
    (sum, d) => sum + d.revenue_before_vat,
    0
  );
  const cost_before_vat = deliverables.reduce((sum, d) => sum + d.cost_before_vat, 0);

  return {
    ...snapshot,
    deliverables,
    revenue_before_vat: deliverables.length > 0 ? revenue_before_vat : snapshot.revenue_before_vat,
    cost_before_vat: deliverables.length > 0 ? cost_before_vat : snapshot.cost_before_vat,
  };
}
