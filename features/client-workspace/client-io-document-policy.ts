import { createHash } from "node:crypto";
export type WorkspaceIo = {
  id: string; document_number: string | null; status: string; approved_at: string | null;
  terms_html: string | null; generated_pdf_url: string | null;
  approval_token_hash: string | null; approval_token_expires_at: string | null;
};
export function canViewWorkspaceIo(io: WorkspaceIo): boolean {
  if (!["draft", "generated", "sent", "under_client_review", "approved"].includes(io.status)) return false;
  if (io.status === "approved") return Boolean(io.terms_html?.trim() && io.approved_at);
  return Boolean(io.terms_html?.trim()) || ["draft", "generated"].includes(io.status);
}

/** A stale page must never approve or download a different revision. */
export function isCurrentWorkspaceIo(io: WorkspaceIo | null, requestedId: unknown): io is WorkspaceIo {
  return Boolean(io && typeof requestedId === "string" && io.id === requestedId);
}

export function sentIoApprovalToken(io: WorkspaceIo, payloads: unknown[], now = Date.now()): string | null {
  if (!canViewWorkspaceIo(io) || !["sent", "under_client_review"].includes(io.status) || !io.approval_token_hash) return null;
  if (io.approval_token_expires_at && !(Date.parse(io.approval_token_expires_at) > now)) return null;
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    try {
      const url = new URL(String((payload as Record<string, unknown>).approval_url ?? ""));
      if (url.pathname !== "/io-approval/client") continue;
      const token = url.searchParams.get("token");
      // Match the existing database hash_io_approval_token contract, including rotated tokens.
      if (token && createHash("md5").update(token).digest("hex") === io.approval_token_hash) return token;
    } catch { /* A legacy notification without a usable approval URL. */ }
  }
  return null;
}
