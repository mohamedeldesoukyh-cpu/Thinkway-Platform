/**
 * Summarize Next.js production client bundles after `npm run build`.
 *
 * Usage:
 *   npm run build
 *   npm run measure:frontend-bundle
 *
 * Optional analyzer HTML:
 *   npm run analyze
 */
import fs from "node:fs";
import path from "node:path";

const NEXT = path.join(process.cwd(), ".next");

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

function main() {
  if (!fs.existsSync(NEXT)) {
    console.error("Missing .next — run `npm run build` first.");
    process.exit(1);
  }

  const staticDir = path.join(NEXT, "static");
  const files = walk(staticDir).filter((f) => /\.(js|css)$/.test(f));
  const sized = files
    .map((file) => {
      const bytes = fs.statSync(file).size;
      return {
        file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
        bytes,
        kb: kb(bytes),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  const js = sized.filter((f) => f.file.endsWith(".js"));
  const css = sized.filter((f) => f.file.endsWith(".css"));
  const totalJs = js.reduce((n, f) => n + f.bytes, 0);
  const totalCss = css.reduce((n, f) => n + f.bytes, 0);
  const over100 = sized.filter((f) => f.bytes >= 100 * 1024);

  let appPaths = [];
  const appBuildManifest = path.join(NEXT, "app-build-manifest.json");
  if (fs.existsSync(appBuildManifest)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(appBuildManifest, "utf8"));
      const pages = manifest.pages ?? {};
      appPaths = Object.entries(pages)
        .map(([route, chunks]) => {
          const list = Array.isArray(chunks) ? chunks : [];
          let bytes = 0;
          for (const chunk of list) {
            const candidate = path.join(NEXT, chunk.replace(/^\//, ""));
            if (fs.existsSync(candidate)) bytes += fs.statSync(candidate).size;
          }
          return { route, chunkCount: list.length, approxKb: kb(bytes) };
        })
        .sort((a, b) => b.approxKb - a.approxKb)
        .slice(0, 30);
    } catch {
      /* ignore */
    }
  }

  console.log(
    JSON.stringify(
      {
        totals: {
          jsFiles: js.length,
          cssFiles: css.length,
          totalJsKb: kb(totalJs),
          totalCssKb: kb(totalCss),
          largestJsKb: js[0]?.kb ?? 0,
          largestCssKb: css[0]?.kb ?? 0,
          assetsOver100kb: over100.length,
        },
        largestJs: js.slice(0, 25),
        largestCss: css.slice(0, 10),
        over100kb: over100.slice(0, 40),
        largestAppRoutesApprox: appPaths,
        tips: [
          "For dependency treemap open the HTML from `npm run analyze`.",
          "Compare totalJsKb + largestJs before/after Phase 3.",
        ],
      },
      null,
      2
    )
  );
}

main();
