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
    action: z.literal("client_statement"),
    clientName: z.string().trim().min(2).max(120),
    from: date.nullable(), to: date.nullable(),
    display: z.enum(["local", "USD", "foreign"]),
  }).strict(),
  z.object({
    action: z.literal("pnl"),
    from: date.nullable(), to: date.nullable(),
    display: z.enum(["local", "USD", "foreign"]),
  }).strict(),
]).refine((plan) => plan.action === "reply" || !plan.from || !plan.to || plan.from <= plan.to,
  "The start date must precede the end date");

export type FinancePlan = z.infer<typeof financePlanSchema>;
export type FinanceChatInput = z.infer<typeof financeChatSchema>;
export type FinanceEvidence = {
  tables?: Array<{heading:string;columns:string[];rows:string[][]}>;
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
