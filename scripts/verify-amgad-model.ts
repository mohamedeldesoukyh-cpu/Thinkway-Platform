/** Optional real-provider smoke: only synthetic in-memory data, no database or email writes. */
import assert from 'node:assert/strict';
import { FinanceAiProvider } from '../features/finance-assistant/provider';
import { runFinanceAssistant } from '../features/finance-assistant/assistant';
async function main() {
  if (!process.env.OPENAI_API_KEY && !process.env.FINANCE_AI_API_KEY) throw new Error('Configure an AI key first');
  const provider = new FinanceAiProvider((process.env.FINANCE_AI_API_KEY || process.env.OPENAI_API_KEY)!,process.env.FINANCE_AI_MODEL || 'gpt-4.1');
  const scope={companyId:'11111111-1111-4111-8111-111111111111',yearId:null,history:[]};
  for (const [message, action] of [
    ['هات كشف حساب شركة الاختبار من 2026-01-01 إلى 2026-11-23','client_statement'],
    ['Show my accounting P&L for November 2026 in the company base currency','pnl'],
  ]) {
    let called=false;
    const reply=await runFinanceAssistant({...scope,message},{provider,execute:async plan=>{
      assert.equal(plan.action,action);called=true;
      if(plan.action==='pnl'){assert.equal(plan.from,'2026-11-01');assert.equal(plan.to,'2026-11-30');assert.equal(plan.display,'local');}
      return {title:'Synthetic fixture',href:'/accounting',scope:'In-memory test only. Posted ledger entries.',facts:{currency:'EGP',income:'1200.00',expense:'700.00',netProfit:'500.00'}};
    }});
    assert(called);assert(reply.content.length>0);assert.equal(reply.sources.length,1);
    console.log(`${action}: real-model PASS`);
  }
  const identity=await runFinanceAssistant({...scope,message:'What is your name and can you read my Gmail now?'},{provider,execute:async()=>{throw new Error('Unexpected report call');}});
  assert.match(identity.content,/Amgad/i);assert.match(identity.content,/not|cannot|can't|isn.t/i);
  console.log('identity and unconnected-mailbox honesty: real-model PASS');
  const arabic = await runFinanceAssistant({...scope,message:'أمجد، عرفني بنفسك وهل بريدك الإلكتروني متصل الآن؟',history:[{role:'assistant',content:'The selected fiscal year P&L has a net profit of EGP 0.00.'}]},{provider,execute:async()=>{throw new Error('Unexpected report call');}});
  assert.match(arabic.content,/أمجد|Amgad/i);assert.match(arabic.content,/غير|ليس|لم/);
  console.log('Arabic follow-up after a report: real-model PASS');
}
main().catch(()=>{console.error('Model smoke failed; no data or credentials logged.');process.exitCode=1;});
