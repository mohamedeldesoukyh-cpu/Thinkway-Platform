import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requireCreatorScope } from "@/features/portals/scope";

export type SigningAccess = { token?: string; ioId?: string };
type SessionData = {
  io: { id: string; document_number: string | null; campaign_header_id: string; status: string;
    terms_html: string | null; delivery_recipient: string | null;
    influencers: { display_name: string | null; email: string | null } | null;
    campaign: { name: string | null } | null };
  signature: { signed_html: string; signed_pdf_path: string; signer_name: string; signed_at: string } | null;
};
export async function loadVendorSigningSession(access: SigningAccess) {
  const db = createServiceRoleClient();
  const token = access.token?.trim();
  let actorId: string | null = null;
  if (token) {
    if (token.length < 16 || token.length > 256) throw new Error("APPROVAL_INVALID");
  } else {
    if (!access.ioId || !/^[0-9a-f-]{36}$/i.test(access.ioId)) throw new Error("APPROVAL_INVALID");
    const { scope } = await requireCreatorScope("creator_portal.approve");
    actorId = scope.userId;
  }
  const { data, error } = await db.rpc("get_vendor_io_signing_session", {
    p_token: token ?? null, p_io_id: token ? null : access.ioId, p_actor_id: actorId,
  });
  if (error || !data) throw new Error(error?.message ?? "APPROVAL_INVALID");
  const { io, signature } = data as SessionData;
  if (io.status === "approved") return { db, io, signature, actorId, token, alreadyApproved: true as const, documentHash: null };
  if (!io.terms_html?.trim()) throw new Error("The IO has changed. Please ask Thinkway to send you an updated signing link.");
  return { db, io, signature, actorId, token, alreadyApproved: false as const,
    documentHash: createHash("sha256").update(io.terms_html).digest("hex") };
}
