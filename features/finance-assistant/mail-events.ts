import { Webhook } from "svix";
import { z } from "zod";
import { FINANCE_INBOX_ID } from "./mail-policy";

const eventSchema=z.object({type:z.string(),created_at:z.string().datetime(),data:z.object({inbox_id:z.string().uuid(),thread_id:z.string().uuid(),email_id:z.string().uuid(),thread:z.object({folder:z.string()}).optional()})});
export function verifyFinanceMailEvent(body:string,headers:Headers,secret:string) {
  if(!secret)throw new Error("Webhook is not configured");
  new Webhook(secret).verify(body,{
    "svix-id":headers.get("svix-id")??"","svix-timestamp":headers.get("svix-timestamp")??"","svix-signature":headers.get("svix-signature")??"",
  });
  const event=eventSchema.safeParse(JSON.parse(body));
  if(!event.success)return null;
  if(event.data.type!=="inbox.email.received"||event.data.data.inbox_id!==FINANCE_INBOX_ID)return null;
  if(event.data.data.thread&&event.data.data.thread.folder!=="inbox")return null;
  return {threadId:event.data.data.thread_id,emailId:event.data.data.email_id};
}
