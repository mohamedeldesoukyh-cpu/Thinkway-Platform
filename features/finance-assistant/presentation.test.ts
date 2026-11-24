import test from "node:test";
import assert from "node:assert/strict";
import { financeLanguage, financeReportCaption, hasUnprocessedDocuments } from "./presentation";
import { financeEmailHtml, financeEmailText } from "./mail-policy";
import { failedMailPreparation } from "./mail-preparation";
import type { FinanceReply } from "./contracts";

test("English and Arabic emails each use one language and no technical metadata",()=>{
 for(const [language,content] of [["en","Your November report."],["ar","تقرير شهر نوفمبر."]] as const){
  const reply={content,sources:[{title:"Technical title",href:"/accounting",scope:"INTERNAL_SCOPE",facts:{}}],retrievedAt:"2026-11-24T14:59:36.467Z"};
  const text=financeEmailText(reply,{pdfAttached:true,language});
  assert.doesNotMatch(text,/INTERNAL_SCOPE|Technical title|Prepared:|2026-11-24T/);
  if(language==="en")assert.doesNotMatch(text,/[\u0600-\u06ff]/);
  else assert.doesNotMatch(text,/report|Finance|Prepared|attached/);
  const html=financeEmailHtml(text);
  assert.match(html,new RegExp(`lang="${language}"`));
  assert.match(html,new RegExp(`dir="${language==="ar"?"rtl":"ltr"}"`));
  assert.match(html,/table role="presentation" width="640"/);
  assert.doesNotMatch(html,/white-space:pre-wrap/);
 }
});
test("request language ignores an opposite-language quoted conversation",()=>{
 assert.equal(financeLanguage("Send me the report\n\nOn Tuesday wrote:\nتقرير قديم"),"en");
 assert.equal(financeLanguage("أريد تقرير الإيرادات\n\nOn Tuesday wrote: English history"),"ar");
 assert.equal(financeLanguage("Reply in Arabic please"),"ar");
 assert.equal(financeLanguage("أريد التقرير بالإنجليزية"),"en");
 assert.equal(financeLanguage("Hi Amgad,\n\nأريد كشف حساب Fresh Electric for Home Appliances"),"ar");
});
test("signature logos do not trigger warnings; actual files and unknown images do",()=>{
 assert.equal(hasUnprocessedDocuments([{filename:"Thinkway",size:4327}]),false);
 assert.equal(hasUnprocessedDocuments([{filename:"logo.png",size:4000}]),false);
 assert.equal(hasUnprocessedDocuments([{filename:"image.png",size:4000,content_disposition:"inline"}]),false);
 for(const filename of ["Thinkway.pdf","bank-statement.png","statement.csv",null])assert.equal(hasUnprocessedDocuments([{filename,size:4327}]),true);
 assert.equal(hasUnprocessedDocuments([{filename:"Thinkway",size:100000}]),true);
});
test("failure notices do not expose internal codes or mix languages",()=>{
 const en=failedMailPreparation(Error(),"pdf",3,"en").response_text!;
 const ar=failedMailPreparation(Error(),"pdf",3,"ar").response_text!;
 assert.doesNotMatch(en,/[\u0600-\u06ff]|Reference:|pdf_failed/);
 assert.doesNotMatch(ar,/Reference:|pdf_failed|could not/);
});
test("PDF caption has human-readable dates and concise scope",()=>{
 const caption=financeReportCaption({title:"Report",href:"/accounting",scope:"credits minus debits; Zero-net clients",facts:{from:"2026-11-01",to:"2026-11-30"}},"2026-11-24T14:59:36.467Z");
 assert.match(caption,/1 Nov 2026 – 30 Nov 2026/);
 assert.doesNotMatch(caption,/credits minus|Zero-net|T14:|Generated/);
});
test("client summary email renders exact totals and readable bullet rows without codes",()=>{
 const reply:FinanceReply={content:"Unused dense narrative",retrievedAt:"2026-11-24T14:00:00Z",sources:[{title:"Service revenue",href:"/accounting",scope:"Technical scope",reportPlan:{action:"revenue_by_client",from:"2026-11-01",to:"2026-11-30",display:"local",includeTransactions:false},facts:{from:"2026-11-01",to:"2026-11-30",totals:[{currency:"EGP",netRevenue:"1000.01"}],clients:[{name:"Client <A>",code:"CLT-000009",currency:"EGP",netRevenue:"1000.01",transactionCount:2},{name:"Offset client",code:"CLT-000001",currency:"EGP",netRevenue:"0.00",transactionCount:2}]}}]};
 const text=financeEmailText(reply,{language:"en",pdfAttached:true});
 assert.match(text,/Total net revenue: EGP 1,000.01/);assert.match(text,/• Offset client: EGP 0.00/);
 assert.doesNotMatch(text,/Unused dense|Technical scope|CLT-000/);
 const html=financeEmailHtml(text);assert.match(html,/<table aria-label="Client revenue"/);assert.match(html,/Client &lt;A&gt;/);assert.doesNotMatch(html,/<A>/);
});
