/**
 * Render-layer probe for Discovery exact-row country flag.
 * Mirrors DOM + CSS from discovery-creator-exact-row + platform-v6.
 * Run: node scripts/probe-discovery-flag-render.mjs
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const cssPath = path.join(ROOT, "app/thinkway-platform-v6.css");
const v6css = fs.readFileSync(cssPath, "utf8");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  /* minimal tailwind-equivalent utilities used by the badge/avatar */
  .size-full { width: 100%; height: 100%; }
  .size-5 { width: 1.25rem; height: 1.25rem; }
  .size-\\[87px\\] { width: 87px; height: 87px; }
  .inline-flex { display: inline-flex; }
  .shrink-0 { flex-shrink: 0; }
  .overflow-hidden { overflow: hidden; }
  .rounded-full { border-radius: 9999px; }
  .relative { position: relative; }
  .block { display: block; }
  .bg-card { background: #fff; }
  .ring-2 { box-shadow: 0 0 0 2px #fff; }
  .object-cover { object-fit: cover; }
  .object-center { object-position: center; }
  .border-0 { border-width: 0; }
  body { margin: 40px; font-family: system-ui; background: #f8fafc; }
  ${v6css}
</style>
</head>
<body>
  <div class="discovery-search-exact-root" style="height: 240px;">
    <div class="discovery-search-exact-scroll" style="overflow: auto; height: 200px;">
      <div class="relative w-full" style="height: 160px;">
        <div class="absolute top-0 left-0 w-full" style="transform: translateY(0px);">
          <div class="discovery-search-exact-row" data-discovery-creator-target>
            <div class="discovery-search-exact-photo-cell">
              <div class="discovery-creator-avatar-hover-trigger discovery-search-exact-photo-wrap">
                <a class="block rounded-full" href="#">
                  <div class="relative shrink-0 overflow-hidden rounded-full size-[87px] border-0" style="background:#e2e8f0">
                    <img alt="avatar" style="width:100%;height:100%;object-fit:cover" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"87\" height=\"87\"><rect fill=\"#94a3b8\" width=\"87\" height=\"87\"/></svg>')}" />
                  </div>
                </a>
                <span class="discovery-search-exact-flag" data-probe="flag-slot">
                  <span class="inline-flex shrink-0 overflow-hidden rounded-full bg-card ring-2 size-5 size-full" aria-label="EG" data-probe="flag-badge" style="box-shadow:0 0 0 2px #fff">
                    <img data-probe="flag-img" class="size-full object-cover object-center" alt="" src="https://flagcdn.com/w40/eg.png" />
                  </span>
                </span>
                <span class="discovery-search-exact-star" data-probe="star">★ 7.2</span>
              </div>
            </div>
            <div class="discovery-search-exact-info-cell">
              <div class="discovery-search-exact-name">ahmed_elbadawy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

function box(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return {
    rect: {
      x: Math.round(r.x * 10) / 10,
      y: Math.round(r.y * 10) / 10,
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
      top: Math.round(r.top * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      bottom: Math.round(r.bottom * 10) / 10,
      left: Math.round(r.left * 10) / 10,
    },
    visibility: s.visibility,
    opacity: s.opacity,
    display: s.display,
    overflow: s.overflow,
    overflowX: s.overflowX,
    overflowY: s.overflowY,
    zIndex: s.zIndex,
    position: s.position,
    transform: s.transform,
    clipPath: s.clipPath,
    maskImage: s.maskImage || s.webkitMaskImage || "none",
    pointerEvents: s.pointerEvents,
  };
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return !(
    a.rect.right <= b.rect.left ||
    a.rect.left >= b.rect.right ||
    a.rect.bottom <= b.rect.top ||
    a.rect.top >= b.rect.bottom
  );
}

const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setContent(html, { waitUntil: "networkidle2", timeout: 60000 });

const report = await page.evaluate(() => {
  const pick = (sel) => document.querySelector(sel);
  const flagSlot = pick('[data-probe="flag-slot"]');
  const flagBadge = pick('[data-probe="flag-badge"]');
  const flagImg = pick('[data-probe="flag-img"]');
  const star = pick('[data-probe="star"]');
  const wrap = pick(".discovery-search-exact-photo-wrap");
  const photoCell = pick(".discovery-search-exact-photo-cell");
  const row = pick(".discovery-search-exact-row");
  const avatar = pick(".size-\\[87px\\]");
  const scroll = pick(".discovery-search-exact-scroll");
  const virtualItem = pick(".absolute.top-0.left-0.w-full");

  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      rect: {
        x: Math.round(r.x * 10) / 10,
        y: Math.round(r.y * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
        top: Math.round(r.top * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        bottom: Math.round(r.bottom * 10) / 10,
        left: Math.round(r.left * 10) / 10,
      },
      visibility: s.visibility,
      opacity: s.opacity,
      display: s.display,
      overflow: s.overflow,
      overflowX: s.overflowX,
      overflowY: s.overflowY,
      zIndex: s.zIndex,
      position: s.position,
      transform: s.transform,
      clipPath: s.clipPath,
      maskImage: s.maskImage || s.webkitMaskImage || "none",
      pointerEvents: s.pointerEvents,
    };
  }

  function overlaps(a, b) {
    if (!a || !b) return false;
    return !(
      a.rect.right <= b.rect.left ||
      a.rect.left >= b.rect.right ||
      a.rect.bottom <= b.rect.top ||
      a.rect.top >= b.rect.bottom
    );
  }

  const flagBox = box(flagSlot);
  const starBox = box(star);
  const badgeBox = box(flagBadge);
  const imgBox = box(flagImg);

  // elementFromPoint at flag center
  const cx = flagBox ? flagBox.rect.left + flagBox.rect.width / 2 : 0;
  const cy = flagBox ? flagBox.rect.top + flagBox.rect.height / 2 : 0;
  const topEl = document.elementFromPoint(cx, cy);
  const topChain = [];
  let n = topEl;
  while (n && topChain.length < 8) {
    topChain.push({
      tag: n.tagName,
      className: typeof n.className === "string" ? n.className : "",
      probe: n.getAttribute?.("data-probe"),
    });
    n = n.parentElement;
  }

  return {
    propsTrace: {
      countryFlagCodes: ["EG"],
      conditional: "vm.countryFlagCodes.length > 0 → render span.discovery-search-exact-flag",
      CountryFlagsStack: { countryCodes: ["EG"], size: "md", overlay: true, className: "size-full" },
      CountryFlagBadge: { countryCode: "EG", size: "md", overlay: true, className: "size-full" },
    },
    html: {
      flagSlot: flagSlot?.outerHTML?.slice(0, 500),
      star: star?.outerHTML,
    },
    computed: {
      flagSlot: flagBox,
      flagBadge: badgeBox,
      flagImg: imgBox,
      star: starBox,
      wrap: box(wrap),
      photoCell: box(photoCell),
      row: box(row),
      avatar: box(avatar),
      scroll: box(scroll),
      virtualItem: box(virtualItem),
    },
    diagnostics: {
      starOverlapsFlag: overlaps(starBox, flagBox),
      flagArea: flagBox ? flagBox.rect.width * flagBox.rect.height : 0,
      flagHasZeroSize: flagBox ? flagBox.rect.width === 0 || flagBox.rect.height === 0 : true,
      elementAtFlagCenter: topChain[0] ?? null,
      topChain,
      flagCoveredByStarAtCenter:
        topChain.some((c) => c.probe === "star") ||
        (topChain[0]?.className || "").includes("discovery-search-exact-star"),
      imgNaturalWidth: flagImg?.naturalWidth ?? null,
      imgComplete: flagImg?.complete ?? null,
    },
  };
});

const outDir = path.join(ROOT, "docs/validation-artifacts/discovery-release-readiness");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "flag-render-probe.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

// screenshot
await page.screenshot({
  path: path.join(outDir, "flag-render-probe.png"),
  fullPage: true,
});

console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${outPath}`);
await browser.close();
