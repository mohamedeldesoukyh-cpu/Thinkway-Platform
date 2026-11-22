/* eslint-disable @typescript-eslint/no-require-imports -- CI verification script. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const postcss = require('postcss');
const { uiSources } = require('./lib/ui-source-graph.cjs');
const retired = require('./tests/release-css-retirements.json');
const cache = new Map();

function vocabulary(entries) {
  const key = JSON.stringify(entries);
  if (cache.has(key)) return cache.get(key);
  const strings = [];
  for (const file of uiSources(process.cwd(), entries)) {
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) { strings.push(text); continue; }
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) strings.push(node.text);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const text = strings.join('\n');
  const value = {
    words: new Set(text.match(/[a-zA-Z_][\w-]*/g)),
    // As in the existing retired-style guard, platform-${displayPlatform}
    // is a publication React key, not a dynamic CSS class.
    prefixes: [...text.matchAll(/([a-zA-Z_][\w-]*-)(?=\n|$)/g)].map(m => m[1]).filter(p => p !== 'platform-'),
    text,
  };
  cache.set(key, value);
  return value;
}

for (const item of retired.classes) {
  const { words, prefixes } = vocabulary(item.entries);
  for (const name of item.classes) assert.ok(!words.has(name) && !prefixes.some(p => name.startsWith(p)), `Restore ${name} in ${item.file}: a rendering source now uses it.`);
}

// The narrower review vocabulary is valid only while this sheet belongs to
// the Client Workspace route tree. A new importer requires a new scope audit.
const sources = execFileSync('git', ['ls-files', 'app', 'features', 'components'], { encoding: 'utf8' }).trim().split('\n');
const importers = sources.filter(f => /\.[jt]sx?$/.test(f) && fs.readFileSync(f, 'utf8').includes('import "@/features/client-workspace/styles/client-review-ref.css"'));
assert.deepEqual(importers, ['app/(client-workspace)/layout.tsx']);

const cssFiles = sources.filter(f => f.endsWith('.css'));
let animationValues = '';
for (const file of cssFiles) postcss.parse(fs.readFileSync(file, 'utf8')).walkDecls(d => {
  if (/^(?:-webkit-)?animation(?:-name)?$/.test(d.prop)) animationValues += '\n' + d.value;
});
const runtime = vocabulary(['app']).text;
for (const name of retired.animations) {
  const re = new RegExp(`(?<![\\w-])${name}(?![\\w-])`);
  assert.ok(!re.test(animationValues) && !re.test(runtime), `Restore the ${name} animation before using it again.`);
}
console.log(`Verified ${retired.classes.reduce((n, r) => n + r.classes.length, 0)} retired scoped classes and ${retired.animations.length} unused animations.`);
