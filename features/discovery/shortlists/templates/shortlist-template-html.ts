/**
 * Thinkway shortlist HTML — landscape brand template for preview + export.
 * Content is emitted as measurable flows; the pagination engine builds Page objects
 * shared by preview iframe and PDF (Puppeteer prints already-paginated pages).
 */
import type { ShortlistDocument } from "@/features/discovery/shortlists/export/shortlist-document";
import {
  renderShortlistTemplateAvatarHtml,
  resolveShortlistTemplatePublicationSrc,
} from "./shortlist-template-avatars";
import { buildShortlistTemplatePayload } from "./shortlist-template-payload";
import {
  buildShortlistPaginationRuntimeScript,
} from "./shortlist-pagination-engine";
import {
  QUOTATION_TEMPLATE_LOGO_SVG,
  QUOTATION_TEMPLATE_LOGO_SVG_DARK,
  QUOTATION_TEMPLATE_STYLES,
  SHORTLIST_TEMPLATE_EXTRA_STYLES,
} from "./shortlist-template-styles";
import type { ShortlistTemplatePayload } from "./shortlist-template-types";

export type BuildShortlistTemplateHtmlOptions = {
  siteOrigin?: string;
  /** Chromium PDF body class only — layout is identical to preview. */
  forPdf?: boolean;
};

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLogo(variant: "cover" | "footer"): string {
  if (variant === "cover") {
    return `<div class="logo rev">${QUOTATION_TEMPLATE_LOGO_SVG}<span class="wm">THINK<b>WAY</b></span></div>`;
  }
  return `<div class="logo">${QUOTATION_TEMPLATE_LOGO_SVG_DARK}<span class="wm">THINK<b>WAY</b></span></div>`;
}

function renderVerifiedBadge(isVerified: boolean): string {
  return isVerified ? `<span class="verified-badge" title="Verified">✓</span>` : "";
}

function renderFlow(options: {
  pageClass: string;
  footerLeft: string;
  footerRight: string;
  exclusive?: boolean;
  blocksHtml: string;
}): string {
  const exclusive = options.exclusive ? ` data-sl-exclusive="true"` : "";
  return `<section class="sl-flow" data-sl-flow data-sl-page-class="${esc(options.pageClass)}" data-sl-footer-left="${esc(options.footerLeft)}" data-sl-footer-right="${esc(options.footerRight)}"${exclusive}>
${options.blocksHtml}
</section>`;
}

function block(html: string, attrs = 'data-sl-atomic="true"'): string {
  return `<div data-sl-block ${attrs}>${html}</div>`;
}

function renderCoverFlow(payload: ShortlistTemplatePayload): string {
  const s = payload.shortlist;
  const c = payload.cover;
  const camp = payload.campaign;
  const inner = `<div class="cbar">
    ${renderLogo("cover")}
    <div class="chip">${esc(s.status)} · ${esc(s.visibility)}</div>
  </div>
  <div class="kicker">${esc(c.kicker)}</div>
  <h1>${esc(s.title)}</h1>
  <div class="accentbar"></div>
  <p class="sub">${esc(c.subtitle)}</p>
  <div class="metagrid">
    <div class="m"><p class="l">Shortlist No.</p><p class="v mono">${esc(s.number)}</p></div>
    <div class="m"><p class="l">Legal Entity</p><p class="v">${esc(s.client)}</p></div>
    <div class="m"><p class="l">Brand</p><p class="v">${esc(s.brand)}</p></div>
    <div class="m"><p class="l">Owner</p><p class="v">${esc(s.owner)}</p></div>
    <div class="m"><p class="l">Generated</p><p class="v mono">${esc(s.generatedDate)}</p></div>
    <div class="m"><p class="l">Status</p><p class="v">${esc(s.status)}</p></div>
    <div class="m"><p class="l">Visibility</p><p class="v">${esc(s.visibility)}</p></div>
    <div class="m"><p class="l">Creators</p><p class="v mono">${esc(camp.creatorCount)}</p></div>
  </div>
  <div class="statrow">
    <div class="stat"><p class="sl">Shortlist Creators</p><p class="sv">${esc(camp.creatorCount)}</p><p class="su">${esc(camp.tierSummary)}</p></div>
    <div class="stat"><p class="sl">Total Reach</p><p class="sv">${esc(camp.totalReachShort)}</p><p class="su">${esc(camp.totalReach)} accounts</p></div>
    <div class="stat"><p class="sl">${esc(c.stat3.label)}</p><p class="sv">${esc(c.stat3.valueShort)}</p><p class="su">${esc(c.stat3.value)}</p></div>
  </div>`;

  return renderFlow({
    pageClass: "page cover",
    footerLeft: payload.footer.left,
    footerRight: `Generated ${s.generatedDate}`,
    exclusive: true,
    blocksHtml: block(inner),
  });
}

