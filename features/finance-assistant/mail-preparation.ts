import type { FinanceReply, FinanceEvidence } from "./contracts";
import { financeAttachmentSchema, financeEmailText } from "./mail-policy";
import { FinanceMailRequestError } from "./mail-request";
import { financeLanguage, financeSignature, type FinanceLanguage } from "./presentation";

export type PreparationStage = "load" | "request" | "scope" | "report" | "pdf";

// Preparation failures become honest, non-financial replies, never partial reports.
// These still go through the same owner authentication and delivery policy.
export function failedMailPreparation(error: unknown, stage: PreparationStage, attempts: number, language:FinanceLanguage="en") {
  const code = error instanceof FinanceMailRequestError ? error.code : `${stage}_failed`;
  if (!(error instanceof FinanceMailRequestError) && attempts < 3) {
    return { status: "queued" as const, error_code: code };
  }
  const explanation = error instanceof FinanceMailRequestError
    ? error.code === "empty_request"
      ? "Please write your new request above the quoted conversation, including the report and period. / يرجى كتابة طلبك الجديد أعلى المحادثة السابقة مع تحديد التقرير والفترة."
      : "Please shorten your new request to 4,000 characters or less; you can remove the old quoted conversation. / يرجى اختصار طلبك الجديد إلى ٤٠٠٠ حرف أو أقل، ويمكن حذف المحادثة السابقة."
    : stage === "pdf"
      ? "I could not generate the complete report PDF after retrying. No partial financial report is attached. Please request a narrower period or contact support with the original email. / تعذر إنشاء ملف التقرير الكامل بعد إعادة المحاولة. لم يتم إرفاق تقرير مالي جزئي. يرجى تحديد فترة أقصر أو التواصل مع الدعم بالرسالة الأصلية."
      : "I could not complete this request after retrying. No financial results or accounting changes were produced. Please contact support with this email, or try the request again later. / تعذر إكمال هذا الطلب بعد إعادة المحاولة. لم يتم إصدار نتائج مالية أو تنفيذ تغييرات محاسبية. يرجى التواصل مع الدعم بهذه الرسالة أو إعادة الطلب لاحقاً.";
  return { status: "prepared" as const, error_code: code, response_text: `${explanation.split(" / ")[language==="ar"?1:0]}\n\n${financeSignature(language)}`, attachments: [] };
}

export const EXPIRED_PREPARATION_RESPONSE = failedMailPreparation(new Error(), "report", 3);

/** One formatter for both reviewed drafts and automatic owner replies. */
export async function prepareFinanceMailContent(reply: FinanceReply, unprocessedDocuments: boolean,
  pdf: (report: FinanceEvidence, retrievedAt: string) => Promise<Buffer>, language:FinanceLanguage=financeLanguage(reply.content)) {
  const reports = reply.sources.filter(source => source.tables?.length);
  if (reports.length > 1) throw new Error("Multiple report documents require explicit bundling");
  const attachments = reports.length ? [financeAttachmentSchema.parse({
    filename: "Amgad-accounting-report.pdf", content: (await pdf(reports[0], reply.retrievedAt)).toString("base64"), content_type: "application/pdf",
  })] : [];
  const response_text = financeEmailText(reply, { pdfAttached: attachments.length > 0, language, unprocessedDocuments });
  return { response_text, attachments };
}

/** A failed preparation must not starve an already prepared reply. */
export async function processFinanceMailCycle(prepare: () => Promise<unknown>, deliver: () => Promise<unknown>) {
  let preparation: unknown;
  try { preparation = await prepare(); }
  catch { preparation = { error: "preparation_unavailable" }; }
  return { preparation, delivery: await deliver() };
}
