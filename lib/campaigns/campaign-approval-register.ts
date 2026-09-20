import type { CampaignApprovalRow } from "@/lib/domains/campaign/workspace-types";
import type { ClientIoRow, VendorIoRow } from "@/lib/domains/io/types";

type IoApproval = Pick<ClientIoRow, "id" | "document_number" | "status" | "sent_at" | "approved_at" | "approved_by_name"> & {
  is_superseded?: boolean;
  attachment_url?: string | null;
};

function safeAttachmentUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Read current IO decisions directly; never create duplicate approval requests. */
export function buildCampaignApprovalRegister(
  requests: CampaignApprovalRow[],
  clientIo: (IoApproval & Pick<ClientIoRow, "client_name">) | null,
  vendorIos: (IoApproval & Pick<VendorIoRow, "influencer_name" | "delivery_status">)[]
): CampaignApprovalRow[] {
  const rows = [...requests];
  function append(io: IoApproval, tab: "client-io" | "vendor-io", name: string, delivered = false) {
    if (io.is_superseded || io.status === "cancelled") return;
    const awaiting = io.status === "sent" || io.status === "under_client_review" ||
      ((io.status === "draft" || io.status === "generated") && delivered);
    if (!awaiting && io.status !== "approved" && io.status !== "rejected" && io.status !== "revision_required") return;
    rows.push({
      id: `${tab}:${io.id}`,
      document_number: io.document_number ?? "—",
      entity_type: tab === "client-io" ? "Client IO" : "Vendor IO",
      title: name || (tab === "client-io" ? "Client IO" : "Vendor IO"),
      status: awaiting ? "pending" : io.status,
      assigned_to_name: name || null,
      approved_by_name: io.status === "approved" ? io.approved_by_name : null,
      due_at: null,
      decided_at: io.status === "approved" ? io.approved_at : null,
      source_tab: tab,
      source_id: io.id,
      document_url: io.status === "approved"
        ? `/api/${tab === "client-io" ? "client-ios" : "vendor-ios"}/${encodeURIComponent(io.id)}/document?format=pdf`
        : null,
      attachment_url: io.status === "approved" ? safeAttachmentUrl(io.attachment_url) : null,
      attachment_label: tab === "vendor-io" ? "Signed copy" : "Attachment",
    });
  }
  if (clientIo) append(clientIo, "client-io", clientIo.client_name);
  vendorIos.forEach((io) => append(io, "vendor-io", io.influencer_name, io.delivery_status === "completed"));
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  return unique.sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "") || a.id.localeCompare(b.id));
}
