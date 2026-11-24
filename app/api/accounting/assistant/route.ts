import { FinanceAiProvider } from "@/features/finance-assistant/provider";
import { runFinanceAssistant } from "@/features/finance-assistant/assistant";
import { financeChatSchema } from "@/features/finance-assistant/contracts";
import { executeFinanceReport } from "@/features/finance-assistant/report-tools";
import { accountingContext, loadAccountingSetup } from "@/features/accounting/setup-server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { parseJsonWithSchema } from "@/lib/validation/http";
import { assertCsrfRequest } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const json = (body: unknown, status = 200) => Response.json(body, {status,headers:{"Cache-Control":"private, no-store"}});
  if (!assertCsrfRequest(request).ok) return json({error:"Invalid request origin."},403);
  let ctx;
  try { ctx = await accountingContext(); } catch { return json({error:"Sign in with TW Accounting access and verify MFA where required."},403); }
  const limit = consumeRateLimit({category:"ai",identity:`accounting-assistant:${ctx.user.id}`});
  if (!limit.allowed) return json({error:`Please try again in ${limit.retryAfterSec} seconds.`},429);
  const apiKey = process.env.FINANCE_AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json({error:"Amgad's AI connection is not configured yet."},503);
  const parsed = await parseJsonWithSchema(request,financeChatSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const input = parsed.data;
    const setup = await loadAccountingSetup(input.companyId);
    const year = setup.years.find(y=>y.id===input.yearId);
    if (input.yearId && !year) return json({error:"The selected fiscal year does not belong to this company."},400);
    return json(await runFinanceAssistant(input,{
      provider:new FinanceAiProvider(apiKey,process.env.FINANCE_AI_MODEL?.trim() || "gpt-4.1"),
      context:JSON.stringify({company:setup.company?.name,baseCurrency:setup.company?.base_currency,yearFrom:year?.start_date,yearTo:year?.end_date}),
      execute:plan=>executeFinanceReport(ctx.db,setup,input.yearId,plan),
    }));
  } catch {
    return json({error:"I could not verify that answer. Please check the client name, fiscal year and dates, then try again."},502);
  }
}
