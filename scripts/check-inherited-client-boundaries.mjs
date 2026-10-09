import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

// These UI children inherit their client environment from their entry points.
// Catch a new server importer before it accidentally moves hooks into the server.
const root = process.cwd();
const normalize = (file) => path.resolve(file).replaceAll("\\", "/").toLowerCase();
const manifest = JSON.parse(fs.readFileSync("scripts/inherited-client-boundaries.json", "utf8"));
const targets = new Map(manifest.map(({ file }) => [normalize(file), file]));
const options = ts.parseJsonConfigFileContent(
  ts.readConfigFile("tsconfig.json", ts.sys.readFile).config, ts.sys, root,
).options;
const cache = ts.createModuleResolutionCache(root, (file) => file, options);
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n")
  .filter((file) => /^(app|features|components|hooks|lib)\/.+\.[jt]sx?$/.test(file)
    && !file.includes(".test.") && fs.existsSync(file));
const failures = [];
const imported = new Set();
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const client = source.statements.some((statement) => ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client");
  function visit(node) {
    let specifier;
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) return;
      specifier = node.moduleSpecifier;
    } else if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) return;
      specifier = node.moduleSpecifier;
    } else if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) {
      specifier = node.arguments[0];
    }
    if (specifier && ts.isStringLiteral(specifier)) {
      const resolved = ts.resolveModuleName(specifier.text, path.resolve(file), options, ts.sys, cache).resolvedModule;
      const child = resolved && targets.get(normalize(resolved.resolvedFileName));
      if (child) {
        imported.add(child);
        if (!client) failures.push(`${file} imports ${child} without a client boundary`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
for (const file of targets.values()) {
  if (!fs.existsSync(file)) failures.push(`Remove missing file from boundary manifest: ${file}`);
  else if (!imported.has(file)) failures.push(`Review unused boundary manifest entry: ${file}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`Verified ${targets.size} inherited client boundaries.`);
