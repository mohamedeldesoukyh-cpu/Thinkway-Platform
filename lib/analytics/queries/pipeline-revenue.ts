import { isClientIoAssignmentSnapshotV1 } from "@/lib/io/client-io-assignment-snapshot";
import { aggregateCampaignDisplayFinancials } from "@/lib/campaigns/campaign-display-financials";
import { buildRecognitionEvents } from "./reporting-financials";
import { roundMoney } from "@/lib/analytics/aggregations/round";

export type PipelineIo = { id: string; campaign_header_id: string; document_number: string | null; status: string; is_superseded: boolean | null; approved_at: string | null; assignment_snapshot: unknown };
export type PipelineDetail = { campaign_header_id: string; io_id: string; io_number: string; approved_at: string | null; approved_revenue: number; recognized_revenue: number; pipeline_revenue: number };

/** Only current approved IO scope; billed-but-not-live ads remain pipeline. */
export function buildPipelineRevenue(input: Parameters<typeof buildRecognitionEvents>[0], ios: PipelineIo[], selections: { client_io_id: string; campaign_line_id: string }[]): PipelineDetail[] {
  const seen = new Set<string>();
  const result: PipelineDetail[] = [];
  const approved = ios.filter(io => io.status === "approved" && !io.is_superseded)
    .sort((a,b) => (b.approved_at ?? "").localeCompare(a.approved_at ?? "") || a.id.localeCompare(b.id));
  for (const io of approved) {
    const snapshot = isClientIoAssignmentSnapshotV1(io.assignment_snapshot) ? io.assignment_snapshot : null;
    const selectedIds = new Set(snapshot?.selectedCampaignLineIds ?? selections.filter(s => s.client_io_id === io.id).map(s => s.campaign_line_id));
    let approvedRevenue = 0, recognizedRevenue = 0, pipelineRevenue = 0;
    for (const current of input.lines.filter(l => l.campaign_header_id === io.campaign_header_id && selectedIds.has(l.id))) {
      if (seen.has(current.id)) continue;
      const frozen = snapshot?.lines.find(l => l.id === current.id);
      if (snapshot && !frozen) continue;
      seen.add(current.id);
      const line = frozen ? { ...current, ...frozen, campaign_header_id: current.campaign_header_id } : current;
      const total = aggregateCampaignDisplayFinancials({ lines: [line], displayCurrency: "EGP", rateToEgpByCurrency: input.rates }).revenue;
      const live = buildRecognitionEvents({ ...input, lines: [line] }).reduce((sum, e) => sum + e.revenue, 0);
      approvedRevenue += total; recognizedRevenue += live; pipelineRevenue += Math.max(0, total - live);
    }
    if (pipelineRevenue > 0.005) result.push({ campaign_header_id: io.campaign_header_id, io_id: io.id, io_number: io.document_number || io.id,
      approved_at: io.approved_at, approved_revenue: roundMoney(approvedRevenue), recognized_revenue: roundMoney(recognizedRevenue), pipeline_revenue: roundMoney(pipelineRevenue) });
  }
  return result;
}
