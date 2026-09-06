import fs from "node:fs";

const html = fs.readFileSync("tmp-preview/clients-detail.html", "utf8");
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) throw new Error("no style");
let css = m[1];

css = css.replace(
  /\*,\*::before,\*::after\{box-sizing:border-box;margin:0;padding:0\}/,
  "*,*::before,*::after{box-sizing:border-box}"
);
css = css.replace(/body\{[^}]+\}/, "");
css = css.replace(/:root\{/g, ".client-detail-suite{");

function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel) return sel;
  if (sel.startsWith("@")) return sel;
  if (sel.startsWith(".client-detail-suite")) return sel;
  return sel
    .split(",")
    .map((s) => {
      s = s.trim();
      if (!s) return s;
      if (s.startsWith(".client-detail-suite")) return s;
      if (s === "body" || s === "html") return ".client-detail-suite";
      if (s.startsWith(":")) return `.client-detail-suite${s}`;
      return `.client-detail-suite ${s}`;
    })
    .join(",");
}

function scopeBlock(body) {
  let inner = "";
  let k = 0;
  while (k < body.length) {
    if (/\s/.test(body[k])) {
      inner += body[k];
      k++;
      continue;
    }
    if (body.startsWith("/*", k)) {
      const end = body.indexOf("*/", k + 2);
      inner += body.slice(k, end + 2);
      k = end + 2;
      continue;
    }
    const o = body.indexOf("{", k);
    if (o < 0) {
      inner += body.slice(k);
      break;
    }
    const sel = body.slice(k, o);
    let d = 0;
    let p = o;
    for (; p < body.length; p++) {
      if (body[p] === "{") d++;
      else if (body[p] === "}") {
        d--;
        if (d === 0) {
          p++;
          break;
        }
      }
    }
    inner += scopeSelector(sel) + body.slice(o, p);
    k = p;
  }
  return inner;
}

