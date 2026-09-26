const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const file = path.join(root,'features/campaigns/components/deliverables/deliverables-panel.tsx');
const source = fs.readFileSync(file,'utf8');
const model = fs.readFileSync(path.join(root,'features/campaigns/deliverables-panel-model.ts'),'utf8');
const cols = model.match(/DELIVERABLE_COLUMNS\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(cols);
assert.equal((cols.match(/minmax\([^)]*\)|\b\d+px\b/g)||[]).length,8);
const tree = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const blocks=[];
function visit(node) {
  if(ts.isJsxElement(node)){
    const cls=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='className');
    if(cls?.initializer?.getText(tree).includes('tw-g tw-')){
      const children=node.children.filter(c=>ts.isJsxElement(c)||ts.isJsxSelfClosingElement(c));
      const tracks=children.reduce((total,c)=>total+Number(c.getText(tree).match(/gridColumn\s*:\s*['"]span (\d+)/)?.[1]??1),0);
      assert.equal(tracks,8,`Grid at line ${tree.getLineAndCharacterOfPosition(node.pos).line+1}`);
      blocks.push(children.length);
      if(cls.initializer.getText(tree).includes('tw-hr')) assert.match(children.at(-1).getText(tree),/^<span>\s*<\/span>$/);
    }
  }
  ts.forEachChild(node,visit);
}
visit(tree);
assert.deepEqual(blocks,[8,8,8],'Header, repeated row, footer must each provide all eight cells');
assert.equal((source.match(/['"]--cols['"]\s*:/g)||[]).length,1,'One inherited --cols declaration');
const fixture=fs.readFileSync(path.join(root,'tests/fixtures/deliverables-grid.html'),'utf8');
const stack=[];const grids=[];
for(const match of fixture.matchAll(/<\/?([\w-]+)\b([^>]*)>/g)){
  const [tag,name,attrs]=match;
  if(tag.startsWith('</')){stack.pop();continue;}
  const parent=stack.at(-1);
  if(parent?.grid)parent.grid.children+=Number(attrs.match(/grid-column\s*:\s*span\s+(\d+)/)?.[1]??1);
  const grid=/class="[^"]*\btw-g\b/.test(attrs)?{children:0,cols:attrs.match(/--cols:([^"]+)/)?.[1]}:null;
  if(grid)grids.push(grid);
  if(!['input','br','hr','img','meta','link'].includes(name))stack.push({grid});
}
assert.equal(grids.length,8);grids.forEach(g=>assert.equal(g.children,8));
assert.equal(new Set(grids.map(g=>g.cols)).size,1);
assert.equal(grids[0].cols,cols,'Implementation must preserve the fragment column tracks');
console.log('PASS fixture: 8 blocks × 8 children; one shared --cols value (span-aware).');
console.log('PASS implementation: header + N rows + footer × 8 cells; one inherited --cols declaration.');
