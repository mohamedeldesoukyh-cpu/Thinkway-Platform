import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { Webhook } from "svix";
import { verifyFinanceMailEvent } from "./mail-events";
import { FINANCE_INBOX_ID } from "./mail-policy";
import { isPublicPath } from "@/lib/auth/routes";
test("signed inbox event is accepted only for Amgad; tampering and old signatures fail",()=>{
 const secret=`whsec_${randomBytes(32).toString('base64')}`;const verifier=new Webhook(secret);const id="msg_test";const now=new Date();
 const event={type:"inbox.email.received",created_at:now.toISOString(),data:{inbox_id:FINANCE_INBOX_ID,thread_id:randomUUID(),email_id:randomUUID(),thread:{folder:"inbox"}}};
 const body=JSON.stringify(event);
 const headers=new Headers({'svix-id':id,'svix-timestamp':String(Math.floor(now.getTime()/1000)),'svix-signature':verifier.sign(id,now,body)});
 assert.deepEqual(verifyFinanceMailEvent(body,headers,secret),{threadId:event.data.thread_id,emailId:event.data.email_id});
 assert.throws(()=>verifyFinanceMailEvent(body+' ',headers,secret));
 const old=new Date(now.getTime()-600000);headers.set('svix-timestamp',String(Math.floor(old.getTime()/1000)));headers.set('svix-signature',verifier.sign(id,old,body));assert.throws(()=>verifyFinanceMailEvent(body,headers,secret));
 event.data.inbox_id=randomUUID();const other=JSON.stringify(event);headers.set('svix-timestamp',String(Math.floor(now.getTime()/1000)));headers.set('svix-signature',verifier.sign(id,now,other));assert.equal(verifyFinanceMailEvent(other,headers,secret),null);
 assert.equal(isPublicPath('/api/webhooks/finance-mail'),true);assert.equal(isPublicPath('/api/webhooks/finance-mail/other'),false);
});
