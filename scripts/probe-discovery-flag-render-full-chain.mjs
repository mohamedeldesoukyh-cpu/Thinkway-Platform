/**
 * Full ancestor overflow chain probe — mirrors DiscoveryPageShell + workspace + exact row.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const v6css = fs.readFileSync(path.join(ROOT, "app/thinkway-platform-v6.css"), "utf8");

const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  .size-full { width: 100%; height: 100%; }
  .size-5 { width: 1.25rem; height: 1.25rem; }
  .size-\\[87px\\] { width: 87px; height: 87px; }
  .inline-flex { display: inline-flex; }
  .shrink-0 { flex-shrink: 0; }
  .overflow-hidden { overflow: hidden; }
  .rounded-full { border-radius: 9999px; }
  .relative { position: relative; }
  .absolute { position: absolute; }
  .inset-0 { inset: 0; }
  .top-0 { top: 0; }
  .left-0 { left: 0; }
  .w-full { width: 100%; }
  .block { display: block; }
  .flex { display: flex; }
  .min-h-0 { min-height: 0; }
  .flex-1 { flex: 1 1 0%; }
  .flex-col { flex-direction: column; }
  .h-full { height: 100%; }
  .bg-card { background: #fff; }
  html, body { height: 100%; margin: 0; }
  ${v6css}
</style></head>
<body>
  <!-- DashboardShell containedMain -->
  <div class="thinkway-platform-shell flex" style="height:100vh; overflow:hidden;">
    <main class="thinkway-platform-v6 flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <!-- DiscoveryPageShell flush -->
      <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <!-- CreatorSearchWorkspace -->
          <div class="flex h-full min-h-0 flex-col overflow-hidden">
            <div class="relative flex min-h-0 flex-1 overflow-hidden">
              <div class="discovery-search-exact-root">
                <div class="discovery-search-exact-header-bar"><div>Header</div></div>
                <div class="discovery-search-exact-scroll">
                  <div class="relative w-full" style="height: 400px;">
                    <div class="absolute top-0 left-0 w-full" style="transform: translateY(0px);">
                      <div class="discovery-search-exact-row">
                        <div class="discovery-search-exact-photo-cell">
                          <span class="discovery-search-exact-select"><input type="checkbox" /></span>
                          <div class="discovery-creator-avatar-hover-trigger discovery-search-exact-photo-wrap">
                            <a class="block rounded-full" href="#">
                              <div class="relative shrink-0 overflow-hidden rounded-full size-[87px]" style="background:#94a3b8" data-probe="avatar"></div>
                            </a>
                            <span class="discovery-search-exact-flag" data-probe="flag-slot">
                              <span class="inline-flex shrink-0 overflow-hidden rounded-full size-full" aria-label="EG" data-probe="flag-badge" style="background:#fff; box-shadow:0 0 0 2px #fff">
                                <img data-probe="flag-img" class="size-full" style="object-fit:cover" src="https://flagcdn.com/w40/eg.png" alt="" />
                              </span>
                            </span>
                            <span class="discovery-search-exact-star" data-probe="star">★ 7.2</span>
                          </div>
                        </div>
                        <div class="discovery-search-exact-info-cell">
                          <div class="discovery-search-exact-name">ahmed_elbadawy</div>
                          <div class="discovery-search-exact-handle">Egypt</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</body></html>`;

const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setContent(html, { waitUntil: "networkidle2", timeout: 60000 });

const report = await page.evaluate(() => {
  const flag = document.querySelector('[data-probe="flag-slot"]');
  const badge = document.querySelector('[data-probe="flag-badge"]');
  const img = document.querySelector('[data-probe="flag-img"]');
  const star = document.querySelector('[data-probe="star"]');
  const avatar = document.querySelector('[data-probe="avatar"]');

  function metrics(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      left: +r.left.toFixed(1),
      top: +r.top.toFixed(1),
      right: +r.right.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      visibility: s.visibility,
      opacity: s.opacity,
      display: s.display,
      overflow: `${s.overflowX}/${s.overflowY}`,
      zIndex: s.zIndex,
      position: s.position,
      transform: s.transform,
      clipPath: s.clipPath,
    };
  }

  // Walk ancestors; detect overflow clipping of flag rect
  const flagRect = flag.getBoundingClientRect();
  const clippers = [];
  let node = flag.parentElement;
  while (node && node !== document.body) {
    const s = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    const clips =
      s.overflowX !== "visible" ||
      s.overflowY !== "visible" ||
      s.overflow !== "visible";
    const flagOutside =
      flagRect.right > r.right + 0.5 ||
      flagRect.left < r.left - 0.5 ||
      flagRect.bottom > r.bottom + 0.5 ||
      flagRect.top < r.top - 0.5;
    if (clips) {
      clippers.push({
        className: node.className,
        overflow: `${s.overflowX}/${s.overflowY}`,
        rect: {
          w: +r.width.toFixed(1),
          h: +r.height.toFixed(1),
          left: +r.left.toFixed(1),
          right: +r.right.toFixed(1),
          top: +r.top.toFixed(1),
          bottom: +r.bottom.toFixed(1),
        },
        flagOutsideAncestorBounds: flagOutside,
        clippedAxes: {
          right: flagRect.right > r.right + 0.5,
          left: flagRect.left < r.left - 0.5,
          bottom: flagRect.bottom > r.bottom + 0.5,
          top: flagRect.top < r.top - 0.5,
        },
      });
    }
    node = node.parentElement;
  }

  const starM = metrics(star);
  const flagM = metrics(flag);
  const overlap =
    starM &&
    flagM &&
    !(
      starM.right <= flagM.left ||
      starM.left >= flagM.right ||
      starM.bottom <= flagM.top ||
      starM.top >= flagM.bottom
    );

  // Sample pixels at flag center via canvas from screenshot isn't available here;
  // use document.elementsFromPoint ignoring pointer-events by temporarily enabling.
  const prev = flag.style.pointerEvents;
  flag.style.pointerEvents = "auto";
  badge.style.pointerEvents = "auto";
  const cx = (flagM.left + flagM.right) / 2;
  const cy = (flagM.top + flagM.bottom) / 2;
  const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((el) => ({
    tag: el.tagName,
    probe: el.getAttribute("data-probe"),
    className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
  }));
  flag.style.pointerEvents = prev;
  badge.style.pointerEvents = prev;

  return {
    flag: flagM,
    badge: metrics(badge),
    img: metrics(img),
    star: starM,
    avatar: metrics(avatar),
    starOverlapsFlag: overlap,
    overflowClippers: clippers,
    paintStackAtFlagCenter: stack,
    imgNaturalWidth: img?.naturalWidth ?? null,
    conclusionHints: {
      zeroSize: !flagM || flagM.w === 0 || flagM.h === 0,
      invisible: flagM?.visibility !== "visible" || flagM?.opacity === "0",
      clippedByAncestor: clippers.some((c) => c.flagOutsideAncestorBounds),
      starCovers: overlap && Number(starM.zIndex) > Number(flagM.zIndex),
    },
  };
});

const outDir = path.join(ROOT, "docs/validation-artifacts/discovery-release-readiness");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "flag-render-probe-full-chain.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
await page.screenshot({
  path: path.join(outDir, "flag-render-probe-full-chain.png"),
  fullPage: false,
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
