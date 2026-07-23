/**
 * Summarize CSS asset sizes after `npm run build`.
 * Usage: node scripts/measure-css-bundle.mjs
 */
import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

function kb(n) {
  return Math.round((n / 1024) * 10) / 10;
}

const sources = [
  "app/globals.css",
  "app/thinkway-design-tokens.css",
  "app/thinkway-dropdown.css",
  "app/styles/chrome-logo.css",
  "app/thinkway-platform-v6.css",
  "app/styles/campaign-workspace.css",
  "app/styles/login-v2.css",
  "app/quotation-redesign.css",
  "features/campaign-studio/styles/campaign-studio-ref.css",
  "features/campaign-outputs/styles/outputs-center-ref.css",
  "features/ai-workspace/styles/studio-chat-ref.css",
  "features/ai-workspace/styles/copilot-ref.css",
  "features/ai-workspace/components/ai-workspace.css",
];

const sourceSizes = sources
  .filter((f) => fs.existsSync(f))
  .map((f) => ({ file: f, kb: kb(fs.statSync(f).size) }));

const built = walk(path.join(".next", "static"))
  .map((f) => ({
    file: path.relative(process.cwd(), f).replaceAll("\\", "/"),
    bytes: fs.statSync(f).size,
    kb: kb(fs.statSync(f).size),
  }))
  .sort((a, b) => b.bytes - a.bytes);

const totalBuilt = built.reduce((n, f) => n + f.bytes, 0);

console.log(
  JSON.stringify(
    {
      sourceCss: {
        files: sourceSizes,
        rootGlobalChainKb: sourceSizes
          .filter((f) =>
            [
              "app/globals.css",
              "app/thinkway-design-tokens.css",
              "app/thinkway-dropdown.css",
              "app/styles/chrome-logo.css",
            ].includes(f.file)
          )
          .reduce((n, f) => n + f.kb, 0),
        dashboardScopedKb: sourceSizes
          .filter((f) =>
            ["app/thinkway-platform-v6.css", "app/styles/campaign-workspace.css"].includes(
              f.file
            )
          )
          .reduce((n, f) => n + f.kb, 0),
        loginScopedKb: sourceSizes.find((f) => f.file.includes("login-v2"))?.kb ?? 0,
      },
      builtCss: {
        fileCount: built.length,
        totalKb: kb(totalBuilt),
        largest: built.slice(0, 10),
      },
      notes: [
        "Root globals no longer import platform-v6 or campaign-workspace.",
        "Login loads login-v2.css via app/login/layout.tsx.",
        "Dashboard loads platform-v6 + campaign-workspace via app/(dashboard)/layout.tsx.",
        "Studio/AI/Outputs feature CSS remain component-imported (unchanged).",
      ],
    },
    null,
    2
  )
);