function renderTierBlock(
  tier: ShortlistTemplatePayload["tiers"][number]
): string {
  const rows = tier.creators
    .map(
      (creator) =>
        `<tr><td class="h">${esc(creator.handle)}</td><td>${esc(creator.platform)}</td><td class="r">${esc(creator.followers)}</td><td>${esc(creator.category)}</td><td class="r">${esc(creator.er)}</td><td class="r">${esc(creator.estReach)}</td></tr>`
    )
    .join("");
  return `<div class="tier tier-breakdown-block">
    <div class="tier-head tier-breakdown-header">
      <span class="tier-tag ${esc(tier.slug)}">${esc(tier.name)}</span>
      <span class="tier-meta"><b>${esc(tier.profileCount)}</b> · ${esc(tier.followers)} followers · Est. reach <b>${esc(tier.estReach)}</b> (${esc(tier.reachShare)}) · Avg ER <b>${esc(tier.avgER)}</b></span>
    </div>
    <table>
      <thead class="tr tier-breakdown-table"><tr><th>Handle</th><th>Platform</th><th class="r">Followers</th><th>Category</th><th class="r">ER %</th><th class="r">Est. reach</th></tr></thead>
      <tbody class="tb">${rows}</tbody>
    </table>
  </div>`;
}

function renderSummaryFlows(payload: ShortlistTemplatePayload): string {
  const categories = payload.categories
    .map(
      (cat) =>
        `<div class="cat"><p class="cn">${esc(cat.name)}</p><p class="cv">${esc(cat.count)}</p><p class="cs">${esc(cat.countLabel)} · ${esc(cat.share)}</p></div>`
    )
    .join("");

  const insightParts = [
    payload.insight.categoryMix,
    payload.insight.tierMix,
    payload.insight.scale,
  ]
    .filter(Boolean)
    .join(" ");

  const categoryFlow = renderFlow({
    pageClass: "page summary-overview-page",
    footerLeft: payload.footer.left,
    footerRight: `${payload.shortlist.number} · Mix`,
    blocksHtml: [
      block(`<div class="sec-row"><span class="sec-badge">01</span><span class="lbl">Creators by category</span></div>
    <h2 class="sec-title">Creator mix</h2>`),
      block(
        `<div class="cat-grid">${categories || `<div class="cat"><p class="cn">—</p><p class="cv">0</p><p class="cs">No categories</p></div>`}</div>
    <div class="kicker" style="color:var(--muted);">Full influencer breakdown by tier</div>`
      ),
    ].join("\n"),
  });

  const tierFlows = payload.tiers
    .map((tier, index) =>
      renderFlow({
        pageClass: "page summary-overview-page summary-tier-page",
        footerLeft: payload.footer.left,
        footerRight: `${payload.shortlist.number} · Tier ${index + 1}`,
        blocksHtml: [
          block(`<div class="sec-row"><span class="sec-badge">01</span><span class="lbl">Tier breakdown</span></div>
    <h2 class="sec-title">${esc(tier.name)}</h2>`),
          block(renderTierBlock(tier), 'data-sl-atomic="true" data-sl-table-split="true"'),
        ].join("\n"),
      })
    )
    .join("");

  const totalsFlow = renderFlow({
    pageClass: "page summary-overview-page summary-totals-page",
    footerLeft: payload.footer.left,
    footerRight: `${payload.shortlist.number} · Totals`,
    blocksHtml: [
      block(`<div class="sec-row"><span class="sec-badge">01</span><span class="lbl">Roster totals</span></div>
    <h2 class="sec-title">Grand total</h2>`),
      block(`<div class="grand tier-breakdown-grand-total">
      <div class="gl">Grand total · ${esc(payload.totals.creatorCount)} influencers</div>
      <div class="gm">
        <span>Followers<b>${esc(payload.totals.followers)}</b></span>
        <span>Est. reach<b>${esc(payload.totals.estReach)}</b></span>
        <span>Avg ER<b>${esc(payload.totals.avgER)}</b></span>
      </div>
    </div>`),
      block(`<div class="insight"><p><b>Roster insight.</b> ${esc(payload.insight.narrative)}${
        insightParts ? ` ${esc(insightParts)}` : ""
      }</p></div>`),
    ].join("\n"),
  });

  return `${categoryFlow}${tierFlows}${totalsFlow}`;
}

