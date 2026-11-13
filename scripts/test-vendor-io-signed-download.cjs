// Execute the actual route with controlled authorization/storage boundaries.
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const id='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const storedPath=`${id}/signed/33333333-3333-4333-8333-333333333333.pdf`;
const original=Buffer.from('%PDF-1.7\noriginal immutable signed bytes\n%%EOF');
let state;
const reset=(overrides={})=>state={events:[],path:storedPath,...overrides};
const caller={from(table){state.events.push(table);return {select(){return this;},eq(column,value){assert.equal(value,id);return this;},async maybeSingle(){
 if(table==='vendor_ios') return {data:state.hidden?null:{document_number:'VIO-QA'}};
 assert.equal(table,'vendor_io_signatures');return {data:state.unsigned?null:{signed_pdf_path:state.path},error:state.signatureError?new Error('private query error'):null};
}};}};
global.__signedDownload={
 createSupabaseServerClient:async()=>caller,
 requireApiPermission:async(client,permission)=>{assert.equal(client,caller);assert.equal(permission,'vendor_ios.read');state.events.push('permission');return state.denied?{response:Response.json({error:'denied'},{status:state.denied})}:{userId:'synthetic'};},
 createSupabaseAdminClient:()=>{state.events.push('admin');return {serverOnly:true};},
 downloadIoDocumentBuffer:async(client,bucket,p)=>{assert.equal(client.serverOnly,true);assert.equal(bucket,'vendor-io-documents');assert.equal(p,storedPath);state.events.push('private read');if(state.storageError)throw Error('secret /private/path must not leak');return state.missing?null:original;},
 renderLiveVendorIoHtml:async()=>{state.events.push('unsigned render');return '<html>unsigned</html>';},
 renderHtmlToPdf:async()=>({ok:true,buffer:Buffer.from('%PDF-unsigned')}),
 pdfUnavailableMessage:()=> 'unavailable',
};
(async()=>{
 const mocks={
  '@/lib/supabase/server':['createSupabaseServerClient'], '@/lib/auth/api-auth':['requireApiPermission'],
  '@/lib/supabase/admin':['createSupabaseAdminClient'], '@/lib/io/io-document-storage':['downloadIoDocumentBuffer'],
  '@/lib/io/render-live-vendor-io-html':['renderLiveVendorIoHtml'], '@/lib/io/vendor-io-pdf':['renderHtmlToPdf','pdfUnavailableMessage'],
 };
 const built=await build({entryPoints:['app/api/vendor-ios/[id]/document/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path].map(n=>`export const ${n}=(...a)=>globalThis.__signedDownload.${n}(...a);`).join('\n')+(a.path.endsWith('vendor-io-pdf')?'\nexport const INSERTION_ORDER_PDF_OPTIONS={};':'')}));
 }}]});
 const mod=new Module(path.resolve('signed-download-review.cjs'),module);mod.filename=path.resolve('signed-download-review.cjs');mod.paths=module.paths;mod._compile(built.outputFiles[0].text,mod.filename);
 const get=()=>mod.exports.GET(new Request('https://test.invalid/api/vendor-ios/'+id+'/document?format=pdf&download=1&path='+other+'/signed/forbidden.pdf'),{params:Promise.resolve({id})});
 for(const status of [401,403]){reset({denied:status});assert.equal((await get()).status,status);assert.deepEqual(state.events,['permission']);}
 console.log('PASS anonymous, expired-session and missing-permission denial precede privileged access');
 reset({hidden:true});assert.equal((await get()).status,404);assert.deepEqual(state.events,['permission','vendor_ios']);console.log('PASS another creator / RLS-hidden IO never reaches privileged storage');
 reset({signatureError:true});assert.equal((await get()).status,500);assert.ok(!state.events.includes('admin'));console.log('PASS signature authorization errors fail closed');
 for(const invalid of [`${other}/signed/33333333-3333-4333-8333-333333333333.pdf`,`${id}/signed/../../secret.pdf`,'https://storage.invalid/private.pdf']){reset({path:invalid});assert.equal((await get()).status,500);assert.ok(!state.events.includes('admin'));}
 console.log('PASS cross-IO, traversal and URL paths rejected');
 reset();const r=await get();assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),original);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('content-type'),'application/pdf');assert.equal(r.headers.get('location'),null);assert.deepEqual(state.events,['permission','vendor_ios','vendor_io_signatures','admin','private read']);console.log('PASS authorized download returns exact original bytes without direct storage permission, URL or regeneration');
 for(const mode of ['missing','storageError']){reset({[mode]:true});const response=await get();assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/secret|private\/path/);assert.ok(!state.events.includes('unsigned render'));}
 console.log('PASS storage failures are redacted and never regenerate evidence');
 reset({unsigned:true});assert.equal((await get()).status,200);assert.ok(state.events.includes('unsigned render'));assert.ok(!state.events.includes('admin'));console.log('PASS existing unsigned PDF generation remains unchanged');
})().catch(e=>{console.error(e);process.exitCode=1});
