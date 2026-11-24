import "server-only";
import { z } from "zod";
import { FINANCE_INBOX_ID, FINANCE_MAILBOX, mailSchema } from "./mail-policy";

export function financeMailKey() {
  const key=process.env.FINANCE_RESEND_API_KEY?.trim()||process.env.RESEND_API_KEY?.trim();
  if(!key) throw new Error("Amgad needs a Resend API key with inbox access.");
  return key;
}
export async function financeInboxRequest(path:string, init:RequestInit={}) {
  const response=await fetch(`https://api.resend.com/inboxes/${FINANCE_INBOX_ID}${path}`,{
    ...init,cache:"no-store",signal:AbortSignal.timeout(20000),
    headers:{Authorization:`Bearer ${financeMailKey()}`,"Content-Type":"application/json",...init.headers},
  });
  if(!response.ok) throw new Error(response.status===401||response.status===403 ? "Resend denied inbox access. Configure FINANCE_RESEND_API_KEY with inbox permissions." : `Resend inbox request failed (${response.status}). Please retry.`);
  return response.json();
}
export async function verifyFinanceInbox() {
  const inbox=z.object({id:z.string(),email_address:z.string()}).parse(await financeInboxRequest(""));
  if(inbox.id!==FINANCE_INBOX_ID||inbox.email_address.toLowerCase()!==FINANCE_MAILBOX) throw new Error("Amgad mailbox identity does not match.");
}
export async function loadFinanceEmail(threadId:string,emailId:string) {
  z.string().uuid().parse(threadId);z.string().uuid().parse(emailId);
  return mailSchema.parse(await financeInboxRequest(`/threads/${threadId}/emails/${emailId}`));
}

export async function loadFinanceSenderEvidence(emailId:string):Promise<unknown> {
  z.string().uuid().parse(emailId);
  const response=await fetch(`https://api.resend.com/emails/receiving/${emailId}?html_format=cid`,{
    cache:"no-store",signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${financeMailKey()}`},
  });
  // Missing correspondence or authentication cannot qualify for automatic mail.
  if(response.status===429||response.status>=500)throw new Error("Sender evidence temporarily unavailable");
  if(!response.ok)return null;
  const raw=await response.json();
  return {id:raw.id,from:raw.from,message_id:raw.message_id,text:raw.text,subject:raw.subject,authentication:raw.authentication,headers:raw.headers};
}