function renderShowcaseCreatorFlows(
  payload: ShortlistTemplatePayload,
  doc: ShortlistDocument,
  siteOrigin?: string
): string {
  const pitch = payload.flags.pitchCreators;
  const avatarVariant = pitch ? "pitch" : "showcase";
  const pageClass = pitch
    ? "page showcase-creator-page pitch-creator-page"
    : "page showcase-creator-page";

  return payload.showcaseCreators
    .map((creator, index) => {
      const group = doc.creatorGroups[index];
      const avatarHtml = group
        ? renderShortlistTemplateAvatarHtml(group, siteOrigin, avatarVariant)
        : pitch
          ? `<span class="pitch-avatar pitch-avatar--initials">${esc(creator.initials)}</span>`
          : `<span class="sc-avatar sc-avatar--initials">${esc(creator.initials)}</span>`;

      const profileLinkStart =
        creator.profileUrl && /^https?:\/\//i.test(creator.profileUrl)
          ? `<a class="sc-profile-link" href="${esc(creator.profileUrl)}" target="_blank" rel="noopener noreferrer">`
          : "";
      const profileLinkEnd = profileLinkStart ? "</a>" : "";

      const publicationShots = group?.publicationShots ?? [];
      const pubsHtml =
        publicationShots.length > 0
          ? publicationShots
              .map((shot) => {
                const src = resolveShortlistTemplatePublicationSrc(shot, siteOrigin);
                if (!src) return "";
                const play = shot.isVideo
                  ? `<span class="pub-play showcase-pub-play" aria-hidden="true"><span class="pub-play-icon showcase-pub-play-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></span>`
                  : "";
                const img = `<img class="showcase-pub-thumb" src="${esc(src)}" alt="" referrerpolicy="no-referrer" />${play}`;
                const linked =
                  shot.postUrl && /^https?:\/\//i.test(shot.postUrl)
                    ? `<a href="${esc(shot.postUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>`
                    : img;
                return `<div class="pub showcase-pub-card">${linked}</div>`;
              })
              .filter(Boolean)
              .join("")
          : `<div class="pub-empty">No publication screenshots available for this creator.</div>`;

      const notesText = creator.notes?.trim() && creator.notes.trim() !== "—" ? creator.notes.trim() : "";
      const noteParagraphs = notesText
        ? notesText.split(/\n+/).map((part) => part.trim()).filter(Boolean)
        : [];
      // Keep each notes paragraph atomic so long descriptions continue cleanly.
      const notesBlocks =
        noteParagraphs.length === 0
          ? [
              block(`<p class="sc-sub">Shortlist context</p>
    <div class="sl-context-grid">
      <div class="sl-context-card"><p class="l">Review status</p><p class="v">${esc(creator.status)}</p></div>
      <div class="sl-context-card"><p class="l">Notes</p><p class="v">—</p></div>
    </div>`),
            ]
          : [
              block(`<p class="sc-sub">Shortlist context</p>
    <div class="sl-context-grid">
      <div class="sl-context-card"><p class="l">Review status</p><p class="v">${esc(creator.status)}</p></div>
      <div class="sl-context-card"><p class="l">Notes</p><p class="v">${esc(noteParagraphs[0]!)}</p></div>
    </div>`),
              ...noteParagraphs.slice(1).map((paragraph) =>
                block(`<p class="sc-sub">Notes (continued)</p>
    <p class="roster-note">${esc(paragraph)}</p>`)
              ),
            ];

      // Atomic blocks — never mid-split. Publication grid moves as one unit.
      const blocksHtml = [
        block(`<div class="sec-row"><span class="sec-badge">${esc(creator.sectionNo)}</span><span class="lbl">Creator ${creator.index} of ${esc(payload.totals.creatorCount)}</span></div>
    <div class="sc-top">
      ${profileLinkStart}${avatarHtml}<div>
        <p class="sc-name showcase-name">${esc(creator.name)}${renderVerifiedBadge(creator.isVerified)}</p>
        <p class="sc-handle showcase-handle">${esc(creator.handle)}</p>
      </div>${profileLinkEnd}
    </div>`),
        block(`<div class="sc-stats showcase-kpi-row">
      <div class="sc-stat showcase-kpi"><p class="l">Followers</p><p class="v">${esc(creator.followers)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Engagement</p><p class="v">${esc(creator.engagement)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Tier</p><p class="v">${esc(creator.tier)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Categories</p><p class="v" style="font-size:13px;">${esc(creator.categories)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Market</p><p class="v" style="font-size:13px;">${esc(creator.country)}</p></div>
    </div>`),
        block(`<p class="sc-sub showcase-pubs-title">Recent publications</p>
    <div class="pubs showcase-pubs-grid">${pubsHtml}</div>`),
        ...notesBlocks,
      ].join("\n");

      return renderFlow({
        pageClass,
        footerLeft: payload.footer.left,
        footerRight: `${payload.shortlist.number} · ${creator.handle}`,
        // Pack blocks with measurement; do not force one oversized sheet.
        exclusive: false,
        blocksHtml,
      });
    })
    .join("");
}

