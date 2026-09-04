/**
 * Foundation §0.12 class-coverage: every class="tw-…" in HTML must have a rule in discovery.css.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CSS_PATH = path.join(ROOT, "app/styles/discovery.css");

export function loadDiscoveryFoundationCss(): string {
  return fs.readFileSync(CSS_PATH, "utf8");
}

/** Collect selector class tokens that appear as .tw-* in the foundation sheet. */
export function foundationTwClasses(css: string = loadDiscoveryFoundationCss()): Set<string> {
  const set = new Set<string>();
  const re = /\.tw-([a-z0-9_-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    set.add(`tw-${m[1]}`);
  }
  return set;
}

/** class="…" attribute tokens that start with tw- */
export function twClassesInHtml(html: string): Set<string> {
  const set = new Set<string>();
  const attrRe = /class\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html))) {
    for (const token of m[1].split(/\s+/)) {
      if (token.startsWith("tw-")) set.add(token);
    }
  }
  return set;
}

export type ClassCoverageResult = {
  ok: boolean;
  missing: string[];
  used: string[];
};

export function assertClassCoverage(
  html: string,
  css: string = loadDiscoveryFoundationCss()
): ClassCoverageResult {
  const foundation = foundationTwClasses(css);
  const used = [...twClassesInHtml(html)].sort();
  const missing = used.filter((c) => {
    // Allow compound like tw-p used with p-g — base tw-p must exist
    const base = c.split("--")[0]!;
    if (foundation.has(c) || foundation.has(base)) return false;
    // Modifier-only tokens (p-g) are not tw- prefixed in pack; ignore non-tw
    return true;
  });
  return { ok: missing.length === 0, missing, used };
}