const out = [];
let i = 0;
while (i < css.length) {
  if (/\s/.test(css[i])) {
    out.push(css[i]);
    i++;
    continue;
  }
  if (css.startsWith("/*", i)) {
    const end = css.indexOf("*/", i + 2);
    out.push(css.slice(i, end + 2));
    i = end + 2;
    continue;
  }
  if (
    css.startsWith("@keyframes", i) ||
    css.startsWith("@media", i) ||
    css.startsWith("@-webkit", i)
  ) {
    const open = css.indexOf("{", i);
    const header = css.slice(i, open);
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    const body = css.slice(open + 1, j - 1);
    if (header.includes("@keyframes")) {
      out.push(`${header}{${body}}`);
    } else {
      out.push(`${header}{${scopeBlock(body)}}`);
    }
    i = j;
    continue;
  }
  const open = css.indexOf("{", i);
  if (open < 0) {
    out.push(css.slice(i));
    break;
  }
  const sel = css.slice(i, open);
  let depth = 0;
  let j = open;
  for (; j < css.length; j++) {
    if (css[j] === "{") depth++;
    else if (css[j] === "}") {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  out.push(scopeSelector(sel) + css.slice(open, j));
  i = j;
}

const header = `/* Client / legal-entity suite.
 * Source: tmp-preview/clients-detail.html (list + workspace tabs).
 * Scoped to .client-detail-suite — do not edit frozen discovery.css.
 */

`;

const reactOverrides = `

/* ===== React shell integration (mirror vendor-detail-suite) ===== */
.client-detail-suite {
 display:flex;flex-direction:column;min-height:0;flex:1 1 auto;overflow:hidden;
 font:400 15px/1.5 var(--font-geist-sans), 'Geist', sans-serif;
 -webkit-font-smoothing:antialiased;
 background:var(--tw-bg);color:var(--tw-ink);
}
.client-detail-suite .tw-main{
  flex:1 1 auto;min-height:0;overflow:auto;
  max-width:1420px;margin:0 auto;padding:0 22px 48px;width:100%;
}
.client-detail-suite .tw-frozen{
  flex:0 0 auto;position:sticky;top:0;z-index:60;
}
.client-detail-suite .tw-b{font-family:var(--font-geist-sans),'Geist',sans-serif}
.client-detail-suite .tw-v,
.client-detail-suite .tw-id,
.client-detail-suite .tw-d,
.client-detail-suite .tw-ms2 b{
  font-family:var(--font-geist-mono),'Geist Mono',ui-monospace,monospace;
}
.client-detail-suite .tw-sb__l em.r{background:var(--tw-badb);color:var(--tw-bad)}
.client-detail-suite .platform-v6-epanel-inner{
  padding:0 0 20px !important;background:transparent !important;min-height:0 !important;
}
.client-detail-suite .platform-v6-page-section-title,
.client-detail-suite .platform-v6-page-section-sub{display:none !important}
.client-detail-suite .platform-v6-wide-form-block{
  margin-bottom:11px !important;border-radius:12px !important;
  box-shadow:var(--tw-ring) !important;border:0 !important;
}
.client-detail-suite .platform-v6-wide-form-head{padding:11px 14px !important;gap:9px !important}
.client-detail-suite .platform-v6-wide-form-head-icon{display:none !important}
.client-detail-suite .platform-v6-wide-form-body{padding:14px !important}
.client-detail-suite .platform-v6-form-grid{gap:12px !important}
.client-detail-suite form.grid{gap:11px !important}
.client-detail-suite .space-y-4 > :not([hidden]) ~ :not([hidden]),
.client-detail-suite .space-y-6 > :not([hidden]) ~ :not([hidden]){
  margin-top:11px !important;
}
.client-detail-suite .tw-vtwo{align-items:start}
.client-detail-suite .tw-vtwo > *{min-width:0}
.client-detail-suite [data-slot="tabs-content"],
.client-detail-suite [role="tabpanel"]{margin-top:0 !important;outline:none}
.client-detail-suite .platform-v6-entity-breadcrumb,
.client-detail-suite .platform-v6-entity-nav-bar,
.client-detail-suite .platform-v6-page-header,
.client-detail-suite .platform-v6-kpi-strip,
.client-detail-suite .platform-v6-kpi-strip--executive{display:none !important}
.client-detail-suite .thinkway-campaign-section-card,
.client-detail-suite .thinkway-campaign-info-card{
  background:#fff;border-radius:12px;box-shadow:var(--tw-ring);
  overflow:hidden;margin-bottom:11px;border:0 !important;
}
.client-detail-suite .thinkway-campaign-section-head{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:11px 14px;border-bottom:1px solid var(--tw-line);
}
.client-detail-suite .thinkway-campaign-section-head > .min-w-0{display:contents}
.client-detail-suite .thinkway-campaign-section-head h2,
.client-detail-suite .thinkway-campaign-section-head h3{
  font-size:13px;font-weight:600;letter-spacing:0;color:var(--tw-ink);
}
.client-detail-suite .thinkway-campaign-section-head p{
  font-size:11px;color:var(--tw-mut);margin:0;max-width:none;line-height:1.45;
}
.client-detail-suite .thinkway-campaign-section-body{padding:14px}
.client-detail-suite .platform-v6-section-wrap{
  background:#fff;border-radius:12px;box-shadow:var(--tw-ring);overflow:hidden;margin-bottom:11px;border:0 !important;
}
.client-detail-suite .platform-v6-section-meta{padding:11px 14px !important;margin:0 !important}
.client-detail-suite .platform-v6-toolbar{padding:10px 14px !important;background:var(--tw-soft);border-bottom:1px solid var(--tw-hair)}
.client-detail-suite table{font-size:12.5px}
.client-detail-suite th{font-size:9px !important;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--tw-mut)}
.client-detail-suite td{padding-top:11px !important;padding-bottom:11px !important}
`;

fs.writeFileSync(
  "app/styles/client-detail-suite.css",
  header + out.join("") + reactOverrides
);

// Ensure ASCII-only output for Turbopack CSS parsing
{
  const raw = fs.readFileSync("app/styles/client-detail-suite.css");
  const ascii = raw.toString("latin1").replace(/[\x80-\xFF]/g, (ch) => {
    const c = ch.charCodeAt(0);
    if (c === 0x96 || c === 0x97) return "-";
    if (c === 0x91 || c === 0x92) return "'";
    if (c === 0x93 || c === 0x94) return '"';
    if (c === 0x85) return "...";
    if (c === 0xa0) return " ";
    return "";
  });
  fs.writeFileSync("app/styles/client-detail-suite.css", ascii, "utf8");
}
console.log("wrote", fs.statSync("app/styles/client-detail-suite.css").size);
