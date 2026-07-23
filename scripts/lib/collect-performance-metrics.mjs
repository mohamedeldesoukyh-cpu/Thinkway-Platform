import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const NEXT = path.join(ROOT, ".next");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

export function collectBundleMetrics() {
  if (!fs.existsSync(NEXT)) {
    throw new Error("Missing .next — run npm run build first.");
  }
  const files = walk(path.join(NEXT, "static")).filter((f) => /\.(js|css)$/.test(f));
  const sized = files
    .map((file) => {
      const bytes = fs.statSync(file).size;
      return {
        file: path.relative(ROOT, file).replaceAll("\\", "/"),
        bytes,
        kb: kb(bytes),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  const js = sized.filter((f) => f.file.endsWith(".js"));
  const css = sized.filter((f) => f.file.endsWith(".css"));
  return {
    largestJsKb: js[0]?.kb ?? 0,
    largestCssKb: css[0]?.kb ?? 0,
    totalJsKb: kb(js.reduce((n, f) => n + f.bytes, 0)),
    totalCssKb: kb(css.reduce((n, f) => n + f.bytes, 0)),
    assetsOver100kb: sized.filter((f) => f.bytes >= 100 * 1024).length,
    jsFileCount: js.length,
    cssFileCount: css.length,
    largestJs: js.slice(0, 10),
    largestCss: css.slice(0, 10),
  };
}

export function collectSourceCssMetrics() {
  const rootFiles = [
    "app/globals.css",
    "app/thinkway-design-tokens.css",
    "app/thinkway-dropdown.css",
    "app/styles/chrome-logo.css",
  ];
  let rootGlobalCssKb = 0;
  for (const file of rootFiles) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) rootGlobalCssKb += kb(fs.statSync(full).size);
  }
  return { rootGlobalCssKb: Math.round(rootGlobalCssKb * 10) / 10 };
}

export function collectClientModuleMetrics() {
  const result = spawnSync(process.execPath, ["scripts/audit-client-components.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      clientModuleCount: null,
      largestClientSourceKb: null,
      largestClientSourceFile: null,
      error: result.stderr || result.stdout || "audit failed",
    };
  }
  const jsonStart = result.stdout.indexOf("{");
  const payload = JSON.parse(result.stdout.slice(jsonStart));
  const top = payload.top40BySize?.[0];
  return {
    clientModuleCount: payload.totalClientModules,
    largestClientSourceKb: top?.kb ?? null,
    largestClientSourceFile: top?.file ?? null,
    summary: payload.summary,
  };
}

export function loadJson(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

export function collectAllMetrics() {
  const bundle = collectBundleMetrics();
  const sourceCss = collectSourceCssMetrics();
  const client = collectClientModuleMetrics();
  return {
    capturedAt: new Date().toISOString(),
    bundle,
    source: {
      ...sourceCss,
      clientModuleCount: client.clientModuleCount,
      largestClientSourceKb: client.largestClientSourceKb,
      largestClientSourceFile: client.largestClientSourceFile,
      clientSummary: client.summary,
    },
  };
}
