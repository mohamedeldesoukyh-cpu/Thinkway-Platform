#!/usr/bin/env node
/**
 * Generates docs/redesign-handoff/DISCOVERY_SHORTLISTS_REFERENCE.md
 * Full source handoff for Shortlists list + detail workspace (reference: Search patterns).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "redesign-handoff");
const OUT_MD = path.join(OUT_DIR, "DISCOVERY_SHORTLISTS_REFERENCE.md");

const SECTIONS = [
  {
    title: "1 — Shortlists list route",
    intro: "List page at `/discovery/shortlists` — lavender canvas, filter bar, table, row overflow menu.",
    files: [
      "app/(dashboard)/discovery/shortlists/page.tsx",
      "features/discovery/shortlists/components/shortlists-list.tsx",
      "features/discovery/shortlists/components/shortlist-list-filter-bar.tsx",
      "features/discovery/shortlists/components/shortlist-list-actions.ts",
      "features/discovery/shortlists/components/shortlist-list-filters.ts",
      "features/discovery/shortlists/components/shortlist-row-visuals.tsx",
      "features/discovery/shortlists/components/shortlist-badges.tsx",
      "features/discovery/shortlists/components/shortlist-selection-flyout.tsx",
      "features/discovery/shortlists/components/create-shortlist-dialog.tsx",
    ],
  },
  {
    title: "2 — Shortlist detail route",
    intro:
      "Detail workspace at `/discovery/shortlists/[id]` — header card, creator exact rows, bulk bar, Generate Outputs launcher in toolbar.",
    files: [
      "app/(dashboard)/discovery/shortlists/[id]/page.tsx",
      "features/discovery/shortlists/components/shortlist-workspace.tsx",
      "features/discovery/shortlists/components/shortlist-detail-primitives.tsx",
      "features/discovery/shortlists/components/shortlist-creator-list.tsx",
      "features/discovery/shortlists/components/shortlist-bulk-toolbar.tsx",
      "features/discovery/shortlists/components/shortlist-creator-toolbar-actions.tsx",
      "features/discovery/shortlists/components/shortlist-metrics-refresh-banner.tsx",
      "features/discovery/shortlists/components/shortlist-quotation-panel.tsx",
      "features/discovery/shortlists/components/shortlist-edit-dialog.tsx",
      "features/discovery/shortlists/components/submit-shortlist-dialog.tsx",
      "features/discovery/shortlists/components/generate-quotation-shortlist-dialog.tsx",
      "features/discovery/shortlists/components/move-to-campaign-dialog.tsx",
      "features/discovery/shortlists/components/add-creators-drawer.tsx",
    ],
  },
  {
    title: "3 — Shortlist creator sort + constants",
    intro: "Sort state for Safety / Sync / Status / Quoted columns on detail creator list.",
    files: [
      "features/discovery/shortlists/shortlist-creator-sort.ts",
      "features/discovery/shortlists/constants.ts",
      "features/discovery/shortlists/types.ts",
    ],
  },
  {
    title: "4 — Shared Discovery list chrome (used by Shortlists list)",
    intro:
      "Same list card / table head tokens as Quotations. Filter bar uses DiscoveryFilterBar (embedded strip, not the Search filter drawer).",
    files: [
      "features/discovery/components/discovery-list-primitives.tsx",
      "features/discovery/components/design-system/discovery-design-tokens.ts",
      "features/discovery/components/design-system/discovery-filter-bar.tsx",
      "features/discovery/components/design-system/discovery-empty-state.tsx",
      "features/discovery/components/design-system/discovery-filtered-empty-state.tsx",
      "features/discovery/components/discovery-page-shell.tsx",
      "features/discovery/components/discovery-page-identity.tsx",
    ],
  },
  {
    title: "5 — Shared Discovery workspace chrome (detail toolbar)",
    intro: "Back bar + Open Studio / Generate Outputs actions on detail page.",
    files: [
      "features/discovery/components/design-system/discovery-workspace-chrome.tsx",
    ],
  },
  {
    title: "6 — Creator exact row (detail creator list)",
    intro:
      "Shortlist detail reuses DiscoveryCreatorExactRow + DiscoveryCreatorExactHeader from Search. Full canonical source included here.",
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
    title: "7 — Bulk selection flyout (base component)",
    intro:
      "Shared fixed bottom bar. List adapter: `ShortlistSelectionFlyout` (§1). Detail adapter: `ShortlistBulkToolbar` (§2).",
    files: ["features/discovery/components/design-system/discovery-selection-flyout.tsx"],
  },
  {
    title: "8 — Row overflow menus",
    intro:
      "List page: per-row DropdownMenu in shortlists-list.tsx. Detail page: RowActions inline DropdownMenu in shortlist-creator-list.tsx (not DiscoveryCreatorActionsMenu).",
    files: [
      "features/discovery/components/discovery-creator-actions-menu.tsx",
    ],
  },
  {
    title: "9 — App sidebar (shared shell)",
    intro: "Same sidebar as Search — see DISCOVERY_SEARCH_REFERENCE.md §8 for interaction notes.",
    files: [
      "app/(dashboard)/layout.tsx",
      "components/layout/collapsible-app-sidebar.tsx",
      "components/layout/dashboard-sidebar-auth.tsx",
      "lib/layout/app-sidebar-width.ts",
      "lib/hooks/use-delayed-hover.ts",
    ],
  },
  {
    title: "10 — Product design tokens",
    intro: "CSS variables referenced by Shortlists list + detail.",
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
  return source.split("\n").slice(startLine - 1, endLine).join("\n");
}

const v6Css = readFile("app/thinkway-platform-v6.css");
const globalsCss = readFile("app/globals.css");
const discoveryCssExtract = extractCssBlocks(v6Css, [
  ".discovery-search-exact-",
  ".discovery-creator-avatar-hover-",
  ".discovery-selection-flyout",
  ".discovery-selection-flyout__",
  ".discovery-selection-flyout-menu",
]);
const sidebarGlobalsExtract = extractLineRange(globalsCss, 250, 330);

const header = `# DISCOVERY SHORTLISTS — Reference implementation handoff

Generated for Thinkway redesign handoff. **Full sources** for Shortlists **list** (\`/discovery/shortlists\`) and **detail workspace** (\`/discovery/shortlists/[id]\`) — aligned with Discovery Search patterns.

> Companion doc: \`DISCOVERY_SEARCH_REFERENCE.md\` (Search filter drawer, Search bulk bar adapter, full CSS commentary)  
> Screenshot reference: detail page with header card, Creators (N) toolbar, exact-row list, Generate Campaign Outputs panel.

---

## Index

| Route | \`page.tsx\` | Main UI |
|-------|-------------|---------|
| List | \`app/(dashboard)/discovery/shortlists/page.tsx\` | \`ShortlistsList\` + \`ShortlistListFilterBar\` |
| Detail | \`app/(dashboard)/discovery/shortlists/[id]/page.tsx\` | \`ShortlistWorkspace\` + \`ShortlistCreatorList\` |

| Pattern | Shortlists implementation |
|---------|---------------------------|
| Page shell (list) | \`DiscoveryPageShell\` variant \`list\` — lavender canvas |
| Page shell (detail) | \`DiscoveryPageShell\` variant \`workspace\` + \`DiscoveryWorkspaceToolbar\` |
| Creator rows | \`DiscoveryCreatorExactRow\` / \`DiscoveryCreatorExactHeader\` |
| List filter UI | \`DiscoveryFilterBar\` embedded strip (search + status selects) — **not** Search filter drawer |
| Add creators | \`AddCreatorsDrawer\` → \`ShortlistCreatorPicker\` sheet |
| Bulk bar (list) | \`ShortlistSelectionFlyout\` → \`DiscoverySelectionFlyout\` |
| Bulk bar (detail) | \`ShortlistBulkToolbar\` → \`DiscoverySelectionFlyout\` |
| Row ⋯ menu (list) | Inline \`DropdownMenu\` in \`shortlists-list.tsx\` |
| Row ⋯ menu (detail) | Inline \`RowActions\` in \`shortlist-creator-list.tsx\` |
| Sidebar | \`CollapsibleAppSidebar\` — shared with all dashboard routes |

---

## Shortlists vs Search — pattern mapping

| Search | Shortlists list | Shortlists detail |
|--------|-----------------|-------------------|
| \`CreatorSearchFilterPanel\` + \`DiscoveryFilterSheet\` | \`ShortlistListFilterBar\` (inline filters) | N/A |
| \`CreatorSearchBulkBar\` | \`ShortlistSelectionFlyout\` | \`ShortlistBulkToolbar\` |
| \`DiscoveryCreatorActionsMenu\` | Row \`DropdownMenu\` in list table | \`RowActions\` dropdown in creator list |
| Virtualized \`CreatorSearchResultList\` | HTML \`<Table>\` in \`ShortlistsList\` | \`ShortlistCreatorList\` exact-row scroll region |
| URL-synced filter state | Client \`ShortlistListFilterState\` | Server-loaded \`ShortlistDetail\` |

---

## Detail creator list — scroll region

Creator list uses \`.discovery-search-exact-scroll\` with \`max-h-[min(70vh,960px)]\` so mouse wheel scroll works inside the card (same fix as Campaign Match). Without max-height, \`overscroll-behavior-y: contain\` traps wheel events.

\`\`\`tsx
// shortlist-creator-list.tsx
<div className="discovery-search-exact-scroll max-h-[min(70vh,960px)] overscroll-y-auto">
\`\`\`

---

## Bulk selection — behavior

### List (\`ShortlistsList\`)

- Checkbox column + \`ShortlistSelectionFlyout\` when \`selectedCount > 0\`
- Actions resolved by \`shortlist-list-actions.ts\` from selected row statuses
- Card gets bottom padding via \`shortlistListFloatingBarContentClass(selectedCount > 0)\`

### Detail (\`ShortlistWorkspace\`)

- \`ShortlistBulkToolbar\` maps creator bulk actions (submit, approve, compare, export, quotation, …)
- \`discoverySelectionFlyoutContentClass(selectedCount > 0)\` on creators card

---

## Row overflow menus

### List table (per shortlist row)

Implemented inside \`shortlists-list.tsx\`: \`DropdownMenu\` with Open + status actions from \`actionsForShortlistStatus\`.

### Detail creator row

\`RowActions\` in \`shortlist-creator-list.tsx\`: Add to quotation, Delete creator, Remove from shortlist. Uses shadcn \`DropdownMenu\`, class \`discovery-search-exact-row-menu\`.

Search uses the richer \`DiscoveryCreatorActionsMenu\` — included in §8 for comparison when aligning patterns.

---

## Sidebar & hover delays

Same as Search handoff:

| Interaction | Delay | File |
|-------------|-------|------|
| Collapsed rail tooltips | **300ms** | \`collapsible-app-sidebar.tsx\` \`TooltipProvider delayDuration={300}\` |
| Sidebar expand/collapse | **Click** | PanelLeftOpen / PanelLeftClose |
| Creator avatar preview on exact rows | **1000ms** | \`creator-avatar-hover-trigger.tsx\` \`useDelayedHover(1000)\` |
| Hook default (unused on Search rows) | **2000ms** | \`use-delayed-hover.ts\` |

---

## Design token drift checklist

Same sources as Search — Shortlists list mixes \`var(--text-2)\`, \`bg-background\`, \`bg-muted/40\`, and \`DISCOVERY_LIST_CARD_CLASS\`. Detail workspace uses \`bg-[var(--camp-surface)]\` canvas from \`DiscoveryPageShell\` workspace variant.

| Token | Shortlists usage |
|-------|------------------|
| \`--lavender\` | List page canvas (\`DiscoveryPageShell\` list variant) |
| \`--camp-surface\` | Detail workspace scroll region |
| \`--tw-border\` | List card borders, filter bar |
| \`discovery-search-exact-*\` CSS | Detail creator rows (platform-v6.css) |

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

body += `---\n\n## 11 — CSS extracts (exact-row + selection flyout)\n\n`;
body += `Same classes as Search. Extract from \`app/thinkway-platform-v6.css\`:\n\n`;
body += `\`\`\`css\n${discoveryCssExtract}\n\`\`\`\n\n`;
body += `### \`app/globals.css\` — sidebar (lines 250–330)\n\n`;
body += `\`\`\`css\n${sidebarGlobalsExtract}\n\`\`\`\n\n`;
body += `---\n\n*End of DISCOVERY SHORTLISTS reference handoff.*\n`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_MD, body, "utf8");

const sizeMb = (fs.statSync(OUT_MD).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${OUT_MD} (${sizeMb} MB)`);
