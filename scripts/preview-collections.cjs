const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tmp/collections-preview');
fs.mkdirSync(out, { recursive: true });
const data = {
  asOf: '2026-09-24T12:00:00Z', warnings: [], contacts: {}, receipts: [],
  paymentHistory: [{id:'payment-1',document_number:'PAY-TEST',invoice_id:'invoice-1',client_id:'client-1',amount:100,currency:'EGP',paid_at:'2026-09-01',payment_method:'bank_transfer',reference_number:null,notes:null,status:'completed',revision:0}],
  clients: Array.from({length: Number(process.env.COLLECTIONS_PREVIEW_CLIENTS || 5)}, (_, i) => ({ id: 'client-'+(i+1), document_number: 'CLI-00'+(i+1), name: ['Wavemaker','Mind Share Egypt LTD','Bundle Plus Communication','Essencemediacom','OMG'][i] || 'Test client '+(i+1) })),
  invoices: [{ id: 'invoice-1', document_number: 'INV-2026-2', client_id: 'client-1', client_name: 'Wavemaker', campaign_name: 'Wavemaker x NBK Bank: Summer Influencers Campaign', currency: 'EGP', total: 1007095.95, amount_paid: 0, outstanding: 1007095.95, issue_date: '2026-07-12', due_date: '2026-07-26', status: 'issued', collection_status: 'pending', aging_bucket: '31_60', days_past_due: 60 }],
};
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CollectionsRedesign} from './features/collections/components/collections-redesign'; createRoot(document.getElementById('root')).render(<CollectionsRedesign data={${JSON.stringify(data)}}/>);`;
const mocks = {
  'next/link': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
  'next/navigation': `import {useState,useEffect} from 'react';export function useRouter(){return {refresh(){location.reload()}}} export function useSearchParams(){const [search,setSearch]=useState(location.search);useEffect(()=>{const fn=()=>setSearch(location.search);addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)},[]);return ReactParams(search)} const cache=new Map();function ReactParams(s){if(!cache.has(s))cache.set(s,new URLSearchParams(s));return cache.get(s)}`,
  '@/features/collections/actions': `export async function recordCollectionPaymentFromWorkspaceAction(){document.body.dataset.previewCreates=String(Number(document.body.dataset.previewCreates||0)+1);await new Promise(r=>setTimeout(r,700));return {ok:false,error:'Preview only: no payment was recorded.'}}`,
  '@/features/collections/redesign-actions': `export async function saveCollectionFollowUp(){return {ok:false,error:'Preview only: no history was saved.'}} export async function deleteCollectionPayment(){document.body.dataset.previewDeletes=String(Number(document.body.dataset.previewDeletes||0)+1);return {ok:false,error:'Preview only'}} export async function reviseCollectionPayment(){document.body.dataset.previewEdits=String(Number(document.body.dataset.previewEdits||0)+1);return {ok:false,error:'Preview only: no payment changed.'}}`,
};
(async () => {
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: path.join(out, 'app.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'preview-stubs', setup(build) {
    build.onResolve({ filter: /.*/ }, args => args.path === '../redesign-actions' ? {path:'@/features/collections/redesign-actions',namespace:'mock'} : mocks[args.path] ? { path: args.path, namespace: 'mock' } : args.path.startsWith('@/') ? { path: ['.tsx','.ts','/index.tsx','/index.ts'].map(ext=>path.join(root,args.path.slice(2)+ext)).find(f=>fs.existsSync(f)) } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
  }}] });
  const css = ['app/styles/finance-suite.css', 'app/styles/collections-platform-shared.css', 'app/styles/collections-fragment.css'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  fs.writeFileSync(path.join(out, 'styles.css'), css);
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>body{margin:0;background:#FAFBFC}#root{padding:18px 22px;box-sizing:border-box}button,select,input{font:inherit}button{cursor:pointer}h1,p{margin:0}*{box-sizing:border-box}a{text-decoration:none}section[hidden]{display:none}</style></head><body><div id="root" class="finance-suite"></div><script src="/app.js"></script></body></html>`);
  fs.copyFileSync(path.join(root, 'docs/validation-artifacts/collections-redesign/collections-fragment.html'), path.join(out, 'fragment.html'));
  if (process.argv[2]) fs.copyFileSync(process.argv[2], path.join(out, 'reference.html'));
  if (process.env.COLLECTIONS_PREVIEW_BUILD_ONLY === '1') return;
  http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(out, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!file.startsWith(out + path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'text/html');
    res.end(fs.readFileSync(file));
  }).listen(4178, '127.0.0.1', () => console.log('Collections preview: http://127.0.0.1:4178'));
})();
