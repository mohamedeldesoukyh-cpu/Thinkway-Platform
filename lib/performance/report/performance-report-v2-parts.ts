import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import {
  formatCompactCount,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import {
  initialsFromCreatorName,
  resolveCreatorAvatarDisplay,
} from "@/lib/performance/creator-avatar";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";
import {
  IMPRESSIONS_SOURCE_LABELS,
  type ImpressionsSource,
} from "@/lib/performance/impressions-forecast-engine";
import {
  REACH_SOURCE_LABELS,
  type ReachSource,
} from "@/lib/performance/reach-forecast-engine";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { resolvePublicationValueScope } from "@/lib/performance/publication-value-scope";

export const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#D62976",
  tiktok: "#111111",
  facebook: "#1877F2",
  youtube: "#EF1B24",
  snapchat: "#A16207",
  twitter: "#111827",
  x: "#111827",
};

export const CARDS_PER_PAGE = 4;

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function platformKey(platform: string | null | undefined): string {
  return (platform ?? "").trim().toLowerCase();
}

export function platformColor(platform: string | null | undefined): string {
  return PLATFORM_COLOR[platformKey(platform)] ?? "#0057FF";
}

export function formatGeneratedDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function flightDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length > 0 ? out : [[]];
}

export function wordmark(size: "sm" | "md" | "lg", theme: "light" | "dark"): string {
  return `<span class="wm wm--${size} wm--${theme}">Think<i>way</i></span>`;
}

