/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS interop for the PostCSS worker and its verification helpers. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** Rendering inputs for Tailwind and the retired-style guard, including RSC JSX.
 * Actions and server-only .ts services do not render the application's stylesheet.
 * Keep all application entry components and follow static imports/re-exports/lazy imports.
 */
function uiSources(root, entries = ['app']) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error('Cannot read tsconfig for the UI style graph');
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  const cache = ts.createModuleResolutionCache(root, (file) => file, options);
  const seen = new Set();
  const sources = [];

  function visit(file) {
    file = path.resolve(file);
    if (seen.has(file) || file.includes(path.sep + 'node_modules' + path.sep) || !fs.existsSync(file)) return;
    seen.add(file);
    if (!/\.[jt]sx?$|\.json$/.test(file) || file.endsWith('.d.ts')) return;
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) { sources.push(file); return; }
    if (!file.endsWith('x') && (/^['"]use server['"];?/m.test(text) || /import\s+['"]server-only['"]/.test(text))) return;
    sources.push(file);
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function inspect(node) {
      let specifier;
      if (ts.isImportDeclaration(node)) {
        if (node.importClause?.isTypeOnly) return;
        specifier = node.moduleSpecifier;
      } else if (ts.isExportDeclaration(node)) {
        if (node.isTypeOnly) return;
        specifier = node.moduleSpecifier;
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        specifier = node.moduleReference.expression;
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require')) {
        specifier = node.arguments[0];
        if (specifier && !ts.isStringLiteral(specifier)) {
          throw new Error(`Review non-literal UI import before pruning styles: ${file}`);
        }
      }
      if (specifier && ts.isStringLiteral(specifier)) {
        const resolved = ts.resolveModuleName(specifier.text, file, options, ts.sys, cache).resolvedModule;
        if (resolved) visit(resolved.resolvedFileName);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(ast);
  }

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'api') walk(file); }
      else if (/\.(tsx|jsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) visit(file);
    }
  }
  for (const entry of entries) {
    const file = path.join(root, entry);
    if (fs.statSync(file).isDirectory()) walk(file);
    else visit(file);
  }
  return sources.sort();
}
module.exports = { uiSources };

