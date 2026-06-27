import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type {
  OperationalDeliverableExplorerRow,
  OperationalDeliverableFlattenStats,
} from "@/lib/domains/campaign/operational-deliverable-explorer";
import type { CampaignDeliverableRow } from "@/lib/domains/campaign/workspace-types";
import {
  deliverableTypeShortLabel,
  getPlatformOptionLabel,
} from "@/lib/campaigns/deliverable-taxonomy";

function buildSearchText(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function resolvePublicationStatus(
  deliverableId: string,
  postId: string | null,
  pubByPost: Map<string, string>,
  pubByDeliverable: Map<string, string>
): string | null {
  if (postId && pubByPost.has(postId)) return pubByPost.get(postId) ?? null;
  if (pubByDeliverable.has(deliverableId)) return pubByDeliverable.get(deliverableId) ?? null;
  return null;
}

function mapLegacyDeliverable(row: CampaignDeliverableRow): OperationalDeliverableExplorerRow {
  const platform = row.platform ?? "other";
  const deliverableType = row.deliverable_type ?? "other";
  const label = row.title ?? "Legacy deliverable";
  return {
    id: `legacy-${row.id}`,
    row_kind: "deliverable",
    campaign_line_id: "",
    assignment_deliverable_id: row.id,
    assignment_post_schedule_id: null,
    assignment_title: label,
    creator_name: row.influencer_name ?? null,
    creator_avatar_url: null,
    influencer_id: null,
    platform,
    platform_label: getPlatformOptionLabel(platform),
    deliverable_type: deliverableType,
    deliverable_type_label: deliverableType.replace(/_/g, " "),
    label,
    workflow_status: row.display_status ?? row.status ?? "draft",
    billing_status: "legacy",
    publication_status: row.content_url ? "published" : null,
    live_date: row.due_date,
    notes: null,
    is_synthetic: false,
    is_virtual_post: false,
    sequence_number: null,
    search_text: buildSearchText([
      label,
      row.influencer_name,
      platform,
      deliverableType,
      row.document_number,
      row.display_status,
    ]),
  };
}

export function flattenOperationalDeliverables(
  hierarchy: AssignmentHierarchy,
  publications: CampaignPublicationRow[] = [],
  legacyDeliverables: CampaignDeliverableRow[] = []
): {
  rows: OperationalDeliverableExplorerRow[];
  stats: OperationalDeliverableFlattenStats;
} {
  const pubByPost = new Map<string, string>();
  const pubByDeliverable = new Map<string, string>();
  for (const pub of publications ?? []) {
    if (pub.assignment_post_schedule_id) {
      pubByPost.set(pub.assignment_post_schedule_id, pub.status);
    }
    if (pub.assignment_deliverable_id) {
      pubByDeliverable.set(pub.assignment_deliverable_id, pub.status);
    }
  }

  const rows: OperationalDeliverableExplorerRow[] = [];
  let deliverableGroups = 0;
  let postScheduleRows = 0;
  let deliverableFallbackRows = 0;

  for (const group of hierarchy.groups ?? []) {
    const line = group?.line;
    if (!line?.id) continue;

    const creatorName = line.influencer_name ?? null;
    const creatorAvatarUrl = line.creator_avatar_url ?? null;
    const assignmentTitle = line.name ?? "Assignment";

    for (const deliverable of group.deliverables ?? []) {
      deliverableGroups++;
      const posts = Array.isArray(deliverable.posts) ? deliverable.posts : [];
      const realPosts = posts.filter((p) => {
        const id = p?.id;
        return typeof id === "string" && !id.startsWith("virtual-");
      });

      const deliverableRow: OperationalDeliverableExplorerRow = {
        id: deliverable.id,
        row_kind: "deliverable",
        campaign_line_id: line.id,
        assignment_deliverable_id: deliverable.id,
        assignment_post_schedule_id: null,
        assignment_title: assignmentTitle,
        creator_name: creatorName,
        creator_avatar_url: creatorAvatarUrl,
        influencer_id: line.influencer_id,
        platform: deliverable.platform,
        platform_label: getPlatformOptionLabel(deliverable.platform),
        deliverable_type: deliverable.deliverable_type,
        deliverable_type_label:
          deliverable.deliverable_type_label ??
          deliverableTypeShortLabel(deliverable.deliverable_type),
        label: deliverable.label ?? deliverable.deliverable_type_label,
        workflow_status: deliverable.workflow_status ?? "draft",
        billing_status: deliverable.billing_status ?? "draft",
        publication_status: resolvePublicationStatus(
          deliverable.id,
          null,
          pubByPost,
          pubByDeliverable
        ),
        live_date: deliverable.live_date ?? posts[0]?.live_date ?? null,
        notes: deliverable.notes,
        is_synthetic: deliverable.is_synthetic ?? false,
        is_virtual_post: false,
        sequence_number: null,
        search_text: buildSearchText([
          assignmentTitle,
          creatorName,
          deliverable.platform,
          deliverable.deliverable_type,
          deliverable.deliverable_type_label,
          deliverable.label,
          deliverable.notes,
          deliverable.workflow_status,
          deliverable.billing_status,
        ]),
      };

      if (realPosts.length > 0) {
        for (const post of realPosts) {
          postScheduleRows++;
          const platform = post.platform ?? deliverable.platform;
          const deliverableType = post.deliverable_type ?? deliverable.deliverable_type;
          const typeLabel =
            post.deliverable_type_label ?? deliverableTypeShortLabel(deliverableType);

          rows.push({
            id: post.id,
            row_kind: "post",
            campaign_line_id: line.id,
            assignment_deliverable_id: deliverable.id,
            assignment_post_schedule_id: post.id,
            assignment_title: assignmentTitle,
            creator_name: creatorName,
            creator_avatar_url: creatorAvatarUrl,
            influencer_id: line.influencer_id,
            platform,
            platform_label: getPlatformOptionLabel(platform),
            deliverable_type: deliverableType,
            deliverable_type_label: typeLabel,
            label: post.label ?? `${typeLabel} #${post.sequence_number}`,
            workflow_status: post.workflow_status ?? "draft",
            billing_status: post.billing_status ?? deliverable.billing_status ?? "draft",
            publication_status: resolvePublicationStatus(
              deliverable.id,
              post.id,
              pubByPost,
              pubByDeliverable
            ),
            live_date: post.live_date,
            notes: post.notes,
            is_synthetic: deliverable.is_synthetic ?? false,
            is_virtual_post: false,
            sequence_number: post.sequence_number,
            search_text: buildSearchText([
              assignmentTitle,
              creatorName,
              platform,
              deliverableType,
              typeLabel,
              post.label,
              post.notes,
              post.workflow_status,
              post.billing_status,
              String(post.sequence_number),
            ]),
          });
        }
      } else {
        deliverableFallbackRows++;
        rows.push(deliverableRow);
      }
    }
  }

  let legacyFallbackRows = 0;
  if (rows.length === 0 && (legacyDeliverables?.length ?? 0) > 0) {
    for (const legacy of legacyDeliverables) {
      legacyFallbackRows++;
      rows.push(mapLegacyDeliverable(legacy));
    }
  }

  const stats: OperationalDeliverableFlattenStats = {
    deliverable_groups: deliverableGroups,
    post_schedule_rows: postScheduleRows,
    deliverable_fallback_rows: deliverableFallbackRows,
    total_explorer_rows: rows.length,
    legacy_fallback_rows: legacyFallbackRows,
    hierarchy_load_error: hierarchy.load_error ?? null,
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[deliverables-explorer] flattened operational rows", stats);
  }

  return { rows, stats };
}
