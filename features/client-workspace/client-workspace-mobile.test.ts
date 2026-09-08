import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

test("Client Workspace mobile CSS stacks Overview, Shortlist, Commercial, and chrome", () => {
  const css = readFileSync(resolve("features/client-workspace/styles/client-review-ref.css"), "utf8");
  const creators = readFileSync(
    resolve("features/client-workspace/components/creators-workspace.tsx"),
    "utf8"
  );
  const publicationPlan = readFileSync(
    resolve("features/client-workspace/components/campaign-publication-plan.tsx"),
    "utf8"
  );

  assert.equal(css.includes(".ov-analysis{grid-template-columns:1fr"), true);
  assert.equal(css.includes(".ov-exec-txt{min-width:0;flex-basis:100%}"), true);
  assert.equal(css.includes(".ov-strat{grid-template-columns:1fr"), true);
  assert.equal(css.includes(".journey-h{display:none}"), true);
  assert.equal(css.includes("header.bar .sp{display:none;}"), true);
  assert.equal(css.includes("flex:1 1 100%"), true);
  assert.equal(css.includes(".fstats{grid-template-columns:1fr 1fr}"), true);
  assert.equal(css.includes(".segs{display:flex;flex-wrap:nowrap"), true);
  assert.equal(css.includes(".cc-remove{"), true);
  assert.equal(css.includes(".send-row{"), true);
  assert.equal(css.includes(".cm-total{font-size:24px}"), true);
  assert.equal(css.includes(".dacts .btn,"), true);

  assert.equal(creators.includes('className="cc-remove"'), true);
  assert.equal(creators.includes('style={{ margin: "8px 8px 0 0" }}'), false);
  assert.equal(css.includes(".cx-metric--likes"), true);
  assert.equal(css.includes(".cx-show-sm{display:none"), true);
  assert.equal(css.includes(".cx-pub-metrics"), true);
  assert.equal(publicationPlan.includes("cx-show-sm cx-pub-metrics"), true);
  assert.equal(publicationPlan.includes("PublicationPlanMobileMetrics"), true);
  assert.equal(css.includes("#ed4956"), true);
  assert.equal(css.includes(".cx-pane{display:flex;flex-direction:column"), true);
  assert.equal(css.includes(".cx-rev__head{order:1"), true);
  assert.equal(css.includes(".cx-rev__media{order:1"), true);
  assert.equal(css.includes("overflow-wrap:anywhere"), true);
  assert.equal(css.includes(".detail:not(.show)"), true);
  assert.equal(css.includes("display:none !important"), true);
  assert.equal(creators.includes('viewport === "desktop"'), true);
  assert.equal(creators.includes("createPortal"), true);
  assert.equal(creators.includes("show={showDetail}"), false);
});

test("Client Workspace tab switches must not pushState a new [section] URL", () => {
  // Next.js 16 patches history.pushState and re-fetches RSC for path changes.
  // Changing /review/[id]/[section] remounts loading.tsx + loadClientWorkspace.
  const app = readFileSync(
    resolve("features/client-workspace/components/client-workspace-app.tsx"),
    "utf8"
  );
  const shell = readFileSync(
    resolve("features/client-workspace/components/client-workspace-shell.tsx"),
    "utf8"
  );
  const creators = readFileSync(
    resolve("features/client-workspace/components/creators-workspace.tsx"),
    "utf8"
  );
  const css = readFileSync(resolve("features/client-workspace/styles/client-review-ref.css"), "utf8");
  assert.equal(app.includes("window.history.pushState"), false);
  assert.equal(app.includes("history.pushState("), false);
  assert.equal(app.includes("buildClientReviewPath(pathReviewId, token, next)"), false);
  assert.equal(shell.includes('<nav className="tabs"'), true);
  assert.match(shell, /<button[\s\S]*type="button"[\s\S]*className=\{`\$\{on \? "tab on" : "tab"/);
  assert.equal(creators.includes("createPortal"), true);
  assert.equal(creators.includes("(max-width: 980px)"), true);
  assert.equal(css.includes("z-index:120"), true);
  assert.equal(css.includes("position:absolute !important"), true);
});
