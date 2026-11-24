import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { financeEmailHtml,financeEmailText,signMailApproval,verifyMailApproval } from "./mail-policy";
test("email approval binds the exact PDF bytes and safely escapes the formatted email",()=>{
 const userId=randomUUID();const attachment={filename:"Amgad-accounting-report.pdf" as const,content:Buffer.from("%PDF-1.7 fixture").toString("base64"),content_type:"application/pdf" as const};
 const value={userId,threadId:randomUUID(),emailId:randomUUID(),recipient:"mohamedeldesouky@thinkwaymedia.com",text:"Report <script>test</script>",expires:Date.now()+600000,nonce:randomUUID(),attachments:[attachment]};
 const token=signMailApproval(value,"fixture-secret");assert.deepEqual(verifyMailApproval(token,"fixture-secret",userId).attachments,[attachment]);
 const [payload,signature]=token.split(".");const changed=JSON.parse(Buffer.from(payload,"base64url").toString());changed.attachments[0].content=Buffer.from("changed").toString("base64");
 assert.throws(()=>verifyMailApproval(Buffer.from(JSON.stringify(changed)).toString("base64url")+"."+signature,"fixture-secret",userId));
 assert.ok(!financeEmailHtml(value.text).includes("<script>"));assert.match(financeEmailHtml(value.text),/&lt;script&gt;/);
});

test("only an actually generated PDF receives an attachment notice",()=>{
 const reply={content:"Verified report summary",sources:[],retrievedAt:"2026-11-24T13:00:00.000Z"};
 assert.doesNotMatch(financeEmailText(reply),/PDF is attached/);
 assert.doesNotMatch(financeEmailText(reply,{pdfAttached:false}),/PDF is attached/);
 const text=financeEmailText(reply,{pdfAttached:true});
 assert.match(text,/requested report PDF is attached/);assert.match(text,/مرفق/);
 assert.match(text,/Verified report summary/);assert.match(text,/2026-11-24/);
});

test("attached PDFs keep transaction tables out of email while unattached replies retain evidence",()=>{
 const reply={content:"Net service revenue is EGP 1000.",retrievedAt:"2026-11-24T13:00:00.000Z",sources:[{title:"Service revenue",href:"/accounting",scope:"November, EGP, posted entries",facts:{},tables:[{heading:"Detail",columns:["Document","Amount"],rows:Array.from({length:200},(_,i)=>[`UNIQUE-JOURNAL-${i}`,"5.00"])}]}]};
 const attached=financeEmailText(reply,{pdfAttached:true});
 assert.doesNotMatch(attached,/UNIQUE-JOURNAL/);assert.match(attached,/Net service revenue/);assert.match(attached,/November, EGP/);assert.ok(attached.length<600);
 assert.match(financeEmailText(reply),/UNIQUE-JOURNAL-199/);
});
