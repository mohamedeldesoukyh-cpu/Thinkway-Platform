import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FinanceReply } from "./contracts";
import { FINANCE_OWNER } from "./approval-policy";
import { financeLanguage, financeSignature, type FinanceLanguage } from "./presentation";

export const FINANCE_MAILBOX = "amgad@thinkwaymedia.com";
export const FINANCE_INBOX_ID = "62af07bc-6823-47a3-bf0d-aee74451d771";
export const FINANCE_REQUESTERS = [FINANCE_OWNER] as const;
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
  message_id: z.string().nullable().optional(),
  subject: z.string().nullable().transform(value=>value??""), text: z.string().nullable().optional(), reply_to: z.array(z.string()).nullable().optional(),
  attachments: z.array(z.object({id:z.string(),filename:z.string().nullable(),size:z.number().nonnegative().nullable(),content_disposition:z.string().nullable().optional()})).optional(),
});
export function reportRecipient(mail: z.infer<typeof mailSchema>) {
  const sender = mailboxAddress(mail.from);
  if (mail.direction !== "inbound" || !sender || !isFinanceRequester(sender)) throw new Error("This sender is not authorized to request finance reports.");
  if (mail.reply_to?.some(address => mailboxAddress(address) !== sender)) throw new Error("Reply-To differs from the authorized sender. Review this message in Resend.");
  return sender;
}
function clientRevenueSummary(reply:FinanceReply, language:FinanceLanguage) {
  const evidence=reply.sources.find(source=>source.reportPlan?.action==="revenue_by_client");
  if(!evidence)return null;
  const money=z.string().regex(/^-?\d+\.\d{2}$/);
  const facts=z.object({from:z.string(),to:z.string(),totals:z.array(z.object({currency:z.string(),netRevenue:money})),clients:z.array(z.object({name:z.string(),currency:z.string(),netRevenue:money,transactionCount:z.number()}))}).safeParse(evidence.facts);
  if(!facts.success)return null;
  const date=(value:string)=>new Intl.DateTimeFormat(language==="ar"?"ar-EG":"en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Cairo"}).format(new Date(value));
  const amount=(value:string)=>value.replace(/\B(?=(\d{3})+(?!\d))/g,",");
  const heading=language==="ar"?"إيرادات الخدمات حسب العميل":"Service revenue by client";
  const period=`${date(facts.data.from)} – ${date(facts.data.to)}`;
  const totals=facts.data.totals.map(total=>`${language==="ar"?"إجمالي صافي الإيرادات":"Total net revenue"}: ${total.currency} ${amount(total.netRevenue)}`).join("\n");
  const clients=facts.data.clients.length<=8?facts.data.clients.map(client=>`• ${client.name}: ${client.currency} ${amount(client.netRevenue)}`).join("\n"):"";
  return [heading,period,totals||(language==="ar"?"لا توجد إيرادات خدمات مسجلة خلال هذه الفترة.":"No service revenue was recorded for this period."),clients].filter(Boolean).join("\n\n");
}
export function financeEmailText(reply: FinanceReply, options?: { pdfAttached?: boolean; language?:FinanceLanguage; unprocessedDocuments?:boolean }) {
  const language=options?.language??financeLanguage(reply.content);
  const analysis=reply.sources.find(s=>s.reportPlan?.action==="accounting_analysis");
  const arabicLabels:Record<string,string>={"Client":"العميل","Supplier / creator":"المورد / صانع المحتوى","Campaign":"الحملة","Account":"الحساب","Month":"الشهر","Transaction type":"نوع المعاملة","Revenue":"الإيرادات","Direct cost":"التكلفة المباشرة","Gross profit":"مجمل الربح","GP %":"هامش الربح %","Debit":"مدين","Credit":"دائن","Net debit / (credit)":"صافي المدين / (الدائن)","Total":"الإجمالي","Unassigned client":"عميل غير محدد","Unassigned campaign":"حملة غير محددة","Unassigned supplier":"مورد غير محدد"};
  const label=(value:string)=>language==="ar"?(arabicLabels[value]??value):value;
  const preview=analysis?.tables?.filter(t=>t.columns.length<=8).slice(0,2).map(t=>`${language==="ar"?"التقرير المحاسبي"+(t.heading.match(/ · [A-Z]{3}$/)?.[0]??""):t.heading}\n\n${[t.columns,...(t.rows.length>9?[...t.rows.slice(0,8),t.rows.at(-1)!]:t.rows)].map(row=>row.map(cell=>label(cell).replaceAll("|","/").replace(/[\r\n]+/g," ")).join(" | ")).join("\n")}${t.rows.length>9?language==="ar"?"\n\nالتفاصيل الكاملة في الملف المرفق.":"\n\nThe complete breakdown is in the attached report.":""}`).join("\n\n");
  const qualification=analysis?.facts.provisional?(language==="ar"?"أرباح العملاء مؤقتة لوجود قيود لم يتم تحديد العميل المرتبط بها. تظهر هذه القيود بشكل منفصل في التقرير.":"Client profit is provisional because some entries have no verified client link. Unassigned entries are shown separately in the report."):null;
  return [clientRevenueSummary(reply,language)??reply.content.trim(),preview,qualification, ...(options?.pdfAttached ? [language==="ar"?"التقرير المطلوب مرفق بصيغة PDF.":"The requested report PDF is attached."] : reply.sources.flatMap(source =>
    (source.tables ?? []).map(table => `${table.heading}\n${table.columns.join(" | ")}\n${table.rows.map(row => row.join(" | ")).join("\n")}`))),
    ...(options?.unprocessedDocuments?[language==="ar"?"لم أراجع المستندات المرفقة. يرجى رفعها في مساحة مستندات أمجد لمراجعتها.":"I have not reviewed the attached documents. Please upload them in Amgad’s document workspace for review."]:[]),
    financeSignature(language)].filter(Boolean).join("\n\n");
}
export const financeAttachmentSchema=z.object({filename:z.literal("Amgad-accounting-report.pdf"),content:z.string().max(2_700_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),content_type:z.literal("application/pdf")}).strict();
export function financeEmailHtml(text:string){
 const arabic=text.endsWith(financeSignature("ar"))||financeLanguage(text)==="ar";
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const paragraphs=text.split(/\n\s*\n/).filter(Boolean).map(block=>block.includes(" | ")&&block.split("\n").length>1&&block.split("\n").every(line=>line.split(" | ").length===block.split("\n")[0].split(" | ").length)
  ?`<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px">${block.split("\n").map((line,i)=>`<tr>${line.split(" | ").map(cell=>`<${i?"td":"th"} dir="auto" style="padding:10px 6px;text-align:${arabic?"right":"left"};border-bottom:1px solid #e5e7eb;font-size:13px">${escape(cell)}</${i?"td":"th"}>`).join("")}</tr>`).join("")}</table>`
  :block.split("\n").every(line=>/^• .+: [A-Z]{3} -?[\d,.]+$/.test(line))
  ?`<table aria-label="${arabic?"إيرادات العملاء":"Client revenue"}" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 22px;border-collapse:collapse"><thead><tr><th align="${arabic?"right":"left"}" style="border-bottom:2px solid #080642;padding:12px 10px;font-size:12px;color:#080642">${arabic?"العميل":"Client"}</th><th align="right" style="border-bottom:2px solid #080642;padding:12px 10px;font-size:12px;color:#080642;white-space:nowrap">${arabic?"صافي الإيرادات":"Net revenue"}</th></tr></thead><tbody>${block.split("\n").map(line=>{const row=/^• (.+): ([A-Z]{3} -?[\d,.]+)$/.exec(line)!;return `<tr><td dir="auto" align="${arabic?"right":"left"}" style="border-bottom:1px solid #e5e7eb;padding:13px 10px;font-size:14px;line-height:1.5;color:#223046">${escape(row[1])}</td><td dir="ltr" align="right" style="border-bottom:1px solid #e5e7eb;padding:13px 10px;font-size:14px;color:#223046;white-space:nowrap">${escape(row[2])}</td></tr>`;}).join("")}</tbody></table>`
  :`<p style="margin:0 0 18px;font-size:${/^(?:Service revenue by client|إيرادات الخدمات حسب العميل)$/.test(block)?"20px;font-weight:bold":"15px"};line-height:1.65;color:#223046;${/^(?:Total net revenue|إجمالي صافي الإيرادات):/.test(block)?"font-weight:bold;font-size:18px":""}">${escape(block).replaceAll("\n","<br>")}</p>`).join("");
 // Presentation tables and inline CSS work in Gmail and Outlook without relying
 // on main/div width or white-space rules that email clients may discard.
 return `<!doctype html><html lang="${arabic?"ar":"en"}" dir="${arabic?"rtl":"ltr"}"><body style="margin:0;padding:0;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="left" style="padding:0"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px"><tr><td dir="${arabic?"rtl":"ltr"}" align="${arabic?"right":"left"}" style="padding:0 0 20px;color:#080642;font-size:18px;font-weight:bold">${arabic?"ثينك واي | الشؤون المالية":"Thinkway | Finance"}</td></tr><tr><td dir="${arabic?"rtl":"ltr"}" align="${arabic?"right":"left"}" style="padding:0">${paragraphs}</td></tr><tr><td dir="${arabic?"rtl":"ltr"}" align="${arabic?"right":"left"}" style="padding:16px 0;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">${arabic?"معلومات مالية سرية":"Confidential financial information"}</td></tr></table></td></tr></table></body></html>`;
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
