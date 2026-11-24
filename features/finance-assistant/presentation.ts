import type { FinanceEvidence } from "./contracts";

export type FinanceLanguage = "en" | "ar";
export function financeLanguage(text: string): FinanceLanguage {
  const first = text.trim().split(/\n\s*(?:On .{0,200}wrote:|From:|-----Original Message-----)/i)[0]
    .replace(/^(?:(?:hi|hello|dear)\s+(?:amgad)?[,،!]?|(?:مرحبا|مرحباً|عزيزي)\s*أمجد[,،!]?)\s*\n+/i,"");
  if (/\b(?:reply|respond|answer|write)\s+in\s+arabic\b/i.test(first)) return "ar";
  if (/\b(?:reply|respond|answer|write)\s+in\s+english\b/i.test(first)||/(?:بالإنجليزية|بالانجليزية)/.test(first)) return "en";
  const firstLetter=first.match(/[a-z\u0621-\u064a]/i)?.[0];
  if(firstLetter)return /[\u0621-\u064a]/.test(firstLetter)?"ar":"en";
  const arabic = first.match(/[\u0621-\u064a]/g)?.length ?? 0;
  const latin = first.match(/[a-z]/gi)?.length ?? 0;
  return arabic > latin ? "ar" : "en";
}
export const financeSignature = (language: FinanceLanguage) => language === "ar"
  ? "أمجد\nمساعد الشؤون المالية بالذكاء الاصطناعي | ثينك واي"
  : "Amgad\nAI Finance Assistant | Thinkway";

/** Keep audit scope in evidence; the printed caption is for the report reader. */
export function financeReportCaption(evidence: FinanceEvidence, retrievedAt: string) {
  const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Cairo" }).format(new Date(value));
  const facts=evidence.facts;
  const from=typeof facts.from==="string"?facts.from:typeof facts.currentFrom==="string"?facts.currentFrom:null;
  const to=typeof facts.to==="string"?facts.to:typeof facts.currentTo==="string"?facts.currentTo:null;
  const parts=[from&&to?`${date(from)} – ${date(to)}`:`As at ${date(retrievedAt)}`];
  if(typeof facts.comparisonFrom==="string"&&typeof facts.comparisonTo==="string")parts.push(`Compared with ${date(facts.comparisonFrom)} – ${date(facts.comparisonTo)}`);
  if(typeof facts.currency==="string")parts.push(facts.currency);
  parts.push(facts.currentOnly?"Current unsettled invoices":"Posted transactions, including unlocked entries");
  if(facts.provisional)parts.push(`Provisional client allocation: ${facts.unassignedEntries} entries remain unassigned`);
  if(facts.area==="profitability")parts.push("GP before overheads and tax");
  return parts.join(" · ");
}

type IncomingAttachment = { filename:string|null; size:number|null; content_disposition?:string|null };
export function hasUnprocessedDocuments(attachments: IncomingAttachment[] = []) {
  return attachments.some(file => {
    if(file.content_disposition?.toLowerCase()==="inline")return false;
    // Resend's inbox payload sometimes omits disposition for the Thinkway signature.
    // Do not suppress ordinary photos/scans or financial documents by size alone.
    const brandImage=/^(?:thinkway|logo|signature)(?:\.(?:png|jpe?g|gif|webp))?$/i.test(file.filename??"");
    return !(brandImage&&file.size!==null&&file.size<=50000);
  });
}
