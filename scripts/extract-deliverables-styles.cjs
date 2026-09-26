// Explicit temporary dependency copy; never reads the standalone preview.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const input = process.argv[2];
if (!input) throw new Error('Pass the updated deliverables-fragment.html path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/styles/vendor-detail-suite.css'), 'utf8');
const fragment = fs.readFileSync(input, 'utf8');
const roots = new Set('tw-av tw-b tw-c tw-ch tw-ck tw-cr tw-cs tw-ct tw-ft tw-g tw-hint tw-in tw-lbl tw-miss tw-ms2 tw-p tw-sc tw-selbar tw-sp tw-t tw-pf tw-hr tw-r tw-seg p-n p-y p-b p-g'.split(' '));
const tree = postcss.parse(source);
const out = postcss.root();
tree.walkRules(rule => {
  if (rule.parent.type !== 'root') return;
  const selectors = rule.selectors.filter(selector => {
    const match = selector.match(/^\.vendor-detail-suite\s+\.([\w-]+)/);
    return match && roots.has(match[1]);
  });
  if (!selectors.length) return;
  out.append(postcss.comment({text:'DUPLICATED from vendor-detail-suite.css; consolidate into a shared campaign sheet'}));
  out.append(rule.clone({selector:selectors.map(s => s.replace(/^\.vendor-detail-suite\s+/, '.dv ').replace(/^\.dv \.tw-c$/, '.dv.tw-c')).join(',\n')}));
});
const tokens = tree.nodes.find(n => n.type === 'rule' && n.selector === '.vendor-detail-suite');
const tokenRule = tokens.clone({selector:'.dv'});
tokenRule.nodes = tokenRule.nodes.filter(n => n.type === 'decl' && (n.prop.startsWith('--') || ['color','font','-webkit-font-smoothing'].includes(n.prop)));
out.prepend(tokenRule);
out.prepend(postcss.comment({text:'DUPLICATED from vendor-detail-suite.css; consolidate into a shared campaign sheet'}));
const additions = fragment.match(/<style>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync(path.join(root,'app/styles/deliverables-suite.css'), '/* Deliverables-only stopgap. Regenerate dependencies with scripts/extract-deliverables-styles.cjs. */\n'+out.toString()+'\n'+additions+'\n');
console.log('Copied dependency roots:', [...roots].join(' '));
