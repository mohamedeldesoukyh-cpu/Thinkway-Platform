/**
 * Extract frozen discovery.css from docs/architecture/discovery.html.
 * Uses PostCSS to scope every selector under .discovery-suite.
 */
import fs from "node:fs";
import postcss from "postcss";

const html = fs.readFileSync("docs/architecture/discovery.html", "utf8");
const start = html.indexOf("<style>");
const end = html.indexOf("</style>");
if (start < 0 || end < 0) {
  console.error("No <style> block");
  process.exit(1);
}

let css = html.slice(start + 7, end).trim();

// Drop universal reset — host app owns box-sizing
css = css.replace(/\*,\*::before,\*::after\{[^}]*\}/g, "");

const SCOPE = ".discovery-suite";

function scopeSelector(selector) {
  return selector
    .split(",")
    .map((part) => {
      const s = part.trim();
      if (!s) return s;
      if (s === ":root" || s === "body") return SCOPE;
      if (s.startsWith(SCOPE)) return s;
      // :root.foo / body.foo unlikely
      if (s.startsWith(":root")) return s.replace(":root", SCOPE);
      if (s.startsWith("body")) return `${SCOPE}${s.slice(4)}`;
      return `${SCOPE} ${s}`;
    })
    .join(", ");
}

const result = postcss([
  {
    postcssPlugin: "scope-discovery",
    Rule(rule) {
      // Skip keyframe children
      if (rule.parent?.type === "atrule" && rule.parent.name?.includes("keyframes")) {
        return;
      }
      rule.selector = scopeSelector(rule.selector);
    },
  },
]).process(css, { from: undefined }).css;

const out = `/* Discovery foundation CSS — FROZEN after Session 0.
 * Spec: docs/architecture/discovery-specs/00-FOUNDATION.md
 * Source: docs/architecture/discovery.html
 * READ-ONLY after freeze. Missing .tw-* class → reopen Session 0; never page-level overrides.
 */

${result}
`;

fs.writeFileSync("app/styles/discovery.css", out);
console.log("Wrote app/styles/discovery.css", fs.statSync("app/styles/discovery.css").size);
