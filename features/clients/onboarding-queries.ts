import type { ClientOnboardingAuditEvent } from "@/lib/clients/onboarding-audit";
import type { ClientOnboardingStatus } from "@/lib/clients/onboarding-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientOnboardingTimelineEvent = {
  id: string;
  kind: "promoted" | "legal_completed" | "finance_completed" | "activated" | "status_changed";
  label: string;
  occurredAt: string;
  actorName: string | null;
  previousStatus: ClientOnboardingStatus | null;
  newStatus: ClientOnboardingStatus | null;
};

const TIMELINE_EVENT_LABELS: Record<ClientOnboardingTimelineEvent["kind"], string> = {
  promoted: "Client promoted",
  legal_completed: "Legal completed",
  finance_completed: "Finance approved",
  activated: "Client activated",
  status_changed: "Onboarding status changed",
};

function parseAuditEventMetadata(metadata: unknown): {
  event: ClientOnboardingAuditEvent | null;
  previousStatus: ClientOnboardingStatus | null;
  newStatus: ClientOnboardingStatus | null;
  summary: string | null;
} {
  if (!metadata || typeof metadata !== "object") {
    return { event: null, previousStatus: null, newStatus: null, summary: null };
  }

  const record = metadata as Record<string, unknown>;
  const event = typeof record.event === "string" ? record.event : null;
  const previousStatus =
    typeof record.previousStatus === "string"
      ? (record.previousStatus as ClientOnboardingStatus)
      : null;
  const newStatus =
    typeof record.newStatus === "string"
      ? (record.newStatus as ClientOnboardingStatus)
      : null;
  const summary = typeof record.summary === "string" ? record.summary : null;

  return {
    event: event as ClientOnboardingAuditEvent | null,
    previousStatus,
    newStatus,
    summary,
  };
}

function mapAuditToTimelineKind(
  event: ClientOnboardingAuditEvent,
  newStatus: ClientOnboardingStatus | null
): ClientOnboardingTimelineEvent["kind"] {
  if (event === "client.promoted") return "promoted";
  if (newStatus === "active") return "activated";
  if (newStatus === "finance_pending") return "legal_completed";
  if (newStatus === "ready") return "finance_completed";
  return "status_changed";
}

export async function getClientOnboardingTimeline(
  clientId: string
): Promise<ClientOnboardingTimelineEvent[]> {
  const supabase = await createSupabaseServerClient();

  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, actor_id, metadata")
    .eq("entity_type", "clients")
    .eq("entity_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn(`[clients] onboarding timeline unavailable for ${clientId}:`, error.message);
    return [];
  }

  const actorIds = [
    ...new Set(
      (logs ?? [])
        .map((log) => log.actor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const actorNameById = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);

    for (const profile of profiles ?? []) {
      actorNameById.set(
        profile.id,
        profile.full_name?.trim() || profile.email || "Unknown user"
      );
    }
  }

  const events: ClientOnboardingTimelineEvent[] = [];

  for (const log of logs ?? []) {
    const parsed = parseAuditEventMetadata(log.metadata);
    if (
      !parsed.event ||
      ![
        "client.promoted",
        "client.onboarding_status_changed",
      ].includes(parsed.event)
    ) {
      continue;
    }

    const kind = mapAuditToTimelineKind(parsed.event, parsed.newStatus);

    events.push({
      id: log.id,
      kind,
      label: parsed.summary ?? TIMELINE_EVENT_LABELS[kind],
      occurredAt: log.created_at,
      actorName: log.actor_id ? actorNameById.get(log.actor_id) ?? null : null,
      previousStatus: parsed.previousStatus,
      newStatus: parsed.newStatus,
    });
  }

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export async function getClientOnboardingPermissions(): Promise<{
  canEditChecklist: boolean;
  canOverrideStatus: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { canEditChecklist: false, canOverrideStatus: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role:roles(slug)")
    .eq("id", user.id)
    .maybeSingle();

  const roleSlug =
    (profile as { role: { slug: string } | null } | null)?.role?.slug ?? null;

  const { canOverrideOnboardingStatus } = await import(
    "@/lib/clients/onboarding-permissions"
  );

  const { hasPermission } = await import("@/lib/auth/permissions");

  const canEditChecklist =
    roleSlug === "super_admin" ||
    roleSlug === "admin" ||
    (await hasPermission(supabase, "clients.write"));

  return {
    canEditChecklist,
    canOverrideStatus: canOverrideOnboardingStatus(roleSlug),
  };
}
