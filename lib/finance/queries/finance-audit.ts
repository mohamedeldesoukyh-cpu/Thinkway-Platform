import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FINANCE_AUDIT_EVENTS,
  FINANCE_AUDIT_EVENT_LABELS,
  type FinanceAuditEvent,
} from "@/lib/finance/audit-events";

export type FinanceAuditTimelineEntry = {
  id: string;
  event: FinanceAuditEvent | string;
  label: string;
  entity_type: string;
  entity_id: string | null;
  actor_name: string | null;
  created_at: string;
  payload: Record<string, unknown>;
};

const FINANCE_EVENT_KEYS = new Set<string>(Object.values(FINANCE_AUDIT_EVENTS));

export async function loadFinanceAuditTimeline(
  supabase: SupabaseClient,
  input: {
    campaign_id?: string;
    entity_type?: string;
    entity_id?: string;
    limit?: number;
  }
): Promise<FinanceAuditTimelineEntry[]> {
  const limit = input.limit ?? 50;

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.entity_type && input.entity_id) {
    query = query.eq("entity_type", input.entity_type).eq("entity_id", input.entity_id);
  } else if (input.campaign_id) {
    query = query.or(
      [
        `and(entity_type.eq.campaign_headers,entity_id.eq.${input.campaign_id})`,
        `metadata->>campaign_header_id.eq.${input.campaign_id}`,
        `metadata->>campaign_id.eq.${input.campaign_id}`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []).filter((row) => {
    const meta = (row as { metadata?: { event?: string } }).metadata;
    const event = meta?.event;
    return event && (event in FINANCE_AUDIT_EVENT_LABELS || FINANCE_EVENT_KEYS.has(event));
  });

  const actorIds = [
    ...new Set(
      rows
        .map((r) => (r as { actor_id: string | null }).actor_id)
        .filter(Boolean) as string[]
    ),
  ];

  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => {
      const row = p as { id: string; full_name: string | null; email: string };
      return [row.id, row.full_name ?? row.email] as const;
    })
  );

  return rows.map((raw) => {
    const row = raw as {
      id: string;
      entity_type: string;
      entity_id: string | null;
      actor_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    };
    const event = String(row.metadata?.event ?? "unknown");
    const label =
      FINANCE_AUDIT_EVENT_LABELS[event as FinanceAuditEvent] ??
      String(row.metadata?.label ?? event);

    return {
      id: row.id,
      event,
      label,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_name: row.actor_id ? profileMap.get(row.actor_id) ?? null : null,
      created_at: row.created_at,
      payload: row.metadata ?? {},
    };
  });
}
