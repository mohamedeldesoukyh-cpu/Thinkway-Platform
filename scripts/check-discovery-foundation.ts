/**
 * Session 0 §0.12 foundation acceptance — mechanical checks.
 * Spec: docs/architecture/discovery-specs/00-FOUNDATION.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertClassCoverage,
  foundationTwClasses,
} from "../lib/discovery/suite/class-coverage";
import { AB, D, E, F, ini, pf } from "../lib/discovery/suite/helpers";
import { createBindScrollGuard } from "../lib/discovery/suite/bind-scroll";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = path.join(ROOT, "app/styles/discovery.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

const EXPECTED_TOKENS: Record<string, string> = {
  "--tw-blue": "#0057FF",
  "--tw-b2": "#1A6FFF",
  "--tw-bi": "#0B52E0",
  "--tw-bdk": "#0040CC",
  "--tw-navy": "#060810",
  "--tw-ink": "#0B0F1A",
  "--tw-ink2": "#41495A",
  "--tw-mut": "#64748B",
  "--tw-line": "#E2E8F0",
  "--tw-hair": "#EDF0F5",
  "--tw-bg": "#FAFBFC",
  "--tw-soft": "#F6F8FB",
  "--tw-lav": "#EFF4FF",
  "--tw-ok": "#0A7A55",
  "--tw-okb": "#E9F7F1",
  "--tw-wrn": "#8A5D12",
  "--tw-wrnb": "#FFF6E8",
  "--tw-bad": "#C82121",
  "--tw-badb": "#FEF2F2",
  "--tw-vio": "#5B3FD1",
  "--tw-viob": "#F1EDFE",
};

function checkTokens() {
  assert.equal(Object.keys(EXPECTED_TOKENS).length, 21, "exactly 21 tokens");
  for (const [key, value] of Object.entries(EXPECTED_TOKENS)) {
    const re = new RegExp(`${key.replace(/-/g, "\\-")}\\s*:\\s*([^;]+)`);
    const m = css.match(re);
    assert.ok(m, `missing token ${key}`);
    assert.equal(m![1]!.trim(), value, `token ${key} value`);
  }
}

/**
 * Bare HTML element selectors (00-FOUNDATION: no bare th/td/table/input/button/a).
 * Modifier classes (.p-n, .tip) are allowed; element tags must sit under `.tw-*`.
 */
async function checkBareSelectors() {
  const postcss = (await import("postcss")).default;
  const root = postcss.parse(css);
  const bare: string[] = [];
  const elementRe =
    /(^|[\s>+~])(a|button|input|table|th|td|tr|thead|tbody|svg|select|textarea|label|form|ul|ol|li|h1|h2|h3|p|span|div|em|i|b|strong)(?=[\s.:>#[+]|$)/i;
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && String(rule.parent.name).includes("keyframes")) {
      return;
    }
    for (const part of rule.selector.split(",")) {
      const p = part.trim();
      if (!p || !elementRe.test(p)) continue;
      // Allowed when the compound/descendant includes a .tw- class
      if (p.includes(".tw-")) continue;
      // Host-only typography on .discovery-suite is fine (no element)
      if (p === ".discovery-suite") continue;
      bare.push(p);
    }
  });
  assert.equal(
    bare.length,
    0,
    `bare element selectors (expect 0):\n${bare.slice(0, 20).join("\n")}`
  );
}

/**
 * Four numeric type steps on .tw-v / masthead / panel / micro.
 * Pack: exactly 20px, 14px, 12.5px, 11.5px for those steps — other chrome sizes exist in HTML.
 * We assert the four required sizes are present (not that they are the only px in the sheet).
 */
function checkNumericSteps() {
  for (const size of ["20px", "14px", "12.5px", "11.5px"]) {
    assert.ok(css.includes(size), `required numeric step ${size}`);
  }
}

