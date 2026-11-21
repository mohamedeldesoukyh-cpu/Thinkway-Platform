/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS interop for the PostCSS worker and its verification helpers. */
const path = require('node:path');
// Turbopack copies custom PostCSS plugins into .next/build/assets. Resolve the
// helper from the project working directory rather than that generated location.
const { uiSources } = require(path.resolve('scripts/lib/ui-source-graph.cjs'));

module.exports = () => ({
  postcssPlugin: 'thinkway-runtime-sources',
  Once(root, { result, postcss }) {
    if (process.env.NODE_ENV !== 'production' || path.basename(root.source?.input.file || '') !== 'globals.css') return;
    const base = path.dirname(root.source.input.file);
    const files = uiSources(path.dirname(base));
    root.walkAtRules('source', (rule) => rule.remove());
    for (const file of files) {
      root.append(postcss.atRule({ name: 'source', params: JSON.stringify(path.relative(base, file).replaceAll('\\', '/')) }));
      result.messages.push({ type: 'dependency', plugin: 'thinkway-runtime-sources', file, parent: root.source.input.file });
    }
  },
});
module.exports.postcss = true;

