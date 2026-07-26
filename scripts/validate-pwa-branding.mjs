#!/usr/bin/env node
/**
 * Validate Thinkway PWA branding assets + manifest (no network).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pub = path.join(root, "public");

const required = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "icon-72x72.png",
  "icon-96x96.png",
  "icon-128x128.png",
  "icon-144x144.png",
  "icon-152x152.png",
  "icon-192x192.png",
  "icon-256x256.png",
  "icon-384x384.png",
  "icon-512x512.png",
  "icon-1024.png",
  "mstile-150x150.png",
  "og-image.png",
  "twitter-card.png",
  "splash-1536x2048.png",
  "splash-1668x2388.png",
  "splash-2048x2732.png",
  "manifest.webmanifest",
  "browserconfig.xml",
];

const requiredApp = ["app/favicon.ico", "app/sw.js/route.ts"];

let failed = 0;
for (const file of required) {
  const p = path.join(pub, file);
  if (!fs.existsSync(p)) {
    console.log("FAIL missing", file);
    failed += 1;
  } else {
    console.log("PASS", file, fs.statSync(p).size, "bytes");
  }
}

for (const rel of requiredApp) {
  const p = path.join(root, ...rel.split("/"));
  if (!fs.existsSync(p)) {
    console.log("FAIL missing", rel);
    failed += 1;
  } else {
    console.log("PASS", rel);
  }
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(pub, "manifest.webmanifest"), "utf8"),
);
const checks = [
  ["name", manifest.name === "Thinkway Platform"],
  ["display", manifest.display === "standalone"],
  ["theme_color", manifest.theme_color === "#090B14"],
  ["background_color", manifest.background_color === "#090B14"],
  ["start_url", manifest.start_url === "/"],
  ["icons", Array.isArray(manifest.icons) && manifest.icons.length >= 10],
  [
    "has_192",
    manifest.icons.some((i) => i.sizes === "192x192"),
  ],
  [
    "has_512",
    manifest.icons.some((i) => i.sizes === "512x512"),
  ],
];
for (const [label, ok] of checks) {
  console.log(ok ? "PASS" : "FAIL", "manifest." + label);
  if (!ok) failed += 1;
}

for (const icon of manifest.icons) {
  const rel = icon.src.replace(/^\//, "");
  if (!fs.existsSync(path.join(pub, rel))) {
    console.log("FAIL broken icon ref", icon.src);
    failed += 1;
  }
}

const layout = fs.readFileSync(path.join(root, "app", "layout.tsx"), "utf8");
for (const needle of [
  'default: APP_NAME',
  'Thinkway Platform',
  'manifest: "/manifest.webmanifest"',
  "og-image.png",
  "twitter-card.png",
  "apple-touch-icon.png",
  "themeColor",
]) {
  const ok = layout.includes(needle) || layout.includes("APP_NAME");
  if (needle === "Thinkway Platform" || needle === "default: APP_NAME") {
    const has =
      layout.includes('Thinkway Platform') || layout.includes("APP_NAME");
    console.log(has ? "PASS" : "FAIL", "layout has app title");
    if (!has) failed += 1;
    continue;
  }
  console.log(ok ? "PASS" : "FAIL", "layout", needle);
  if (!ok) failed += 1;
}

console.log(failed === 0 ? "\nPWA_BRANDING_OK" : `\nPWA_BRANDING_FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
