import fs from "node:fs";

const html = fs.readFileSync("tmp-preview/vendors-list.html", "utf8");
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) throw new Error("no style");
let css = m[1];

css = css.replace(
  /\*,\*::before,\*::after\{box-sizing:border-box;margin:0;padding:0\}/,
  "*,*::before,*::after{box-sizing:border-box}"
);
css = css.replace(/body\{[^}]+\}/, "");
css = css.replace(/:root\{/g, ".vendors-list-suite{");

function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel) return sel;
  if (sel.startsWith("@")) return sel;
  if (sel.startsWith(".vendors-list-suite")) return sel;
  return sel
    .split(",")
    .map((s) => {
      s = s.trim();
      if (!s) return s;
      if (s.startsWith(".vendors-list-suite")) return s;
      if (s === "body" || s === "html") return ".vendors-list-suite";
      if (s.startsWith(":")) return `.vendors-list-suite${s}`;
      return `.vendors-list-suite ${s}`;
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

const header = `/* Vendors / Commercial CRM list suite.
 * Source: tmp-preview/vendors-list.html
 * Scoped to .vendors-list-suite — do not edit frozen discovery.css.
 */

`;

const reactOverrides = `

/* ===== React shell integration ===== */
.vendors-list-suite {
 display:flex;flex-direction:column;min-height:0;flex:1 1 auto;overflow:hidden;
 font:400 15px/1.5 var(--font-geist-sans), 'Geist', sans-serif;
 -webkit-font-smoothing:antialiased;
 background:var(--tw-bg);color:var(--tw-ink);
}
.vendors-list-suite .tw-main{
  flex:1 1 auto;min-height:0;overflow:auto;
  max-width:1420px;margin:0 auto;padding:0 22px 48px;width:100%;
}
.vendors-list-suite .tw-frozen{
  flex:0 0 auto;position:sticky;top:0;z-index:60;
}
.vendors-list-suite .tw-b{font-family:var(--font-geist-sans),'Geist',sans-serif}
.vendors-list-suite .tw-v,
.vendors-list-suite .tw-id,
.vendors-list-suite .tw-d,
.vendors-list-suite .tw-ms2 b{
  font-family:var(--font-geist-mono),'Geist Mono',ui-monospace,monospace;
}
.vendors-list-suite .platform-v6-page-header,
.vendors-list-suite .platform-v6-kpi-strip,
.vendors-list-suite .platform-v6-page-section-title,
.vendors-list-suite .platform-v6-page-section-sub{display:none !important}
.vendors-list-suite .platform-v6-section-wrap{
  background:transparent !important;border:0 !important;box-shadow:none !important;
  margin:0 !important;padding:0 !important;overflow:visible !important;
}
.vendors-list-suite .platform-v6-toolbar{
  padding:10px 14px !important;background:var(--tw-soft);border-bottom:1px solid var(--tw-hair);
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
.vendors-list-suite .platform-v6-section-meta{display:none !important}
.vendors-list-suite table{font-size:12.5px;width:100%}
.vendors-list-suite th{
  font-size:9px !important;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--tw-mut);
  background:var(--tw-soft);border-bottom:1px solid var(--tw-line);padding:9px 8px !important;
}
.vendors-list-suite td{padding:11px 8px !important;border-bottom:1px solid var(--tw-hair);vertical-align:middle}
.vendors-list-suite tbody tr:hover{background:#FBFCFF}
.vendors-list-suite .platform-v6-link{color:inherit;text-decoration:none;font-weight:600}
.vendors-list-suite .platform-v6-link:hover{color:var(--tw-bi)}
.vendors-list-suite .platform-v6-c-gray,
.vendors-list-suite .platform-v6-c-blue,
.vendors-list-suite .platform-v6-num{font-size:12.5px}
.vendors-list-suite .platform-v6-num{
  font:600 12.5px var(--font-geist-mono),'Geist Mono',ui-monospace,monospace;
  font-variant-numeric:tabular-nums;letter-spacing:-.3px;
}
.vendors-list-suite .tw-pag,
.vendors-list-suite .tw-pg{
  display:flex;align-items:center;gap:7px;padding:11px 14px;border-top:1px solid var(--tw-line);
}
`;

fs.writeFileSync(
  "app/styles/vendors-list-suite.css",
  header + out.join("") + reactOverrides
);

{
  let ascii = fs
    .readFileSync("app/styles/vendors-list-suite.css")
    .toString("latin1")
    .replace(/[\x80-\xFF]/g, (ch) => {
      const c = ch.charCodeAt(0);
      if (c === 0x96 || c === 0x97) return "-";
      if (c === 0x91 || c === 0x92) return "'";
      if (c === 0x93 || c === 0x94) return '"';
      if (c === 0x85) return "...";
      if (c === 0xa0) return " ";
      return "";
    });
  ascii = ascii.replace(
    /@media\(max-height:720px\)\{\.tw-frozen\s*\}/g,
    `@media(max-height:720px){
  .vendors-list-suite .tw-frozen .tw-ms2{display:none}
  .vendors-list-suite .tw-frozen{padding-bottom:4px}
}`
  );
  fs.writeFileSync("app/styles/vendors-list-suite.css", ascii, "utf8");
  console.log("wrote app/styles/vendors-list-suite.css", ascii.length);
}
