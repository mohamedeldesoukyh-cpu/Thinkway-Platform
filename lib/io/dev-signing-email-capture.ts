import { randomUUID, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendEmailInput, SendEmailResult } from "@/lib/email/provider";

/** Explicit Dev-only test transport. Never forwards a message to an email provider. */
export function createDevSigningEmailCapture(
  db: SupabaseClient,
  io: { id: string; document_number: string | null },
  recipient: string | null | undefined,
): ((input: SendEmailInput) => Promise<SendEmailResult>) | undefined {
  if (process.env.SIGNING_DEV_EMAIL_CAPTURE !== "1") return undefined;
  const permitted = process.env.VERCEL_ENV === "preview"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "https://hsxrewjcbvmbkqdlzjhs.supabase.co"
    && io.document_number?.startsWith("VIO-SIGNING-QA-")
    && /^[^@\s]+@example\.invalid$/i.test(recipient ?? "");
  return async input => {
    if (!permitted) return { ok: false, error: "Dev signing capture refused a non-synthetic or non-Dev request." };
    const id = randomUUID();
    const evidence = {
      testOnly: true, transport: "dev-signing-capture", capturedAt: new Date().toISOString(), ioId: io.id,
      ...input,
      attachments: input.attachments?.map(a => ({ filename: a.filename, mimeType: a.mimeType,
        sha256: createHash("sha256").update(a.content).digest("hex"), contentBase64: a.content.toString("base64") })),
    };
    const { error } = await db.storage.from("vendor-io-documents").upload(
      `${io.id}/signing-test-mail/${id}.json`, Buffer.from(JSON.stringify(evidence)),
      { contentType: "application/json", upsert: false },
    );
    return error ? { ok: false, error: "Could not retain Dev mail evidence." } : { ok: true, messageId: `dev-capture:${id}` };
  };
}
