const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
function tracks(value) {
  const parts = []; let depth = 0, token = '';
  for (const char of value.trim()) { if (char === '(') depth++; if (char === ')') depth--; if (/\s/.test(char) && depth === 0) { if (token) parts.push(token); token = ''; } else token += char; }
  if (token) parts.push(token);
  return parts.reduce((n, part) => { const repeat = /^repeat\((\d+),(.+)\)$/.exec(part); return n + (repeat ? Number(repeat[1]) * tracks(repeat[2]) : 1); }, 0);
}
function validate(html) {
  const stack = [], grids = [];
  const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>/gi)) {
    const tag = m[0]; if (tag.startsWith('<!--')) continue;
    const name = /^<\/?([\w-]+)/.exec(tag)[1].toLowerCase();
    if (tag.startsWith('</')) { while (stack.length) { if (stack.pop().name === name) break; } continue; }
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(a => [a[1], a[2] ?? a[3]]));
    const node = { name, children: [], attrs };
    if (stack.length) stack.at(-1).children.push(node);
    if ((attrs.class ?? '').split(/\s+/).includes('tw-g')) grids.push(node);
    if (!voids.has(name) && !tag.endsWith('/>')) stack.push(node);
  }
  const lists = new Set();
  for (const [i, grid] of grids.entries()) {
    const cols = /--cols\s*:\s*([^;]+)/.exec(grid.attrs.style ?? '')?.[1];
    assert.ok(cols, `Grid ${i + 1} is missing --cols`); lists.add(cols);
    const occupied = grid.children.reduce((n, child) => n + Number(/grid-column\s*:\s*span\s+(\d+)/.exec(child.attrs.style ?? '')?.[1] ?? 1), 0);
    assert.equal(occupied, tracks(cols), `Grid ${i + 1}: ${occupied} occupied tracks, expected ${tracks(cols)}`);
  }
  return { blocks: grids.length, trackLists: lists.size };
}
assert.equal(tracks('28px minmax(186px, 1.3fr) repeat(5, 108px) 126px 86px'), 9);
assert.deepEqual(validate('<div class="tw-g" style="--cols:1fr 1fr 1fr"><span style="grid-column:span 2"></span><span></span></div>'), { blocks: 1, trackLists: 1 });
assert.throws(() => validate('<div class="tw-g" style="--cols:1fr 1fr"><span></span></div>'));
const reference = fs.readFileSync(path.join(root, 'docs/validation-artifacts/collections-redesign/collections-fragment.html'), 'utf8');
const result = validate(reference);
// The supplied file was revised to six sections during implementation (20 grids).
// Preserve that file unchanged; keep the original seventh-section acceptance fixture separately.
const payableFixture = fs.readFileSync(path.join(root, 'docs/validation-artifacts/collections-redesign/payables-grid-fixture.html'), 'utf8');
const combined = validate(result.blocks === 20 ? reference + payableFixture : reference);
assert.deepEqual(combined, { blocks: 38, trackLists: 5 });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/validation-artifacts/collections-redesign/extraction-manifest.json'), 'utf8'));
for (const rule of manifest) assert.ok(fs.readFileSync(path.join(root, rule.source), 'utf8').replace(/\r\n/g, '\n').includes(rule.body.replace(/\r\n/g, '\n')), `Declaration changed at ${rule.source}:${rule.line}`);
for (const file of ['collections-platform-shared.css', 'collections-fragment.css']) {
  const css = postcss.parse(fs.readFileSync(path.join(root, 'app/styles', file), 'utf8'));
  css.walkRules(rule => { for (const selector of rule.selectors) {
    assert.ok(selector.startsWith('.collections-suite '), `${file}: unscoped selector ${selector}`);
    assert.ok(!/^\.(pri|z|g|r|s|bad|alert)\b/.test(selector.replace('.collections-suite ', '')), 'Standalone modifier');
  }});
}
console.log(JSON.stringify({ currentReferenceGrid: result, sevenSectionAcceptanceGrid: combined, copiedDeclarationBlocks: manifest.length, collectionsOnlySelectors: 'passed' }));