function checkSvgRules() {
  const svgRules = [...css.matchAll(/([^{}]*svg[^{]*)\{([^}]*)\}/gi)];
  assert.ok(svgRules.length > 0, "expected svg rules");
  const bad: string[] = [];
  for (const [, sel, body] of svgRules) {
    const s = sel!.trim();
    // Pseudo-state follow-ups (transform only) inherit sizing from base svg rule
    if (/:(hover|focus|active|focus-visible)/.test(s) && !/width\s*:/.test(body!)) {
      continue;
    }
    const hasW = /width\s*:/.test(body!);
    const hasH = /height\s*:/.test(body!);
    const hasF = /fill\s*:/.test(body!);
    if (!(hasW && hasH && hasF)) {
      bad.push(`${s.slice(0, 100)} w=${hasW} h=${hasH} fill=${hasF}`);
    }
  }
  assert.equal(bad.length, 0, `svg rules missing width/height/fill:\n${bad.join("\n")}`);
}

function checkD() {
  const expect = "22 Aug 26";
  assert.equal(D("2026-08-22"), expect, "ISO");
  assert.equal(D(new Date(2026, 7, 22)), expect, "Date");
  assert.equal(D(new Date(2026, 7, 22).getTime()), expect, "epoch ms");
  assert.equal(D("22/08/2026"), expect, "DD/MM/YYYY");
  assert.equal(D("Aug 22, 2026"), expect, "Mon D, YYYY");
}

function checkHelpers() {
  assert.equal(F(1045000), "1,045,000");
  assert.equal(F(null), "—");
  assert.equal(AB(183900), "183.9K");
  assert.equal(AB(1_200_000), "1.2M");
  assert.equal(E('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
  assert.equal(ini("Karim Kabbany"), "KK");
  assert.ok(pf("ig,tt").includes('class="ig"'));
  assert.ok(pf("ig,tt").includes("IG"));
}

function checkBindScroll() {
  const listeners: unknown[] = [];
  const fakeWin = {
    addEventListener(type: string, fn: unknown) {
      if (type === "scroll") listeners.push(fn);
    },
    removeEventListener() {},
    scrollY: 0,
  };
  const bind = createBindScrollGuard(fakeWin as unknown as Window);
  for (let i = 0; i < 50; i++) bind(() => {});
  assert.equal(listeners.length, 1, "single scroll listener after 50 bind calls");
}

function checkClassCoverage() {
  const sample = `<div class="tw-g"><div class="tw-hd"></div><div class="tw-r sel"><span class="tw-v">1</span></div></div>`;
  const ok = assertClassCoverage(sample, css);
  assert.ok(ok.ok, `missing classes: ${ok.missing.join(", ")}`);
  const missingSample = `<button class="tw-does-not-exist-xyz">x</button>`;
  const bad = assertClassCoverage(missingSample, css);
  assert.ok(!bad.ok && bad.missing.includes("tw-does-not-exist-xyz"));
  assert.ok(foundationTwClasses(css).has("tw-g"));
}

function checkForbiddenGlobalNames() {
  // Helpers must not export these names (shadow document.open etc.)
  const forbidden = ["open", "close", "print", "focus", "name", "stop"];
  const helpersSrc = fs.readFileSync(
    path.join(ROOT, "lib/discovery/suite/helpers.ts"),
    "utf8"
  );
  for (const name of forbidden) {
    const re = new RegExp(`export\\s+(function|const|let|var)\\s+${name}\\b`);
    assert.ok(!re.test(helpersSrc), `helpers must not export ${name}`);
  }
}

function checkFontsViaNextNotImport() {
  assert.ok(!/@import\s+url\(.*fonts\.googleapis/.test(css), "no @import fonts in CSS");
  const layout = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
  assert.ok(/Geist/.test(layout), "Geist loaded via Next font in app layout");
}

function checkLayoutWired() {
  const discoveryLayout = fs.readFileSync(
    path.join(ROOT, "app/(dashboard)/discovery/layout.tsx"),
    "utf8"
  );
  assert.ok(
    discoveryLayout.includes('import "@/app/styles/discovery.css"'),
    "discovery layout imports frozen discovery.css"
  );
  assert.ok(
    discoveryLayout.includes("discovery-suite"),
    "discovery-suite scope wrapper present"
  );
}

async function main() {
  console.log("§0.12 foundation checks…");
  checkTokens();
  await checkBareSelectors();
  checkNumericSteps();
  checkSvgRules();
  checkD();
  checkHelpers();
  checkBindScroll();
  checkClassCoverage();
  checkForbiddenGlobalNames();
  checkFontsViaNextNotImport();
  checkLayoutWired();
  console.log("OK — Session 0 foundation acceptance passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
