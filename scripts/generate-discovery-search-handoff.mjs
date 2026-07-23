#!/usr/bin/env node
/**
 * Generates docs/redesign-handoff/DISCOVERY_SEARCH_REFERENCE.md
 * Full source handoff for Discovery Search reference implementation.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "redesign-handoff");
const OUT_MD = path.join(OUT_DIR, "DISCOVERY_SEARCH_REFERENCE.md");

const SECTIONS = [
  {
    title: "1 — Search route & page shell",
    intro: "Entry route and DiscoveryPageShell wrapper (flush variant for Search).",
    files: [
      "app/(dashboard)/discovery/search/page.tsx",
      "features/discovery/components/discovery-page-shell.tsx",
      "features/discovery/components/discovery-page-identity.tsx",
      "app/(dashboard)/layout.tsx",
    ],
  },
  {
    title: "2 — Creator Search workspace (orchestrator)",
    intro:
      "Main client workspace: filter state, URL sync, server browse queries, selection, drawer open state.",
    files: [
      "features/discovery/components/creator-search/creator-search-workspace.tsx",
      "features/discovery/components/creator-search/creator-search-types.ts",
    ],
  },
  {
    title: "3 — Toolbar, active filters, result list",
    intro:
      "Top toolbar, sort controls, active filter chips, virtualized exact-row result list.",
    files: [
      "features/discovery/components/creator-search/creator-search-top-bar.tsx",
      "features/discovery/components/creator-search/creator-search-filter-bar.tsx",
      "features/discovery/components/creator-search/creator-search-active-filters.tsx",
      "features/discovery/components/creator-search/creator-search-sort-toolbar.tsx",
      "features/discovery/components/creator-search/creator-search-result-list.tsx",
      "features/discovery/components/creator-search/creator-search-exact-empty-state.tsx",
      "features/discovery/components/creator-search/creator-search-hybrid-sections.tsx",
      "features/discovery/components/creator-search/creator-search-recommended-section.tsx",
      "features/discovery/components/creator-search/creator-search-exact-row.tsx",
    ],
  },
  {
    title: "4 — Creator exact row (canonical row + column headers)",
    intro:
      "Golden row/card layout: checkbox, avatar, stats columns, feed thumbs, row actions.",
    files: [
      "features/discovery/components/discovery-creator-exact-row.tsx",
      "features/discovery/components/discovery-interest-chips.tsx",
      "features/discovery/components/discovery-creator-platform-stats.tsx",
      "features/discovery/components/discovery-creator-profile-summary.tsx",
      "features/discovery/components/creator-search/creator-avatar-hover-trigger.tsx",
      "features/discovery/components/creator-search/creator-details-hover-card.tsx",
    ],
  },
  {
    title: "5 — Filter drawer (sheet host + panel + fields)",
    intro:
      "Right-side filter sheet. Draft filters while open; Apply commits to workspace state and triggers server browse.",
    files: [
      "features/discovery/components/design-system/discovery-sheet-chrome.tsx",
      "features/discovery/components/design-system/discovery-filter-drawer.tsx",
      "features/discovery/components/creator-search/creator-search-filter-panel.tsx",
      "features/discovery/components/creator-search/creator-search-filter-fields.tsx",
    ],
  },
  {
    title: "6 — Bulk selection flyout (N selected action bar)",
    intro:
      "Fixed bottom bar when rows are selected. Search wraps it via CreatorSearchBulkBar.",
    files: [
      "features/discovery/components/design-system/discovery-selection-flyout.tsx",
      "features/discovery/components/creator-search/creator-search-bulk-bar.tsx",
    ],
  },
  {
    title: "7 — Row overflow menu (⋯ actions)",
    intro: "Per-row DiscoveryCreatorActionsMenu used inside exact rows.",
    files: [
      "features/discovery/components/discovery-creator-actions-menu.tsx",
    ],
  },
  {
    title: "8 — App sidebar (shared shell)",
    intro:
      "Collapsible sidebar used on every dashboard route including Discovery Search.",
    files: [
      "components/layout/collapsible-app-sidebar.tsx",
      "components/layout/dashboard-sidebar-auth.tsx",
      "lib/layout/app-sidebar-width.ts",
      "lib/hooks/use-delayed-hover.ts",
    ],
  },
  {
    title: "9 — Discovery design tokens (Tailwind class constants)",
    intro: "Shared Discovery class constants — not duplicated in thinkway-design-tokens.css.",
    files: [
      "features/discovery/components/design-system/discovery-design-tokens.ts",
      "features/discovery/components/design-system/index.ts",
    ],
  },
  {
    title: "10 — Product design tokens (CSS variables)",
    intro: "Canonical product tokens from thinkway-design-tokens.css (includes .dark block).",
    files: ["app/thinkway-design-tokens.css"],
  },
];

function readFile(relPath) {
  const abs = path.join(ROOT, relPath.replace(/\//g, path.sep));
  if (!fs.existsSync(abs)) {
    return `/* FILE NOT FOUND: ${relPath} */\n`;
  }
  return fs.readFileSync(abs, "utf8");
}

function langFor(file) {
  if (file.endsWith(".css")) return "css";
  if (file.endsWith(".tsx")) return "tsx";
  if (file.endsWith(".ts")) return "ts";
  return "text";
}

function extractCssBlocks(source, prefixes) {
  const lines = source.split("\n");
  const blocks = [];
  let current = [];
  let inBlock = false;

  for (const line of lines) {
    const isStart = prefixes.some((p) => line.startsWith(p));
    if (isStart) {
      if (inBlock && current.length) blocks.push(current.join("\n"));
      current = [line];
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (line.trim() === "" && current.length > 0) {
        const last = current[current.length - 1];
        if (last.trim() === "}") {
          blocks.push(current.join("\n"));
          current = [];
          inBlock = false;
        } else {
          current.push(line);
        }
      } else if (/^\.|^@media|^\.dark /.test(line) && current.length > 0) {
        const lastNonEmpty = [...current].reverse().find((l) => l.trim());
        if (lastNonEmpty?.trim() === "}") {
          blocks.push(current.join("\n"));
          current = [line];
        } else {
          current.push(line);
        }
      } else {
        current.push(line);
      }
    }
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks.join("\n\n");
}

function extractLineRange(source, startLine, endLine) {
  return source
    .split("\n")
    .slice(startLine - 1, endLine)
    .join("\n");
}

const v6Css = readFile("app/thinkway-platform-v6.css");
const globalsCss = readFile("app/globals.css");

const discoveryCssExtract = extractCssBlocks(v6Css, [
  ".discovery-search-exact-",
  ".discovery-creator-avatar-hover-",
  ".discovery-filter-",
  ".discovery-selection-flyout",
  ".discovery-selection-flyout__",
  ".discovery-selection-flyout-menu",
]);

const sidebarGlobalsExtract = extractLineRange(globalsCss, 250, 330);

const header = `# DISCOVERY SEARCH — Reference implementation handoff

