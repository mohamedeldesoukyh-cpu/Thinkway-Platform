import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { Webhook } from "svix";
import { verifyFinanceMailEvent } from "./mail-events";
import { FINANCE_INBOX_ID } from "./mail-policy";
import { isPublicPath } from "@/lib/auth/routes";
import { NextRequest } from "next/server";
import { preAuthRequestGuard } from "@/lib/security/request-guard";
import { resetRateLimitStoreForTests } from "@/lib/security/rate-limit";
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

test("origin-less provider POST reaches signature verification while other mutations remain protected",()=>{
 const previous=process.env.NODE_ENV;process.env.NODE_ENV="production";
 resetRateLimitStoreForTests();
 try{
  const secret=`whsec_${randomBytes(32).toString('base64')}`;const signer=new Webhook(secret);const id="msg_guard_test";const now=new Date();
  const event={type:"inbox.email.received",created_at:now.toISOString(),data:{inbox_id:FINANCE_INBOX_ID,thread_id:randomUUID(),email_id:randomUUID(),thread:{folder:"inbox"}}};
  const body=JSON.stringify(event);const headers={'svix-id':id,'svix-timestamp':String(Math.floor(now.getTime()/1000)),'svix-signature':signer.sign(id,now,body)};
  const request=new NextRequest('https://app.thinkwaymedia.com/api/webhooks/finance-mail',{method:'POST',headers,body});
  assert.equal(preAuthRequestGuard(request),null);
  assert.deepEqual(verifyFinanceMailEvent(body,request.headers,secret),{threadId:event.data.thread_id,emailId:event.data.email_id});
  assert.throws(()=>verifyFinanceMailEvent(body+' ',request.headers,secret));
  assert.throws(()=>verifyFinanceMailEvent(body,new Headers(),secret));
  for(const path of ['/api/accounting/assistant/automation','/api/webhooks/finance-mail/other','/api/webhooks/other']){
   assert.equal(preAuthRequestGuard(new NextRequest('https://app.thinkwaymedia.com'+path,{method:'POST',headers,body}))?.status,403);
  }
  assert.equal(preAuthRequestGuard(new NextRequest(request.url,{method:'PUT',headers,body}))?.status,403);
  assert.equal(preAuthRequestGuard(new NextRequest(request.url,{method:'POST',headers:{...headers,'next-action':'action'},body}))?.status,403);
 }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;resetRateLimitStoreForTests();}
});
