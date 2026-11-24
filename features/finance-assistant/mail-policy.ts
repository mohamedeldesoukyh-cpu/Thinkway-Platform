import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FinanceReply } from "./contracts";

export const FINANCE_MAILBOX = "amgad@thinkwaymedia.com";
export const FINANCE_INBOX_ID = "62af07bc-6823-47a3-bf0d-aee74451d771";
export const FINANCE_REQUESTERS = ["mohamedeldesouky@thinkwaymedia.com", "mmahmoud@thinkwaymedia.com", "raaof@thinkwaymedia.com"] as const;
export function mailboxAddress(value: string): string | null {
  const match = value.trim().match(/^(?:[^<>\r\n]*<)?([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?:>)?$/i);
  return match?.[1].toLowerCase() ?? null;
}
export function isFinanceRequester(value: string) {
  const address = mailboxAddress(value);
  return !!address && FINANCE_REQUESTERS.some(allowed => allowed === address);
}
export const mailSchema = z.object({
  id: z.string().uuid(), direction: z.enum(["inbound", "outbound"]), from: z.string(),
  subject: z.string(), text: z.string().nullable().optional(), reply_to: z.array(z.string()).nullable().optional(),
  attachments: z.array(z.object({id:z.string(),filename:z.string().nullable(),size:z.number()})).optional(),
});
export function reportRecipient(mail: z.infer<typeof mailSchema>) {
  const sender = mailboxAddress(mail.from);
  if (mail.direction !== "inbound" || !sender || !isFinanceRequester(sender)) throw new Error("This sender is not authorized to request finance reports.");
  if (mail.reply_to?.some(address => mailboxAddress(address) !== sender)) throw new Error("Reply-To differs from the authorized sender. Review this message in Resend.");
  return sender;
}
export function financeEmailText(reply: FinanceReply) {
  return [reply.content, ...reply.sources.flatMap(source => [source.title, source.scope,
    ...(source.tables ?? []).map(table => `${table.heading}\n${table.columns.join(" | ")}\n${table.rows.map(row => row.join(" | ")).join("\n")}`)]),
    `Prepared: ${reply.retrievedAt}`, "Amgad — AI Finance Assistant, Thinkway"].join("\n\n");
}
export const financeAttachmentSchema=z.object({filename:z.literal("Amgad-accounting-report.pdf"),content:z.string().max(2_700_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),content_type:z.literal("application/pdf")}).strict();
export function financeEmailHtml(text:string){
 const escaped=text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return `<html><body style="margin:0;background:#f4f5f8;font-family:Arial,sans-serif"><main style="max-width:760px;margin:24px auto;background:white;border:1px solid #dce1e8;border-radius:12px;padding:28px"><h1 style="font-size:22px;color:#080642">Thinkway · Finance</h1><p style="color:#64748b">Amgad — AI Finance Assistant</p><div dir="auto" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.7">${escaped}</div><hr style="border:0;border-top:1px solid #e2e8f0;margin-top:24px"><p style="font-size:12px;color:#64748b">Confidential accounting information · Thinkway</p></main></body></html>`;
}
const approvalSchema = z.object({userId:z.string().uuid(),threadId:z.string().uuid(),emailId:z.string().uuid(),recipient:z.string().email(),text:z.string().min(1).max(180000),attachments:z.array(financeAttachmentSchema).max(1).optional(),expires:z.number(),nonce:z.string().uuid()}).strict();
export type MailApproval = z.infer<typeof approvalSchema>;
export function signMailApproval(value: MailApproval, secret: string) {
  const payload = Buffer.from(JSON.stringify(approvalSchema.parse(value))).toString("base64url");
  return `${payload}.${createHmac("sha256",secret).update(payload).digest("base64url")}`;
}
export function verifyMailApproval(token:string,secret:string,userId:string,now=Date.now()) {
  const parts=token.split(".");
  if(parts.length!==2) throw new Error("Invalid reply approval.");
  const expected=createHmac("sha256",secret).update(parts[0]).digest();
  const actual=Buffer.from(parts[1],"base64url");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) throw new Error("Invalid reply approval.");
  const value=approvalSchema.parse(JSON.parse(Buffer.from(parts[0],"base64url").toString()));
  if(value.userId!==userId||value.expires<=now||value.expires>now+15*60*1000||!isFinanceRequester(value.recipient)) throw new Error("Reply approval expired. Prepare it again.");
  return value;
}
