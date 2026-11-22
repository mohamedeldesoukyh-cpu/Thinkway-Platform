/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS interop for the PostCSS worker and its verification helpers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { uiSources } = require('./lib/ui-source-graph.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thinkway-style-graph-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  write('tsconfig.json', JSON.stringify({ compilerOptions: { moduleResolution: 'bundler', module: 'esnext', jsx: 'preserve', resolveJsonModule: true } }));
  return { root, write, read: () => uiSources(root).map(file => path.relative(root, file).replaceAll('\\', '/')) };
}

test('keeps server-rendered markup, client hooks, lazy UI and JSON class maps; excludes disconnected UI and actions', t => {
  const { write, read } = fixture(t);
  write('app/page.tsx', 'import Screen from "../features/screen"; import { save } from "../features/actions"; export default Screen;');
  write('app/global-error.tsx', 'export default function Error(){ return <div className="error-shell"/> }');
  write('features/screen.tsx', 'import "server-only"; import Client from "./client"; export default function Screen(){return <Client/>}');
  write('features/client.tsx', '"use client"; import { useSomething } from "./hook"; const Lazy=()=>import("./lazy");');
  write('features/hook.ts', 'import styles from "./styles.json"; export const useSomething=()=>styles;');
  write('features/styles.json', '{"active":"bg-blue-600"}');
  write('features/lazy.tsx', 'export default function Lazy(){return <div className="lazy-panel"/>}');
  write('features/actions.ts', '"use server"; import "./export-template"; export async function save(){}');
  write('features/export-template.ts', 'export const html="server-export-only";');
  write('features/old-screen.tsx', 'export default function Old(){return <div className="retired"/>}');
  assert.deepEqual(read(), ['app/global-error.tsx','app/page.tsx','features/client.tsx','features/hook.ts','features/lazy.tsx','features/screen.tsx','features/styles.json']);
  write('features/client.tsx', '"use client"; import "./old-screen";');
  assert.ok(read().includes('features/old-screen.tsx'), 'a newly connected screen must be scanned on the next build');
});

test('rejects an unresolved dynamic module path instead of silently omitting its styles', t => {
  const { write, read } = fixture(t);
  write('app/page.tsx', 'const load=(name:string)=>import(name);');
  assert.throws(read, /non-literal UI import/);
});