function renderRosterFlow(
  payload: ShortlistTemplatePayload,
  doc: ShortlistDocument,
  siteOrigin?: string
): string {
  const avatarSources = payload.flags.showcaseCreators
    ? doc.creatorGroups
    : doc.rows;

  const rowHtml = payload.rosterRows.map((row, index) => {
    const avatarSource = avatarSources[index];
    const avatarHtml = avatarSource
      ? renderShortlistTemplateAvatarHtml(avatarSource, siteOrigin, "fee")
      : `<span class="fee-avatar fee-avatar--initials">${esc(row.avatarInitials ?? "??")}</span>`;

    const creatorCell = `<div class="creator-name-cell">${avatarHtml}<span class="creator-name">${esc(row.creator)}<br><span style="font-size:11px;color:var(--muted);font-weight:400;">${esc(row.handle)}</span></span></div>`;

    if (payload.flags.includeInternalFields) {
      return `<tr>
          <td class="num">${row.rank}</td>
          <td class="name">${creatorCell}</td>
          <td>${esc(row.platform)}</td>
          <td class="r">${esc(row.followers)}</td>
          <td class="r">${esc(row.er)}</td>
          <td>${esc(row.country)}</td>
          <td class="categories-cell">${esc(row.interests ?? "—")}</td>
          <td>${esc(row.brandSafety ?? "—")}</td>
          <td>${esc(row.status ?? "—")}</td>
          <td class="notes-cell">${esc(row.notes ?? "—")}</td>
          <td class="r">${esc(row.matchScore ?? "—")}</td>
        </tr>`;
    }

    if (payload.flags.showcaseCreators) {
      return `<tr>
          <td class="name">${creatorCell}</td>
          <td class="r">${esc(row.followers)}</td>
          <td class="r">${esc(row.er)}</td>
          <td><span class="pill">${esc(row.tier ?? "—")}</span></td>
          <td class="categories-cell">${esc(row.categories ?? "—")}</td>
        </tr>`;
    }

    return `<tr>
        <td class="num">${row.rank}</td>
        <td class="name">${creatorCell}</td>
        <td>${esc(row.platform)}</td>
        <td class="r">${esc(row.followers)}</td>
        <td class="r">${esc(row.er)}</td>
        <td>${esc(row.country)}</td>
      </tr>`;
  });

  let tableHead = "";
  if (payload.flags.includeInternalFields) {
    tableHead = `<tr><th class="num">#</th><th>Creator</th><th>Platform</th><th class="r">Followers</th><th class="r">ER</th><th>Country</th><th>Interests</th><th>Brand safety</th><th>Status</th><th>Notes</th><th class="r">Match</th></tr>`;
  } else if (payload.flags.showcaseCreators) {
    tableHead = `<tr><th>Creator</th><th class="r">Followers</th><th class="r">ER</th><th>Tier</th><th>Categories</th></tr>`;
  } else {
    tableHead = `<tr><th class="num">#</th><th>Creator</th><th>Platform</th><th class="r">Followers</th><th class="r">ER</th><th>Country</th></tr>`;
  }

  const rosterTitle = payload.flags.includeInternalFields
    ? "Detailed roster"
    : payload.flags.showcaseCreators
      ? "At a glance"
      : "Summary roster";

  const bodyRows =
    rowHtml.length > 0
      ? rowHtml.join("")
      : `<tr><td colspan="6" class="pub-empty">No creators on this shortlist.</td></tr>`;

  const blocksHtml = [
    block(`<div class="sec-row"><span class="sec-badge">${esc(payload.roster.sectionNo)}</span><span class="lbl">${esc(rosterTitle)} (${esc(payload.totals.creatorCount)})</span></div>
    <h2 class="sec-title">${esc(rosterTitle)}</h2>
    <p class="roster-note">${esc(payload.roster.note)}</p>`),
    block(
      `<div class="fees">
      <table>
        <thead>${tableHead}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`,
      'data-sl-atomic="true" data-sl-table-split="true"'
    ),
    block(`<div class="company" style="margin-top:28px;">
      ${renderLogo("footer")}
      <div class="addr">${esc(payload.company.legalLine)}<br>${esc(payload.company.address)}</div>
    </div>`),
  ].join("\n");

  return renderFlow({
    pageClass: "page roster-page",
    footerLeft: payload.footer.left,
    footerRight: `${payload.shortlist.number} · Roster`,
    blocksHtml,
  });
}

