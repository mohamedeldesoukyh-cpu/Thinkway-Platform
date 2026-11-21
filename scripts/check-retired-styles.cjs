/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS interop for the PostCSS worker and its verification helpers. */
const assert=require('node:assert/strict');const fs=require('node:fs');const {uiSources}=require('./lib/ui-source-graph.cjs');
const sources=uiSources(process.cwd());const text=sources.map(f=>fs.readFileSync(f,'utf8')).join('\n');const tokens=new Set(text.match(/[a-zA-Z_][\w-]*/g));
// "platform-${displayPlatform}" is a publication React key, not a CSS class.
const prefixes=[...text.matchAll(/([a-zA-Z_][\w-]*-)\$\{/g)].map(m=>m[1]).filter(p=>p!=='platform-');
let count=0;for(const {file,absentClasses}of JSON.parse(fs.readFileSync('scripts/tests/retired-style-classes.json'))){for(const name of absentClasses){assert.ok(!tokens.has(name)&&!prefixes.some(p=>name.startsWith(p)),`Restore ${name} in ${file}: a live source now needs the retired style.`);count++;}}
console.log(`Verified ${count} retired style classes remain absent from ${sources.length} rendering sources.`);

