import type { SupabaseClient } from "@supabase/supabase-js";
import { listClientIoMilestones } from "@/lib/io/client-io-milestones-service";
import { formatClientIoMilestonesPaymentSchedule, type ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";

export async function loadInvoicePaymentContext(db: SupabaseClient, campaignId: string) {
  const { data, error } = await db.from("client_ios")
    .select("id, document_number, status, sent_at, approved_at, billing_terms, created_at")
    .eq("campaign_header_id", campaignId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const io = (data ?? []).find(row =>
    !["cancelled", "canceled", "void", "voided", "draft"].includes(row.status ?? "") &&
    (["approved", "sent", "generated", "under_client_review"].includes(row.status ?? "") || Boolean(row.sent_at)));
  if (!io) return null;
  let milestones = await listClientIoMilestones(db, io.id);
  // Legacy IOs can have a textual Net schedule without structured milestones.
  const net = /^net[ _]+(\d+)(?:[ _]+days)?$/i.exec(io.billing_terms?.trim() ?? "");
  if (!milestones.length && net) milestones = [{ id: "legacy-net", label: `Net ${net[1]} Days`, percent: 100,
    milestoneKind: "upfront", dueTrigger: "on_approval", dueOffsetDays: Number(net[1]), dueDate: null, notes: null, sortOrder: 1 } satisfies ClientIoMilestoneDraft];
  return { io, milestones, terms: (formatClientIoMilestonesPaymentSchedule(milestones) || io.billing_terms?.trim() || "").replace(/Client IO approval \/ invoice/gi, "invoice date") || null };
}
