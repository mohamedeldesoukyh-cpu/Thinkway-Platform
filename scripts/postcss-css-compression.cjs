/* eslint-disable @typescript-eslint/no-require-imports -- PostCSS worker uses CommonJS plugins. */
const csso = require('postcss-csso');

// CSSO's parser predates native nesting. Next's Lightning CSS minifier handles
// nested sheets; retain CSSO's structural compression for ordinary stylesheets.
module.exports = () => ({
  postcssPlugin: 'thinkway-css-compression',
  OnceExit(root, helpers) {
    let nested = false;
    root.walkRules(rule => { if (rule.parent?.type === 'rule') nested = true; });
    if (!nested) csso().OnceExit(root, helpers);
  },
});
module.exports.postcss = true;