Generated for Thinkway redesign handoff. **Full sources** for the finished Discovery Search page and the shared patterns to replicate elsewhere (sidebar, filter drawer, bulk-selection bar, row overflow menu, exact-row list).

> Golden reference route: \`/discovery/search\`  
> Scope: UI chrome + interaction patterns. Business logic helpers (browse actions, AI brief, enrichment polling) are included only where they define visible behavior.

---

## Index

| Area | Key files |
|------|-----------|
| Search route | \`app/(dashboard)/discovery/search/page.tsx\` |
| Workspace orchestrator | \`features/discovery/components/creator-search/creator-search-workspace.tsx\` |
| Exact row + headers | \`features/discovery/components/discovery-creator-exact-row.tsx\` |
| Filter drawer | \`discovery-sheet-chrome.tsx\`, \`discovery-filter-drawer.tsx\`, \`creator-search-filter-panel.tsx\` |
| Bulk selection bar | \`discovery-selection-flyout.tsx\`, \`creator-search-bulk-bar.tsx\` |
| Row overflow menu | \`discovery-creator-actions-menu.tsx\` |
| Sidebar | \`components/layout/collapsible-app-sidebar.tsx\` |
| CSS (exact-row + drawer + flyout) | \`app/thinkway-platform-v6.css\` (extract in §11) |
| Discovery Tailwind tokens | \`discovery-design-tokens.ts\` |
| Product CSS variables | \`app/thinkway-design-tokens.css\` |

---

## Interaction reference (unambiguous)

### Sidebar — NOT a 2-second hover expand

The **app sidebar does not use a 2-second delay** to expand or collapse.

| Interaction | Delay | Where |
|-------------|-------|-------|
| **Collapsed rail tooltips** (icon-only mode labels) | **300ms** | \`components/layout/collapsible-app-sidebar.tsx\` — \`<TooltipProvider delayDuration={300}>\` (~line 472) |
| **Expand / collapse sidebar** | **Immediate click** | Same file — \`persistExpanded(true|false)\` on PanelLeftOpen / PanelLeftClose buttons |
| **Section group collapse** | **Immediate click** | \`toggleGroup(group.label)\` on section headers |

Persisted in \`localStorage\`: \`thinkway:sidebar-expanded\`, \`thinkway:sidebar-collapsed-groups\`.

### Creator avatar preview card — delayed hover flyout (NOT sidebar)

When hovering a creator avatar/name in Search exact rows, a **stats preview card** appears after a pointer delay:

| Interaction | Delay | Where |
|-------------|-------|-------|
| **Open preview card** | **1000ms** (1 second) | \`creator-avatar-hover-trigger.tsx\` — \`useDelayedHover(1000)\` |
| **Close preview card** | **120ms** grace | \`lib/hooks/use-delayed-hover.ts\` — \`CLOSE_DELAY_MS = 120\` |
| **Hook default** (if no arg passed) | **2000ms** | \`lib/hooks/use-delayed-hover.ts\` — \`DEFAULT_DELAY_MS = 2000\` |

The **2-second default** lives in \`useDelayedHover\` but Search passes **1000ms** explicitly. Do not confuse this with sidebar behavior.

---

## Filter drawer — state flow

\`\`\`text
URL searchParams
    ↕ creatorSearchFiltersFromUrlParams / applyCreatorSearchFiltersToUrlParams
Workspace filters state (CreatorSearchWorkspace)
    ↕ props.filters
CreatorSearchFilterPanel draft (while drawer open)
    → onApply(next) → setFilters(next) → debounced browseUnifiedCreatorsAction (server query)
    → onClearAll() → clearAllFilters() → URL + state reset
\`\`\`

- **Draft while open**: \`CreatorSearchFilterPanel\` clones \`filters\` into \`draftFilters\`; chip removes and section edits mutate draft only.
- **Apply**: commits draft via \`onApply\`; workspace updates filters and re-runs server browse (not client-only filter).
- **Client-only filters**: some chips (e.g. brand safety scoring) may additionally filter in \`applyCreatorSearchClientFilters\` after fetch — see \`creator-search-client-filters.ts\` (not duplicated here; logic layer).

Drawer host: \`DiscoveryFilterSheet\` (\`discovery-sheet-chrome.tsx\`) — controlled by \`filtersDrawerOpen\` in workspace.

---

## Bulk selection bar — behavior

- Component: \`DiscoverySelectionFlyout\` — fixed bottom bar, slides up when \`selectedCount > 0\`.
- Search adapter: \`CreatorSearchBulkBar\` maps bulk actions (add to list, compare, export, quotation, etc.).
- Content padding: \`discoverySelectionFlyoutContentClass(count)\` adds bottom padding to the list region so rows are not hidden behind the bar.

---

## Row overflow menu

- Component: \`DiscoveryCreatorActionsMenu\` — Radix dropdown triggered by ⋯ on each exact row.
- Actions: refresh metrics, open profile, add/remove shortlist, compare, export, etc. (context-dependent props).

---

## Design token drift checklist

These token sources can diverge — check all when theming Discovery UI:

| Token source | Purpose | Drift risk |
|--------------|---------|------------|
| \`app/thinkway-design-tokens.css\` | Product vars: \`--surface\`, \`--lavender\`, \`--text-*\`, \`--tw-border\`, status badge bg | Missing \`.dark\` overrides breaks list pages |
| \`app/globals.css\` \`:root\` / \`.dark\` | Shadcn: \`--background\`, \`--muted\`, \`--sidebar-*\`, \`--camp-*\` | Overrides \`--muted\`, \`--radius\` vs design tokens |
| \`discovery-design-tokens.ts\` | Tailwind **class strings** for Discovery lists/toolbars | Uses both \`var(--text-2)\` and \`bg-muted/40\` |
| \`app/thinkway-platform-v6.css\` | Scoped \`.discovery-search-exact-*\`, \`.discovery-filter-*\`, \`.discovery-selection-flyout*\` | Hardcoded \`#fff\`, \`#f8fafc\` in light rules; \`.dark\` block at file end |
| \`thinkway-platform-v6\` aliases | \`--tw-surface: var(--surface)\` etc. inside \`.thinkway-platform-v6\` | Platform v6 pages only |

Discovery Search uses **both** shadcn tokens (\`bg-background\`, \`text-muted-foreground\`) **and** product vars (\`var(--text-2)\`, \`var(--tw-border)\`).

---

`;

let body = header;

for (const section of SECTIONS) {
  body += `\n---\n\n## ${section.title}\n\n${section.intro}\n\n`;
  for (const file of section.files) {
    const content = readFile(file);
    body += `#### \`${file}\`\n\n\`\`\`${langFor(file)}\n${content}\`\`\`\n\n`;
  }
}

body += `---\n\n## 11 — CSS extracts (Discovery Search + sidebar)\n\n`;
body += `### \`app/thinkway-platform-v6.css\` — Discovery exact-row, filter drawer, selection flyout\n\n`;
body += `\`\`\`css\n${discoveryCssExtract}\n\`\`\`\n\n`;
body += `### \`app/globals.css\` — Shell header + sidebar dark overrides (lines 250–330)\n\n`;
body += `\`\`\`css\n${sidebarGlobalsExtract}\n\`\`\`\n\n`;

body += `---\n\n*End of DISCOVERY SEARCH reference handoff.*\n`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_MD, body, "utf8");

const sizeMb = (fs.statSync(OUT_MD).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${OUT_MD} (${sizeMb} MB)`);
