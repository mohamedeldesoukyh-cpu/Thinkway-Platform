const assert = require('node:assert/strict');
const fs = require('node:fs');
const esbuild = require('esbuild');
const ts = require('typescript');
// Bundle the real server actions with boundary mocks: no database, mail or credentials.
async function load(entry, real = []) {
 const source = ts.createSourceFile(entry, fs.readFileSync(entry, 'utf8'), ts.ScriptTarget.Latest, true);
 const mocks = new Map();
 for (const statement of source.statements) {
  if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
  const spec = statement.moduleSpecifier.text;
  if (real.includes(spec)) continue;
  const bindings = statement.importClause?.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) mocks.set(spec, bindings.elements.filter(x=>!x.isTypeOnly).map(x=>x.name.text));
 }
 if(mocks.has('@/lib/email/provider')) mocks.get('@/lib/email/provider').push('getEmailReplyTo');
 const result = await esbuild.build({entryPoints:[entry], bundle:true, platform:'node', format:'cjs', write:false, plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/.*/}, a => mocks.has(a.path) ? {path:a.path,namespace:'mock'} : undefined);
  b.onLoad({filter:/.*/,namespace:'mock'}, a => ({contents:mocks.get(a.path).map(n=>`export const ${n} = (...args) => global.creatorIoTest.services.${n}?.(...args);`).join('\n')}));
 }}]});
 const module = {exports:{}};
 new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
 return module.exports;
}
let state;
function reset(email = null) {
 state = {writes:[], mails:[], rpcs:[], pdfCalls:0, pdf:Buffer.from('%PDF-test'), row:{id:'io',campaign_header_id:'campaign',status:'sent',delivery_method:'manual',document_number:'VIO-2026-50',amount:1100,currency_code:'AED',influencers:{email,display_name:'Test Creator'},campaign:{name:'Synthetic Campaign'}}};
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from(table){const q={select(){return q},eq(){return q},update(p){state.writes.push({table,patch:p});return q},insert(p){state.writes.push({table,patch:p});return q},maybeSingle:async()=>({data:table==='vendor_ios'?state.row:{full_name:'Traffic'},error:null}),then(resolve){return Promise.resolve({error:null}).then(resolve)}};return q},rpc:async(name,args)=>{state.rpcs.push({name,args});return {data:'synthetic-token',error:null}}};
 global.creatorIoTest={services:{createSupabaseServerClient:async()=>db,assertOutboundEmailReady:()=>({ok:true}),getEmailReplyTo:()=> 'traffic@thinkwaymedia.com',getEmailFromAddress:()=> 'traffic@thinkwaymedia.com',renderLiveVendorIoHtml:async()=>'<html><body>Selected IO terms</body></html>',renderHtmlToPdf:async()=>{state.pdfCalls++;return {ok:true,buffer:state.pdf}},buildIoEmailLink:()=> 'https://example.invalid/approve',sendEmail:async input=>{state.mails.push(input);return {ok:true,messageId:'mock'}},buildIoDeliveryNotificationMeta:input=>input,canRecordVendorIoManualApproval:()=>true,vendorIoNeedsSend:()=>true,vendorIoBulkSkipReason:()=>null,vendorIoRowToLifecycleSnapshot:row=>row,appendBulkDeferRevalidate:()=>{},sendVendorIoAction:async()=>{state.rpcs.push('send');return {ok:true}}}};
}
const form=(manual=false)=>{const f=new FormData();f.set('id','io');f.set('campaign_header_id','campaign');if(manual)f.set('delivery_method','manual');return f};
(async()=>{
 reset();
 const {sendVendorIoAction:send}=await load('features/io/actions.ts',['@/lib/email/vendor-io-email','@/lib/io/vendor-io-delivery','@/lib/email/io-email-summary']);
 assert.equal((await send({},form())).ok,false);assert.equal(state.rpcs.length,0);assert.equal(state.writes.length,0);assert.equal(state.mails.length,0);
 console.log('PASS missing email does not send or silently mark delivered');
 reset();assert.equal((await send({},form(true))).ok,true);assert.equal(state.mails.length,0);assert.equal(state.pdfCalls,0);assert.equal(state.writes[0].patch.delivery_method,'manual');
 console.log('PASS explicit manual delivery works without creator email or mail/PDF service');
 const {recordVendorIoManualApprovalAction:approve}=await load('features/io/record-vendor-io-manual-approval-action.ts');
 reset();assert.equal((await approve({},form())).ok,true);assert.equal(state.writes[0].patch.status,'approved');assert.equal(state.mails.length,0);
 console.log('PASS manual approval records approval without creator email');
 reset('creator@example.invalid');assert.equal((await send({},form())).ok,true);assert.equal(state.mails[0].to[0].email,'creator@example.invalid');assert.equal(state.mails[0].cc[0].email,'traffic@thinkwaymedia.com');assert.match(state.mails[0].subject,/Creator Insertion Order.*Synthetic Campaign/);assert.equal(state.mails[0].attachments.length,1);assert.match(state.writes[0].patch.terms_html,/Selected IO terms/);
 console.log('PASS stored creator recipient, Traffic CC, campaign subject, PDF and sent terms snapshot');
 reset('creator@example.invalid');state.pdf=Buffer.from('bad');assert.equal((await send({},form())).ok,false);assert.equal(state.mails.length,0);assert.equal(state.rpcs.length,0);
 console.log('PASS invalid PDF blocks email before delivery mutation');
 const {mutateVendorIoSend:bulk,mutateVendorIoMarkDelivered:manualBulk}=await load('features/io/bulk/vendor-io-bulk-mutations.ts',['@/lib/io/vendor-io-delivery']);
 reset();assert.equal((await bulk({id:'io',influencer_name:'Test Creator',influencer_email:null})).skipped,true);assert.equal(state.rpcs.length,0);
 console.log('PASS bulk email skips missing email without manual-delivery side effects');
 reset();global.creatorIoTest.services.vendorIoNeedsSend=()=>true;
 global.creatorIoTest.services.sendVendorIoAction=async(prev,fd)=>{state.rpcs.push(Object.fromEntries(fd));return {ok:true}};
 assert.equal((await manualBulk({id:'io',campaign_header_id:'campaign',influencer_email:null})).ok,true);
 assert.equal(state.rpcs[0].delivery_method,'manual');assert.equal(state.rpcs[0].id,'io');
 console.log('PASS bulk manual delivery explicitly selects manual delivery without email');
 reset();global.creatorIoTest.services.vendorIoBulkSkipReason=()=> 'Approved IO';
 assert.equal((await manualBulk({id:'io'})).skipped,true);assert.equal(state.rpcs.length,0);
 console.log('PASS bulk manual delivery preserves lifecycle guard');
})().catch(error=>{console.error(error);process.exitCode=1});
