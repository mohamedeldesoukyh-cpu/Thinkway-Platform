import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildPublicationSelectList,
  CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS,
  CAMPAIGN_PUBLICATIONS_TABLE,
  partitionSchemaColumns,
  type CampaignPublicationColumn,
} from "@/lib/campaigns/campaign-publications-schema";

type SchemaCache = {
  columns: Set<string>;
  fetchedAt: number;
  warnings: string[];
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let schemaCache: SchemaCache | null = null;

const FALLBACK_MINIMAL_COLUMNS = new Set<string>([
  "id",
  "campaign_header_id",
  "campaign_line_id",
  "assignment_deliverable_id",
  "assignment_post_schedule_id",
  "influencer_id",
  "platform",
  "publication_type",
  "content_url",
  "publication_date",
  "status",
  "assignee_id",
  "caption",
  "hashtags",
  "notes",
  "auto_detected",
  "created_at",
  "updated_at",
]);

async function fetchColumnsViaRpc(
  supabase: SupabaseClient
): Promise<Set<string> | null> {
  const { data, error } = await supabase.rpc("list_public_table_columns", {
    p_table: CAMPAIGN_PUBLICATIONS_TABLE,
  });

  if (error || !data) return null;

  return new Set(
    (data as Array<{ column_name: string } | string>).map((row) =>
      typeof row === "string" ? row : row.column_name
    )
  );
}

async function probeColumnsViaSelect(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const available = new Set<string>(FALLBACK_MINIMAL_COLUMNS);
  const warnings: string[] = [];

  for (const column of CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS) {
    if (available.has(column)) continue;

    const { error } = await supabase
      .from(CAMPAIGN_PUBLICATIONS_TABLE)
      .select(column)
      .limit(0);

    if (!error) {
      available.add(column);
      continue;
    }

    if (error.message.includes("does not exist")) {
      warnings.push(`Column missing: ${column}`);
      continue;
    }

    // Permission or other error — stop probing to avoid noise
    warnings.push(`Schema probe stopped at ${column}: ${error.message}`);
    break;
  }

  schemaCache = {
    columns: available,
    fetchedAt: Date.now(),
    warnings,
  };

  return available;
}

export async function getCampaignPublicationsSchema(
  supabase: SupabaseClient,
  options?: { forceRefresh?: boolean }
): Promise<{
  columns: Set<string>;
  selectList: string;
  warnings: string[];
  partition: ReturnType<typeof partitionSchemaColumns>;
}> {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    schemaCache &&
    now - schemaCache.fetchedAt < CACHE_TTL_MS
  ) {
    const partition = partitionSchemaColumns(schemaCache.columns);
    return {
      columns: schemaCache.columns,
      selectList: buildPublicationSelectList(schemaCache.columns),
      warnings: schemaCache.warnings,
      partition,
    };
  }

  let columns = await fetchColumnsViaRpc(supabase);
  let warnings: string[] = [];

  if (!columns || columns.size === 0) {
    columns = await probeColumnsViaSelect(supabase);
    warnings = schemaCache?.warnings ?? [];
  } else {
    schemaCache = { columns, fetchedAt: now, warnings: [] };
  }

  const partition = partitionSchemaColumns(columns);

  if (partition.missingMetrics.length > 0) {
    warnings.push(
      `Metrics columns missing (${partition.missingMetrics.length}): ${partition.missingMetrics.join(", ")}`
    );
  }

  return {
    columns,
    selectList: buildPublicationSelectList(columns),
    warnings,
    partition,
  };
}

export function invalidateCampaignPublicationsSchemaCache() {
  schemaCache = null;
}

export type { CampaignPublicationColumn };
