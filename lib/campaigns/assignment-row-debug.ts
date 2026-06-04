import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";

type RowDebugShape = {
  line_id: string;
  operational_status: string | null;
  deliverable_count: number;
  post_count: number;
  vendor_io_id: string | null;
  invoice_id: string | null;
};

function countPosts(hierarchy: AssignmentHierarchy): RowDebugShape[] {
  const rows: RowDebugShape[] = [];
  for (const group of hierarchy.groups ?? []) {
    const line = group?.line;
    if (!line?.id) continue;
    const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];
    let postCount = 0;
    for (const d of deliverables) {
      const posts = Array.isArray(d.posts) ? d.posts : [];
      postCount += posts.length;
    }
    rows.push({
      line_id: String(line.id),
      operational_status: line.operational_status ?? null,
      deliverable_count: deliverables.length,
      post_count: postCount,
      vendor_io_id: line.vendor_io_id ?? null,
      invoice_id: line.invoice_id ?? null,
    });
  }
  return rows;
}

/** Dev/prod-safe logging for post–Vendor IO regeneration bisects. */
export function logAssignmentHierarchyRows(
  hierarchy: AssignmentHierarchy,
  context: { campaignId?: string; layer?: string } = {}
): void {
  const rows = countPosts(hierarchy);
  console.log("[Assignments] ROWS", {
    campaignId: context.campaignId,
    layer: context.layer,
    count: rows.length,
    rows,
  });
  for (const row of rows) {
    console.log("[Assignments] ROW STATUS", row.line_id, row.operational_status);
    console.log("[Assignments] ROW DELIVERABLES", row.line_id, {
      deliverables: row.deliverable_count,
      posts: row.post_count,
    });
    console.log("[Assignments] ROW VIO", row.line_id, row.vendor_io_id, row.invoice_id);
  }
}

export function logPreparedAssignmentRows(
  prepared: AssignmentRowViewModel[],
  context: { campaignId?: string; layer?: string } = {}
): void {
  console.log("[Assignments] PREPARED ROWS", {
    campaignId: context.campaignId,
    layer: context.layer,
    count: prepared.length,
  });
  for (const row of prepared) {
    const deliverables = Array.isArray(row.group.deliverables) ? row.group.deliverables : [];
    console.log("[Assignments] ROW STATUS", row.lineId, row.operationalStatus);
    console.log("[Assignments] ROW DELIVERABLES", row.lineId, deliverables.length);
    console.log("[Assignments] ROW VIO", row.lineId, row.group.line.vendor_io_id);
  }
}

export function validateAssignmentHierarchyClient(
  hierarchy: AssignmentHierarchy
): string[] {
  const warnings: string[] = [];
  const lineIds = new Set<string>();
  const deliverableIds = new Set<string>();

  for (const group of hierarchy.groups ?? []) {
    const line = group?.line;
    if (!line?.id) continue;

    const lineId = String(line.id);
    if (lineIds.has(lineId)) {
      warnings.push(`Duplicate React key risk: campaign line ${lineId}`);
    }
    lineIds.add(lineId);

    if (line.operational_status === "reopened" && !line.vendor_io_id) {
      warnings.push(`Line ${lineId}: reopened without vendor_io_id`);
    }
    if (line.operational_status === "io_generated" && !line.vendor_io_id) {
      warnings.push(`Line ${lineId}: io_generated without vendor_io_id`);
    }

    const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];
    for (const d of deliverables) {
      if (!d?.id) continue;
      if (deliverableIds.has(d.id)) {
        warnings.push(`Duplicate deliverable id ${d.id} on line ${lineId}`);
      }
      deliverableIds.add(d.id);

      const posts = Array.isArray(d.posts) ? d.posts : [];
      for (const post of posts) {
        if (!post?.id) {
          warnings.push(`Line ${lineId} deliverable ${d.id}: post missing id`);
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("[Assignments] hierarchy validation", warnings);
  }

  return warnings;
}
