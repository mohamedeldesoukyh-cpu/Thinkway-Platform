import { z } from "zod";

export const financeChatSchema = z.object({
  companyId: z.string().uuid(),
  yearId: z.string().uuid().nullable(),
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(6000),
  }).strict()).max(12).default([]),
}).strict();

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");

export const financePlanSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), reply: z.string().min(1).max(6000) }).strict(),
  z.object({
    action: z.literal("revenue_by_client"),
    from: date.nullable(), to: date.nullable(),
    display: z.enum(["local", "USD", "foreign"]),
    includeTransactions: z.boolean().default(false),
  }).strict(),
  z.object({
    action: z.literal("pnl_comparison"), from: date, to: date,
    comparisonFrom: date, comparisonTo: date,
    display: z.enum(["local", "USD", "foreign"]),
  }).strict(),
  z.object({
    action: z.literal("client_outstanding"), clientName: z.string().trim().min(2).max(120),
    currency: z.string().regex(/^[A-Z]{3}$/), from: z.null(), to: z.null(),
  }).strict(),
  z.object({
    action: z.literal("client_statement"),
    clientName: z.string().trim().min(2).max(120),
    from: date.nullable(), to: date.nullable(),
    display: z.enum(["local", "USD", "foreign"]),
  }).strict(),
  z.object({
    action: z.literal("custom_ledger"),
    title: z.string().trim().min(1).max(100),
    from: date.nullable(), to: date.nullable(),
    display: z.enum(["local","USD","foreign"]),
    accounts: z.array(z.string().regex(/^\d{1,6}$/)).max(20),
    columns: z.array(z.enum(["date","number","reference","account","name","description","party","report_currency","debit","credit","balance"])).min(2).max(11),
  }).strict(),
  z.object({
    action: z.literal("media_accounting_review"),
    from: date.nullable(), to: date.nullable(),
    documentType: z.enum(["all","client_invoice","supplier_invoice","internal_cost","client_credit_note","vendor_credit_note","client_debit_note","vendor_debit_note"]),
  }).strict(),
  z.object({
    action: z.literal("pnl"),
    from: date.nullable(), to: date.nullable(),
    display: z.enum(["local", "USD", "foreign"]),
  }).strict(),
]).refine((plan) => plan.action === "reply" || !plan.from || !plan.to || plan.from <= plan.to,
  "The start date must precede the end date")
  .refine(plan => plan.action !== "pnl_comparison" || plan.comparisonFrom <= plan.comparisonTo,
    "Invalid comparison period");

export type FinancePlan = z.infer<typeof financePlanSchema>;
export type FinanceChatInput = z.infer<typeof financeChatSchema>;
export type FinanceEvidence = {
  statementDocument?: import('@/features/accounting/formatted-report-model').FormattedReport;
  reportPlan?: Exclude<FinancePlan,{action:"reply"}>;
  corrections?: Array<{company:string;id:string;type:string;token:string;number:string;summary:string}>;
  tables?: Array<{heading:string;columns:string[];rows:string[][];orientation?:"portrait"|"landscape"}>;
  title: string;
  href: string;
  scope: string;
  facts: Record<string, unknown>;
};
export type FinanceReply = {
  content: string;
  sources: FinanceEvidence[];
  retrievedAt: string;
};
