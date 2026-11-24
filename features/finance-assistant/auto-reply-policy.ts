import { z } from "zod";
import { financeAttachmentSchema, financeEmailHtml, mailboxAddress, mailSchema, reportRecipient } from "./mail-policy";

export type FinanceMail = z.infer<typeof mailSchema>;
const receivedSchema = z.object({
  id: z.string().uuid(), from: z.string(), message_id: z.string(),
  text: z.string(), subject: z.string().nullable(),
  authentication: z.object({ dkim: z.literal("pass"), dmarc: z.literal("pass") }),
  headers: z.record(z.string(), z.string()).nullable().optional(),
});
const text = (value: string) => value.replace(/\r\n/g, "\n").trim();

/** Only provider-computed authentication from the receiving API is trusted.
 * Inbox ids are not assumed to map to receiving ids: a missing or mismatched
 * record fails closed. Never parse Authentication-Results from sender headers.
 */
export function verifyAutomaticRequest(mail: FinanceMail, received: unknown) {
  const recipient = reportRecipient(mail);
  const result = receivedSchema.safeParse(received);
  if (!result.success) throw new Error("sender_authentication_unverified");
  const record = result.data;
  if (!mail.message_id || record.id !== mail.id || record.message_id !== mail.message_id ||
      mailboxAddress(record.from) !== recipient || text(record.text) !== text(mail.text ?? "") ||
      (record.subject ?? "") !== mail.subject) throw new Error("sender_evidence_mismatch");
  const headers = Object.fromEntries(Object.entries(record.headers ?? {}).map(([k,v]) => [k.toLowerCase(),v]));
  if ((headers["auto-submitted"] && headers["auto-submitted"].toLowerCase() !== "no") ||
      headers["list-id"] || /^(bulk|list|junk)$/i.test(headers.precedence ?? "") ||
      /automatic reply|auto.?reply|out of office|رد تلقائي|خارج المكتب/i.test(mail.subject)) throw new Error("automatic_message_requires_review");
  return recipient;
}

export const preparedReplySchema = z.object({
  id: z.string().uuid(), email_id: z.string().uuid(), thread_id: z.string().uuid(),
  sender: z.string(), response_text: z.string().trim().min(1).max(180000),
  attachments: z.array(financeAttachmentSchema).max(1),
});
export type PreparedReply = z.infer<typeof preparedReplySchema>;
export function automaticReplyPayload(job: PreparedReply, mail: FinanceMail, received: unknown) {
  if (mail.id !== job.email_id || verifyAutomaticRequest(mail, received) !== job.sender) throw new Error("recipient_changed");
  // Neither original To/CC nor instructions in the body can add recipients.
  return { text: job.response_text, html: financeEmailHtml(job.response_text),
    attachments: job.attachments, cc: [], bcc: [], reply_all: false,
    headers: { "Auto-Submitted": "auto-replied" } };
}

export async function deliverAutomaticReply(deps: {
  environment?: string; enabled?: string;
  claim: () => Promise<unknown | null>;
  load: (job: PreparedReply) => Promise<{ mail: FinanceMail; received: unknown }>;
  hold: (job: PreparedReply, reason: string) => Promise<void>;
  send: (job: PreparedReply, payload: ReturnType<typeof automaticReplyPayload>, key: string) => Promise<string>;
  finish: (job: PreparedReply, receipt: string) => Promise<void>;
  pending: (job: PreparedReply) => Promise<void>;
}) {
  if (deps.environment !== "production" || deps.enabled !== "true") return { sent: 0 };
  const candidate = await deps.claim();
  if (!candidate) return { sent: 0 };
  const job = preparedReplySchema.parse(candidate);
  let payload: ReturnType<typeof automaticReplyPayload>;
  let evidence: Awaited<ReturnType<typeof deps.load>>;
  // A provider outage is retryable. A received but invalid identity is not.
  try { evidence = await deps.load(job); }
  catch { await deps.pending(job); return { sent: 0, pending: true }; }
  try { payload = automaticReplyPayload(job, evidence.mail, evidence.received); }
  catch { await deps.hold(job, "automatic_reply_safety_review"); return { sent: 0, review: true }; }
  try {
    const receipt = await deps.send(job, payload, `amgad-auto-${job.id}`);
    await deps.finish(job, receipt);
    return { sent: 1 };
  } catch {
    // Delivery may have occurred. Keep the lease/state and same idempotency key.
    await deps.pending(job);
    return { sent: 0, pending: true };
  }
}
