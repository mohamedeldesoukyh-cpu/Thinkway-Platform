import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { financeEmailHtml,signMailApproval,verifyMailApproval } from "./mail-policy";
test("email approval binds the exact PDF bytes and safely escapes the formatted email",()=>{
 const userId=randomUUID();const attachment={filename:"Amgad-accounting-report.pdf" as const,content:Buffer.from("%PDF-1.7 fixture").toString("base64"),content_type:"application/pdf" as const};
 const value={userId,threadId:randomUUID(),emailId:randomUUID(),recipient:"mohamedeldesouky@thinkwaymedia.com",text:"Report <script>test</script>",expires:Date.now()+600000,nonce:randomUUID(),attachments:[attachment]};
 const token=signMailApproval(value,"fixture-secret");assert.deepEqual(verifyMailApproval(token,"fixture-secret",userId).attachments,[attachment]);
 const [payload,signature]=token.split(".");const changed=JSON.parse(Buffer.from(payload,"base64url").toString());changed.attachments[0].content=Buffer.from("changed").toString("base64");
 assert.throws(()=>verifyMailApproval(Buffer.from(JSON.stringify(changed)).toString("base64url")+"."+signature,"fixture-secret",userId));
 assert.ok(!financeEmailHtml(value.text).includes("<script>"));assert.match(financeEmailHtml(value.text),/&lt;script&gt;/);
});
