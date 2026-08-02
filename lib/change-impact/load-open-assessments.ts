import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assessmentRowToDecisionSignal,
} from "@/lib/change-impact/feeds/decision-center";
import type {
  ChangeImpactDecisionSignal,
  ChangeImpactSeverity,
} from "@/lib/change-impact/types";

/**
 * Load open change-impact assessments for Decision Center feed.
 */
export async function loadOpenChangeImpactSignals(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  options?: { limit?: number }
): Promise<ChangeImpactDecisionSignal[]> {
  const { data, error } = await supabase
    .from("change_impact_assessments")
    .select(
      "id, severity, business_impact_summary, business_impact_detail, recommended_actions, event_type, created_at"
    )
    .eq("campaign_header_id", campaignHeaderId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 20);

  if (error) {
    // Table may not exist yet on older environments — fail soft.
    console.warn("[change-impact] load open assessments failed", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    severity: ChangeImpactSeverity;
    business_impact_summary: string;
    business_impact_detail: string | null;
    recommended_actions: string[] | null;
    event_type: string;
    created_at: string;
  }>;

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: docs } = await supabase
    .from("change_impact_document_impacts")
    .select("assessment_id, document_type, document_id, document_label")
    .in("assessment_id", ids);

  const primaryByAssessment = new Map<
    string,
    {
      document_type: string;
      document_id: string;
      document_label: string | null;
    }
  >();
  for (const raw of docs ?? []) {
    const doc = raw as {
      assessment_id: string;
      document_type: string;
      document_id: string;
      document_label: string | null;
    };
    if (!primaryByAssessment.has(doc.assessment_id)) {
      primaryByAssessment.set(doc.assessment_id, doc);
    }
  }

  return rows.map((row) =>
    assessmentRowToDecisionSignal({
      ...row,
      primary_document: primaryByAssessment.get(row.id) ?? null,
    })
  );
}