export function buildShortlistTemplateHtml(
  doc: ShortlistDocument,
  options?: BuildShortlistTemplateHtmlOptions
): string {
  const payload = buildShortlistTemplatePayload(doc);
  const siteOrigin = options?.siteOrigin;
  const forPdf = options?.forPdf ?? false;
  const baseTag = siteOrigin
    ? `<base href="${esc(siteOrigin.replace(/\/$/, ""))}/" />`
    : "";

  const bodyClass = [
    forPdf ? "shortlist-export-print" : "shortlist-export-preview",
    payload.flags.showcaseCreators ? "shortlist-showcase" : "",
    payload.flags.pitchCreators ? "shortlist-pitch" : "",
    "shortlist-report",
  ]
    .filter(Boolean)
    .join(" ");

  const measureFlows = [
    renderCoverFlow(payload),
    renderSummaryFlows(payload),
    ...(payload.flags.showcaseCreators
      ? [renderShowcaseCreatorFlows(payload, doc, siteOrigin)]
      : []),
    renderRosterFlow(payload, doc, siteOrigin),
  ].join("");

  const runtime = buildShortlistPaginationRuntimeScript();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseTag}
<title>${esc(doc.serial)} — ${esc(payload.shortlist.title)} — Thinkway</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${QUOTATION_TEMPLATE_STYLES}${SHORTLIST_TEMPLATE_EXTRA_STYLES}</style>
</head>
<body class="${bodyClass}">
<div id="sl-measure-root">${measureFlows}</div>
<div id="sl-page-root"></div>
<script>${runtime}</script>
</body>
</html>`;
}
