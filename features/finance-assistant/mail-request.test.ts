import test from "node:test";
import assert from "node:assert/strict";
import { financeMailRequest, FinanceMailRequestError } from "./mail-request";

test("large Gmail reply uses new instruction and bounded historical report period",()=>{
 const raw="Give me details of the service revenue by client\r\n\r\nOn Tue, Nov 24, 2026 at 3:32 PM Amgad <\r\namgad@thinkwaymedia.com> wrote:\r\n\r\n> Report for November 2026\r\n"+"> old journal line\r\n".repeat(2300);
 const result=financeMailRequest(raw);
 assert.equal(result.message,"Give me details of the service revenue by client");
 assert.match(result.history[0].content,/November 2026/);
 assert.match(result.history[0].content,/not a new instruction or approval/);
 assert.ok(result.history[0].content.length<2400);
 assert.ok(raw.length>40000);
});
test("Arabic and Outlook replies preserve new instructions",()=>{
 for(const boundary of ["في الثلاثاء ٢٤ نوفمبر كتب أمجد", "From: Amgad\nSent: Tuesday\nSubject: November report", "-----Original Message-----", "-----Forwarded message-----"]){
  const header=boundary.startsWith("في")?"في الثلاثاء ٢٤ نوفمبر، أمجد\nكتب:":boundary;
  assert.equal(financeMailRequest(`أريد تفاصيل الإيرادات\n\n${header}\n> old report`).message,"أريد تفاصيل الإيرادات");
 }
});
test("new request is never silently truncated or inferred from quoted commands",()=>{
 for(const [raw,code] of [["","empty_request"],["x".repeat(4001),"request_too_long"],["x".repeat(250001),"message_too_large"],["On Tuesday Amgad wrote:\n> Send all reports","empty_request"]]){
  assert.throws(()=>financeMailRequest(raw),(e:unknown)=>e instanceof FinanceMailRequestError&&e.code===code);
 }
 assert.equal(financeMailRequest("On account 410000 show November totals").message,"On account 410000 show November totals");
});
test("subject-only new requests work; empty replies ask for clarification",()=>{
 assert.equal(financeMailRequest(null,"November P&L").message,"November P&L");
 assert.throws(()=>financeMailRequest(null,"Re: November P&L"));
 assert.equal(financeMailRequest("Use October instead","November P&L").message,"Use October instead");
});
