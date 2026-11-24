import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isFinanceRequester,reportRecipient,signMailApproval,verifyMailApproval,financeEmailText,mailSchema } from "./mail-policy";

test("valid inbox messages may have no subject or unknown attachment size",()=>{
  const mail=mailSchema.parse({id:randomUUID(),direction:"inbound",from:"mmahmoud@thinkwaymedia.com",subject:null,text:"Show November P&L",attachments:[{id:randomUUID(),filename:null,size:null}]});
  assert.equal(mail.subject,"");assert.equal(mail.attachments?.[0].size,null);
  assert.equal(reportRecipient(mail),"mmahmoud@thinkwaymedia.com");
  assert.throws(()=>mailSchema.parse({...mail,attachments:[{id:"a",filename:"statement.pdf",size:-1}]}));
});

test("only the three approved addresses match, never display-name spoofing",()=>{
  assert.equal(isFinanceRequester("Mohamed <MOHAMEDELDESOUKY@thinkwaymedia.com>"),true);
  assert.equal(isFinanceRequester("mmahmoud@thinkwaymedia.com"),true);
  assert.equal(isFinanceRequester("raaof@thinkwaymedia.com"),true);
  for(const email of ["raaouf@thinkmedia.com","mohamedeldesouky@thinkwaymedia.com.evil.org","mmahmoud@thinkwaymedia.com <attacker@example.org>","mmahmoud@thinkwaymedia.com\r\nBcc: thief@example.org"]){assert.equal(isFinanceRequester(email),false);}
});
test("reply routing cannot redirect reports through Reply-To or outbound messages",()=>{
  const mail={id:randomUUID(),direction:"inbound" as const,from:"mmahmoud@thinkwaymedia.com",subject:"P&L"};
  assert.equal(reportRecipient(mail),mail.from);
  assert.throws(()=>reportRecipient({...mail,reply_to:["thief@example.org"]}));
  assert.throws(()=>reportRecipient({...mail,direction:"outbound"}));
  assert.throws(()=>reportRecipient({...mail,from:"outsider@example.org"}));
});
test("approval binds exact recipient, body, user and expiry",()=>{
  const now=Date.now();const userId=randomUUID();const secret="test-key";
  const draft={userId,threadId:randomUUID(),emailId:randomUUID(),recipient:"mmahmoud@thinkwaymedia.com",text:"Profit EGP 123",expires:now+600000,nonce:randomUUID()};
  const token=signMailApproval(draft,secret);
  assert.deepEqual(verifyMailApproval(token,secret,userId,now),draft);
  assert.throws(()=>verifyMailApproval(token,secret,randomUUID(),now));
  assert.throws(()=>verifyMailApproval(token,secret,userId,now+600001));
  assert.throws(()=>verifyMailApproval(token,"other-key",userId,now));
  const [payload,signature]=token.split(".");
  const modified=JSON.parse(Buffer.from(payload,"base64url").toString());modified.text="Changed report";
  assert.throws(()=>verifyMailApproval(`${Buffer.from(JSON.stringify(modified)).toString("base64url")}.${signature}`,secret,userId,now));
});
test("email includes verified report tables and scope rather than only model prose",()=>{
  const text=financeEmailText({content:"Your report",retrievedAt:"2026-11-24",sources:[{title:"P&L",href:"/accounting",scope:"Posted ledger, EGP",facts:{},tables:[{heading:"Total",columns:["Currency","Profit"],rows:[["EGP","123.45"]]}]}]});
  assert.match(text,/Posted ledger, EGP/);assert.match(text,/EGP \| 123.45/);assert.match(text,/AI Finance Assistant/);
});