export function pageLabel(page: number, total: number): string {
  return `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

export function renderSheet(opts: {
  headLeft: string;
  headRight?: string;
  body: string;
  footLeft: string;
  pageLabel: string;
  id?: string;
}): string {
  return `<section class="sheet"${opts.id ? ` id="${esc(opts.id)}"` : ""}>
  <div class="sheet__head">
    <span class="hm">${esc(opts.headLeft)}</span>
    <span class="hm">${esc(opts.headRight ?? "")}</span>
  </div>
  <div class="sheet__body">${opts.body}</div>
  <div class="sheet__foot">
    <span>${esc(opts.footLeft)}</span>
    <span class="pg">${esc(opts.pageLabel)}</span>
  </div>
</section>`;
}

export function renderSectionHeader(num: string, title: string, subtitle: string): string {
  return `<div class="sec">
  <div class="sec__l">
    <div class="ml ml--blue">Section ${esc(num)}</div>
    <div class="sec__t">${esc(title)}</div>
    <div class="sec__s">${esc(subtitle)}</div>
  </div>
  <div class="sec__n num">${esc(num)}</div>
</div>`;
}

export function renderPlatformIconBox(platform: string): string {
  const title = getReportPlatformIconTitle(platform);
  const uri = getReportPlatformIconDataUri(platform);
  const color = platformColor(platform);
  if (uri) {
    return `<div class="pi" title="${esc(title)}" style="background:${color}"><img src="${uri}" alt="${esc(title)}" style="width:17px;height:17px;object-fit:contain;filter:brightness(0) invert(1)" /></div>`;
  }
  return `<div class="pi" title="${esc(title)}" style="background:${color}"><span style="font-size:9px;font-weight:800;color:#fff">${esc(title.slice(0, 2).toUpperCase())}</span></div>`;
}

export function renderPlatformDot(platform: string): string {
  const uri = getReportPlatformIconDataUri(platform);
  const color = platformColor(platform);
  if (uri) {
    return `<span class="dot" style="background:${color}"><img src="${uri}" alt="" style="width:10px;height:10px;filter:brightness(0) invert(1)" /></span>`;
  }
  return `<span class="dot" style="background:${color}"></span>`;
}

function shortUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

function captionExcerpt(caption: string | null, max = 160): string {
  const text = caption?.trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function renderCreatorAvatar(pub: CampaignPublicationRow): string {
  const name = pub.influencer_name ?? "Creator";
  const embedded = pub.creator_avatar_url?.trim() || "";
  const init = esc(initialsFromCreatorName(name));
  if (embedded.startsWith("data:")) {
    return `<span class="pcard__ava">${init}<img src="${esc(embedded)}" alt="" onerror="this.remove()"/></span>`;
  }

  const display = resolveCreatorAvatarDisplay({
    platform: pub.platform,
    publication_type: pub.publication_type,
    content_url: pub.content_url,
    creator_profile_image_url: pub.creator_profile_image_url,
    influencer_avatar_url: pub.influencer_avatar_url,
    social_profile_picture_url: pub.social_profile_picture_url,
    apify_author_avatar_url: pub.apify_author_avatar_url,
    influencer_name: pub.influencer_name,
  });
  const displayInit = esc(
    initialsFromCreatorName(display.kind === "initials" ? display.name : name)
  );
  if (display.kind === "image") {
    return `<span class="pcard__ava">${displayInit}<img src="${esc(display.url)}" alt="" onerror="this.remove()"/></span>`;
  }
  return `<span class="pcard__ava">${displayInit}</span>`;
}

export function renderPcard(pub: CampaignPublicationRow): string {
  const imageUrl = resolvePublicationContentPreviewUrl(pub);
  const media = imageUrl
    ? `<img src="${esc(imageUrl)}" alt=""/>`
    : `<div class="pcard__ph"><svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v10h14V7H5zm3 2.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM6 16l3.2-3.2a1 1 0 011.4 0L13 15l2.3-2.3a1 1 0 011.4 0L19 15v1H6z"/></svg><span>No preview</span></div>`;

  const chipLabel = pub.publication_type_label || getReportPlatformIconTitle(pub.platform);
  const color = platformColor(pub.platform);
  const iconUri = getReportPlatformIconDataUri(pub.platform);
  const chipIcon = iconUri
    ? `<img src="${iconUri}" alt="" style="width:10px;height:10px;filter:brightness(0) invert(1)" />`
    : "";

  const isAdded = resolvePublicationValueScope(pub) === "added_value";
  const addedBadge = isAdded ? `<span class="pcard__av">Added value</span>` : "";
  const excerpt = captionExcerpt(pub.caption);
  const tags = [pub.hashtags?.trim(), pub.mentions?.trim()].filter(Boolean).join(" ");
  const postUrl = pub.content_url?.trim() || null;
  const urlLabel = shortUrl(postUrl);

  const reachSource = pub.reach_source
    ? REACH_SOURCE_LABELS[(pub.reach_source as ReachSource) ?? "actual"] ?? pub.reach_source
    : null;
  const impressionsSource = pub.impressions_source
    ? IMPRESSIONS_SOURCE_LABELS[(pub.impressions_source as ImpressionsSource) ?? "actual"] ??
      pub.impressions_source
    : null;
  const sourceBits = [
    reachSource ? `Reach: ${reachSource}` : null,
    impressionsSource ? `Impr.: ${impressionsSource}` : null,
  ].filter(Boolean);

  const mediaChrome = `${media}
    <span class="pcard__chip" style="background:${color}">${chipIcon}${esc(chipLabel)}</span>
    ${addedBadge}`;
  const mediaBlock = postUrl
    ? `<a class="pcard__media pcard__media--link" href="${esc(postUrl)}" target="_blank" rel="noopener noreferrer" title="Open post">${mediaChrome}</a>`
    : `<div class="pcard__media">${mediaChrome}</div>`;

  return `<article class="pcard">
  ${mediaBlock}
  <div class="pcard__b">
    <div class="pcard__hd">${renderCreatorAvatar(pub)}<span class="pcard__nm bidi">${esc(pub.influencer_name ?? "Creator")}</span></div>
    <div class="pcard__mt">${esc(pub.platform_label)} · ${esc(formatShortDate(pub.publication_date))}</div>
    ${excerpt ? `<p class="pcard__cap bidi">${esc(excerpt)}</p>` : ""}
    ${tags ? `<p class="pcard__tg bidi">${esc(tags)}</p>` : ""}
    ${
      postUrl
        ? `<div class="pcard__url"><a href="${esc(postUrl)}" target="_blank" rel="noopener noreferrer">Open post · ${esc(urlLabel || postUrl)}</a></div>`
        : ""
    }
    <div class="grow"></div>
    <div class="pcard__foot">
      <div class="pcard__k">
        <div class="k"><span>Views</span><strong>${esc(formatCompactCount(pub.views))}</strong></div>
        <div class="k"><span>Reach</span><strong>${esc(formatCompactCount(pub.reach))}</strong></div>
        <div class="k"><span>Engag.</span><strong>${esc(formatCompactCount(pub.total_engagements))}</strong></div>
        <div class="k k--er"><span>ER</span><strong>${esc(formatPercent(pub.engagement_rate, 1))}</strong></div>
      </div>
      <div class="pcard__k2">
        <div class="k"><span>Impr.</span><strong>${esc(formatCompactCount(pub.impressions))}</strong></div>
        <div class="k"><span>Likes</span><strong>${esc(formatCompactCount(pub.likes))}</strong></div>
        <div class="k"><span>Comm.</span><strong>${esc(formatCompactCount(pub.comments))}</strong></div>
        <div class="k"><span>Shares</span><strong>${esc(formatCompactCount(pub.shares))}</strong></div>
        <div class="k"><span>Saves</span><strong>${esc(formatCompactCount(pub.saves))}</strong></div>
      </div>
      ${sourceBits.length ? `<div class="pcard__src">${esc(sourceBits.join(" · "))}</div>` : ""}
    </div>
  </div>
</article>`;
}

