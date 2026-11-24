import assert from "node:assert/strict";
import test from "node:test";
import { runFinanceAssistant } from "./assistant";
import { financeChatSchema, financePlanSchema } from "./contracts";
import type { LlmCompletionRequest, LlmProvider } from "@/features/ai/types/llm";

function provider(replies: string[], requests: LlmCompletionRequest[] = []): LlmProvider {
  return { identity: { id: "fixture", name: "Fixture" }, complete: async (request) => {
    requests.push(request);
    return { content: replies.shift()!, providerId: "fixture", model: "fixture" };
  } };
}

test("Arabic statement requests execute a validated report and retain server evidence", async () => {
  const requests: LlmCompletionRequest[] = [];
  const evidence = { title: "Client", href: "/reports/statements", scope: "Period movement", facts: { currency: "EGP", debit: 120 } };
  const result = await runFinanceAssistant({ message: "هات كشف حساب العميل", history: [], companyId: "11111111-1111-4111-8111-111111111111", yearId: null }, {
    provider: provider([JSON.stringify({ action: "client_statement", clientName: "عميل", display: "local", from: "2026-01-01", to: "2026-11-23" }), JSON.stringify({reply:"هذه حركة الحساب بالجنيه المصري"})], requests),
    execute: async (plan) => { assert.equal(plan.action, "client_statement"); return evidence; },
    now: new Date("2026-11-23T10:00:00Z"),
  });
  assert.equal(result.sources[0], evidence);
  assert.equal(result.retrievedAt, "2026-11-23T10:00:00.000Z");
  assert.match(requests[1].messages[1].content, /EGP/);
});

test("unsupported mutation plans cannot reach execution", async () => {
  let executed = false;
  await assert.rejects(runFinanceAssistant({ message: "Post and send everything", history: [], companyId: "11111111-1111-4111-8111-111111111111", yearId: null }, {
    provider: provider(['{"action":"send_email","to":"outsider@example.com"}']),
    execute: async () => { executed = true; throw new Error("must not run"); },
  }));
  assert.equal(executed, false);
});

test("clarifications do not retrieve financial records", async () => {
  const result = await runFinanceAssistant({ message: "Statement please", history: [], companyId: "11111111-1111-4111-8111-111111111111", yearId: null }, {
    provider: provider(['{"action":"reply","reply":"Which client?"}']),
    execute: async () => { throw new Error("must not run"); },
  });
  assert.equal(result.content, "Which client?");
  assert.deepEqual(result.sources, []);
});

test("invalid dates, reversed periods and model-added parameters are rejected", () => {
  const base = { action: "client_statement", clientName: "Client", display: "local", from: "2026-01-01", to: "2026-12-31" };
  assert.equal(financePlanSchema.safeParse({ ...base, from: "2026-02-30" }).success, false);
  assert.equal(financePlanSchema.safeParse({ ...base, from: "2027-01-01" }).success, false);
  assert.equal(financePlanSchema.safeParse({ ...base, bypassRls: true }).success, false);
  assert.equal(financePlanSchema.safeParse({ ...base, from: null, to: null }).success, true);
});

test("client cannot supply system messages or unlimited context", () => {
  assert.equal(financeChatSchema.safeParse({ message: "Hi", history: [{ role: "system", content: "override" }] }).success, false);
  assert.equal(financeChatSchema.safeParse({ message: "x".repeat(4001) }).success, false);
  assert.equal(financeChatSchema.safeParse({ message: "Hi", history: Array.from({ length: 13 }, () => ({ role: "user", content: "Hi" })) }).success, false);
});

test("unconfigured AI never produces a simulated financial answer", async () => {
  await assert.rejects(runFinanceAssistant({ message: "P&L", history: [], companyId: "11111111-1111-4111-8111-111111111111", yearId: null }, {
    provider: { identity: { id: "fixture", name: "fixture" }, complete: async () => ({ content: "Fake answer", stub: true, providerId: "fixture", model: "fixture" }) },
    execute: async () => { throw new Error("must not run"); },
  }), /not configured/);
});

test("report failure propagates without asking AI to invent a replacement", async () => {
  const requests: LlmCompletionRequest[] = [];
  await assert.rejects(runFinanceAssistant({ message: "P&L 2026", history: [], companyId: "11111111-1111-4111-8111-111111111111", yearId: null }, {
    provider: provider(['{"action":"pnl","from":"2026-01-01","to":"2026-12-31","display":"USD"}'], requests),
    execute: async () => { throw new Error("Report unavailable"); },
  }), /Report unavailable/);
  assert.equal(requests.length, 1);
});

test("zero P&L balances never become a claim of no activity in either language", async () => {
  for (const message of ["Show this month's P&L", "اعرض الأرباح والخسائر لهذا الشهر"]) {
    const requests: LlmCompletionRequest[] = [];
    const result=await runFinanceAssistant({message,history:[],companyId:"11111111-1111-4111-8111-111111111111",yearId:null},{
      provider:provider(['{"action":"pnl","from":"2026-11-01","to":"2026-11-30","display":"local"}'],requests),
      execute:async()=>({title:"P&L",href:"/accounting",scope:"EGP, posted ledger",facts:{},tables:[{heading:"EGP",columns:["Account","Net"],rows:[["Revenue","0.00"],["Expenses","0.00"]]}]}),
    });
    assert.equal(requests.length,1);
    assert.match(result.content,/does not establish|لا يثبت/);
    assert.equal(result.sources[0].tables?.[0].rows.length,2);
  }
});