export function renderBars(
  items: Array<{ label: string; value: number; display?: string }>,
  ranked = false
): string {
  const max = Math.max(...items.map((i) => i.value), 1);
  return `<div class="bars${ranked ? " bars--tall" : ""}">${items
    .map((item, index) => {
      const pct = Math.max(2, Math.round((item.value / max) * 100));
      const label = ranked
        ? `<span class="bar__l"><i>${String(index + 1).padStart(2, "0")}</i>${esc(item.label)}</span>`
        : `<span class="bar__l">${esc(item.label)}</span>`;
      return `<div class="bar${ranked ? " bar--rank" : ""}">
        ${label}
        <div class="bar__t"><i class="bar__f" style="width:${pct}%"></i></div>
        <div class="bar__v num">${esc(item.display ?? formatCompactCount(item.value))}</div>
      </div>`;
    })
    .join("")}</div>`;
}

export function renderDividerPage(opts: {
  kicker: string;
  title: string;
  count: string;
  text: string;
  footLeft: string;
  pageLabel: string;
  id?: string;
}): string {
  return `<section class="sheet divider"${opts.id ? ` id="${esc(opts.id)}"` : ""}>
  <div class="divider__in">
    <div class="divider__k">${esc(opts.kicker)}</div>
    <div class="divider__t">${esc(opts.title)}</div>
    <div class="divider__rule"></div>
    <div class="divider__c">${esc(opts.count)}</div>
    <div class="divider__x">${esc(opts.text)}</div>
  </div>
  <div class="sheet__foot" style="border-color:rgba(255,255,255,.14);color:rgba(255,255,255,.5);position:absolute;left:0;right:0;bottom:0">
    <span>${esc(opts.footLeft)}</span>
    <span class="pg" style="color:#fff">${esc(opts.pageLabel)}</span>
  </div>
</section>`;
}

export function renderClosing(footLeft: string, pageLbl: string): string {
  return `<section class="sheet close" id="section-thank-you">
  <div class="close__in">
    ${wordmark("lg", "light")}
    <div class="close__t">THANK YOU</div>
    <div class="close__rule"></div>
    <p class="close__x">Thank you for partnering with Thinkway.</p>
    <div class="close__c">
      <a href="mailto:hello@thinkwaymedia.com" style="color:#fff">hello@thinkwaymedia.com</a>
      <a href="https://www.thinkwaymedia.com" style="color:#fff">www.thinkwaymedia.com</a>
    </div>
  </div>
  <div class="close__f">
    <span>${esc(footLeft)}</span>
    <span>${esc(pageLbl)}</span>
  </div>
</section>`;
}
