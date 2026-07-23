/**
 * Media Plan HTML — client-safe markup builder for in-app preview and HTML download.
 */
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";

import type { CampaignOutputContent } from "../output-types";
import type {
  MediaPlanCampaignContext,
  MediaPlanData,
  MediaPlanDay,
  MediaPlanDayType,
} from "../generators/media-plan";
import {
  MEDIA_PLAN_PRICING_DISCLAIMER,
  formatMediaPlanPreparedForLabel,
  isMediaPlanOpenPublishingSlot,
} from "../generators/media-plan";
import { formatMoney } from "../generators/generator-utils";
import {
  formatDayColumnDate,
  formatWeekRangeLabel,
  parseCampaignStartDate,
} from "../media-plan-week-range";
import { buildMediaPlanStrategyBlocks, type MediaPlanStrategyBlock } from "../media-plan-strategy-blocks";
import { refreshMediaPlanStrategySummaryForDisplay } from "../media-plan-strategy-summary";
import { deriveMediaPlanWeekPhase } from "../media-plan-strategy-narrative";
import { weeklyObjectiveCardFlex, weeklyObjectiveWeightBarWidth } from "../media-plan-week-objectives-layout";
import { renderCreativeConceptsHtml, type MediaPlanCreativeConceptDisplay } from "../media-plan-creative-direction";
import {
  INFLUENCER_CONCEPTS_EXPAND_MESSAGE,
  renderInfluencerConceptsSummaryHtml,
} from "../influencer-concepts";
import {
  defaultMediaPlanPresentation,
  isSectionVisible,
  MEDIA_PLAN_SECTION_TOGGLE_MESSAGE,
  resolveMediaPlanSectionKey,
  type MediaPlanPresentationConfig,
  type MediaPlanSectionKey,
} from "../media-plan-presentation";
import { MEDIA_PLAN_BRAND, MEDIA_PLAN_AD_TYPE_COLORS, MEDIA_PLAN_DAY_TYPE_COLORS, MEDIA_PLAN_WEEK_PHASE_COLORS } from "../components/media-plan-brand";
import {
  platformIconSvgHtml,
  resolvePlatformBarBackground,
} from "../platform-brand";
import { mergeMediaPlanContext } from "../components/media-plan-context-merge";
import {
  resolveMediaPlanAvatarSrc,
  resolveMediaPlanCreatorProfileHref,
  type MediaPlanAvatarFields,
} from "./media-plan-html-avatars";
import { isMediaPlanContent } from "./media-plan-content";
import { MEDIA_PLAN_PAGE } from "./media-plan-page";
import {
  renderThinkwayReportLogoHtml,
  THINKWAY_REPORT_LOGO_STYLES,
  type ThinkwayReportLogoSrcs,
} from "@/lib/reports/document/thinkway-report-logo";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const GENERIC_OPERATIONAL_TYPES = new Set([
  "Stories",
  "Paid amplification",
  "Reporting",
  "Stories slot",
  "Performance review",
]);

const E_MEDIA_PLAN_CSS = `
  @page { size: 1280px 780px; margin: 0; }
  @page calendarpage { size: 1280px 860px; margin: 0; }
  @page strategypage { size: 1280px 900px; margin: 0; }
  * { box-sizing: border-box; margin:0; padding:0; }
  html, body { width:1280px; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    color: #0B0F1A;
    background: #FFFFFF;
  }
  :root {
    --blue: #0057FF;
    --blue400: #1A6FFF;
    --blue300: #3D8BFF;
    --navy: #060810;
    --lavender: #E8EFFE;
    --ink: #0B0F1A;
    --muted: #6B7280;
    --green: #0C9D57;
    --green-bg: #E7F8EF;
    --amber: #D97706;
    --amber-bg: #FDF3E3;
    --red: #DC2626;
    --red-bg: #FCEBEA;
    --purple: #7C3AED;
    --purple-bg: #F1EAFE;
  }
  .page {
    width: 1280px;
    height: 780px;
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .mono { font-family: 'Courier New', monospace; }

  .pg-header {
    display:flex; align-items:center; justify-content:space-between;
    padding: 28px 56px 18px 56px;
    border-bottom: 1px solid #E8EFFE;
  }
  .pg-header .brandmark { display:flex; align-items:center; gap:10px; }
  .pg-header .brandmark img { height:22px; display:block; }
  .pg-header .pagelabel { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:600; }
  .pg-header .pagetitle { font-size:20px; font-weight:800; color:var(--ink); }
  .pg-header-right { display:flex; align-items:flex-start; gap:10px; }
  .strat-head-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .pg-footer {
    position:absolute; bottom:0; left:0; right:0;
    display:flex; align-items:center; justify-content:space-between;
    padding: 14px 56px; font-size:10px; color:var(--muted);
    border-top:1px solid #E8EFFE;
  }
  .pg-footer .pno { font-family:'Courier New',monospace; }

  .cover {
    background-color:#060810;
    background-image: radial-gradient(circle at 20% 15%, rgba(26,111,255,.35), transparent 45%), linear-gradient(145deg,#0040CC,#0057FF 40%,#1A6FFF 70%,#0048DD);
    color:#fff; height:780px; width:1280px; position:relative; overflow:hidden;
  }
  .cover-grid {
    position:absolute; inset:0;
    background-image: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 26px 26px; opacity:.5;
  }
  .cover-inner { position:relative; z-index:2; padding:56px 64px; height:100%; }
  .cover-top { display:flex; align-items:center; justify-content:space-between; }
  .cover-top img.logo { height:30px; }
  .cover-pill {
    background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.25);
    padding:7px 16px; border-radius:999px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; font-weight:600;
  }
  .cover-mid { margin-top:44px; }
  .cover-mid .eyebrow { font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.7); font-weight:700; margin-bottom:14px; }
  .cover-mid h1 { font-size:60px; font-weight:800; line-height:1.02; letter-spacing:-.02em; }
  .cover-mid .sub { margin-top:16px; font-size:15.5px; color:rgba(255,255,255,.82); max-width:660px; line-height:1.5; }
  .meta-row { display:flex; gap:44px; margin-top:26px; padding-top:22px; border-top:1px solid rgba(255,255,255,.16); }
  .meta-item .lbl { font-size:11px; text-transform:uppercase; letter-spacing:.07em; color:rgba(255,255,255,.55); font-weight:700; margin-bottom:5px; }
  .meta-item .val { font-size:15px; font-weight:700; color:#fff; }
  .cover-foot { position:absolute; left:64px; right:64px; bottom:50px; }
  .cover-bottom { display:flex; gap:20px; align-items:stretch; }
  .cost-hero {
    background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); border-radius:20px;
    padding:22px 28px; min-width:320px;
  }
  .cost-hero .lbl { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:rgba(255,255,255,.65); font-weight:700; }
  .cost-hero .val { font-size:36px; font-weight:800; margin-top:8px; letter-spacing:-.01em; }
  .cost-hero .note { font-size:11.5px; color:rgba(255,255,255,.55); margin-top:6px; }
  .stat-row { display:flex; gap:14px; flex:1; }
  .stat-box {
    flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); border-radius:16px;
    padding:16px 20px; display:flex; flex-direction:column; justify-content:center;
  }
  .stat-box .n { font-size:26px; font-weight:800; }
  .stat-box .l { font-size:11.5px; color:rgba(255,255,255,.65); margin-top:3px; font-weight:600; }
  .cover-legend { margin-top:22px; }
  .cover-legend .lt { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:rgba(255,255,255,.6); font-weight:700; margin-bottom:10px; }
  .legend-grid { display:grid; grid-template-columns: repeat(5, auto); gap:10px 22px; }
  .legend-item { display:flex; align-items:center; gap:7px; font-size:12px; color:rgba(255,255,255,.88); font-weight:500; }
  .legend-item .dot { width:9px; height:9px; border-radius:3px; display:inline-block; flex-shrink:0; }

  .strat-body { padding:22px 56px 72px 56px; max-height:calc(780px - 118px); overflow:hidden; box-sizing:border-box; }
  .page.creative-direction-page .strat-body { max-height:none; overflow:visible; padding-bottom:72px; }
  .strat-row { display:grid; gap:16px; margin-bottom:14px; page-break-inside:avoid; min-width:0; }
  .strat-row.cols-2 { grid-template-columns: 1fr 1fr; }
  .strat-row.cols-4 { grid-template-columns: repeat(4, 1fr); }
  .strat-card { background:#F7F9FE; border:1px solid #E8EFFE; border-radius:16px; padding:20px 22px; page-break-inside:avoid; overflow:visible; min-width:0; box-sizing:border-box; }
  .strat-card.full { width:100%; border-color:#D6E4FF; box-shadow:0 1px 0 rgba(0,87,255,0.06); }
  .strat-row.cols-2 .strat-card { max-height:520px; overflow:hidden; }
  .strat-row.cols-2 .strat-card.strat-card-tier-mix { max-height:none; overflow:visible; }
  .page.creative-direction-page .strat-row.cols-2 .strat-card { max-height:none; overflow:visible; }
  .strat-card-inner-scroll { max-height:640px; overflow-y:auto; overflow-x:hidden; padding-right:4px; }
  .strat-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .strat-title { font-size:14px; font-weight:800; color:var(--ink); display:flex; align-items:center; gap:8px; }
  .strat-title .ic { width:22px; height:22px; border-radius:7px; background:var(--blue); display:inline-block; flex-shrink:0; }
  .conf-pill { display:flex; align-items:center; gap:6px; font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:4px 10px; border-radius:999px; }
  .conf-pill.high { background:var(--green-bg); color:var(--green); }
  .conf-pill.medium { background:var(--amber-bg); color:var(--amber); }
  .conf-pill.low { background:var(--red-bg); color:var(--red); }
  .conf-note { font-size:10.5px; color:var(--muted); margin-top:3px; margin-bottom:12px; font-style:italic; }
  .strat-body-text { font-size:11.8px; line-height:1.6; color:#3A4254; }
  .strat-evidence { margin-top:12px; padding-top:10px; border-top:1px solid #E1E9FB; font-size:10px; color:var(--muted); font-weight:600; }
  .tag-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
  .tag-chip { font-size:10.5px; font-weight:700; color:var(--blue); background:var(--lavender); padding:4px 10px; border-radius:7px; }

  .wbar-row { display:flex; align-items:center; gap:10px; padding:6px 0; }
  .wbar-label { width:34px; font-size:11px; font-weight:800; color:var(--ink); flex-shrink:0; }
  .wbar-track { flex:1; height:9px; background:#E1E9FB; border-radius:6px; overflow:hidden; }
  .wbar-fill { height:100%; border-radius:6px; background:var(--blue); }
  .wbar-val { width:32px; text-align:right; font-size:11px; font-weight:800; color:var(--ink); }

  .tier-row { display:flex; gap:10px; margin:10px 0 12px 0; }
  .tier-box { flex:1; background:#fff; border:1px solid #E1E9FB; border-radius:12px; padding:12px 10px; text-align:center; }
  .tier-box .n { font-size:22px; font-weight:800; color:var(--blue); }
  .tier-box .l { font-size:10px; color:var(--muted); font-weight:700; margin-top:2px; text-transform:uppercase; letter-spacing:.03em; }

  .obj-row { display:flex; gap:8px; align-items:stretch; margin-bottom:0; page-break-inside:avoid; width:100%; max-width:100%; overflow:hidden; box-sizing:border-box; }
  .obj-card { background:#fff; border:1px solid #E1E9FB; border-radius:14px; padding:12px 14px; border-left-width:4px; min-width:0; flex:1 1 0; page-break-inside:avoid; box-sizing:border-box; overflow:hidden; }
  .obj-top { display:flex; align-items:center; justify-content:space-between; gap:6px; }
  .obj-week { font-size:12px; font-weight:800; color:var(--blue); flex-shrink:0; }
  .obj-pct { font-size:14px; font-weight:800; color:var(--ink); flex-shrink:0; }
  .obj-phase { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-top:2px; }
  .obj-weight-bar { height:4px; background:#E1E9FB; border-radius:3px; margin-top:8px; overflow:hidden; }
  .obj-weight-fill { height:100%; border-radius:3px; }
  .obj-desc { font-size:10px; color:#3A4254; line-height:1.45; margin-top:8px; overflow-wrap:anywhere; word-break:break-word; }
  .obj-desc + .obj-desc { margin-top:6px; color:var(--muted); }

  .rec-item { display:flex; align-items:flex-start; gap:12px; padding:11px 0; border-bottom:1px solid #EDF2FC; }
  .rec-item:last-child { border-bottom:none; }
  .impact-badge { font-size:9px; font-weight:800; padding:3px 8px; border-radius:6px; flex-shrink:0; letter-spacing:.03em; margin-top:1px; }
  .impact-badge.high { background:var(--blue); color:#fff; }
  .impact-badge.medium { background:var(--lavender); color:var(--blue); }
  .rec-text .t { font-size:12px; font-weight:700; color:var(--ink); }
  .rec-text .d { font-size:10.8px; color:var(--muted); margin-top:2px; line-height:1.45; }

  .type-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .type-card { background:#fff; border:1px solid #E1E9FB; border-radius:12px; padding:12px 14px; min-width:0; overflow:visible; }
  .type-card .t { font-size:11.5px; font-weight:700; color:var(--ink); }
  .type-card .d { font-size:10.3px; color:var(--muted); margin-top:4px; line-height:1.45; overflow-wrap:anywhere; word-break:break-word; }

  .cd-concept { padding:10px 0; border-bottom:1px solid #EDF2FC; page-break-inside:avoid; }
  .cd-concept:last-child { border-bottom:none; }
  .cd-source { display:inline-block; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--blue); background:var(--lavender); padding:3px 8px; border-radius:6px; margin-bottom:8px; }
  .cd-locale { margin-top:6px; }
  .cd-locale-ar { margin-top:10px; padding-top:10px; border-top:1px dashed #E1E9FB; }
  .cd-field { display:flex; flex-direction:column; gap:2px; margin-bottom:8px; }
  .cd-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
  .cd-value { font-size:11px; line-height:1.5; color:#3A4254; overflow-wrap:anywhere; word-break:break-word; white-space:normal; }

  .ic-collapsed-card { margin-top:12px; padding:12px 14px; background:#fff; border:1px dashed #C5D8FF; border-radius:12px; }
  .ic-collapsed-card--interactive { cursor:pointer; transition:border-color .15s ease, background-color .15s ease; }
  .ic-collapsed-card--interactive:hover { border-color:#0057FF; background:#F7FAFF; }
  .ic-collapsed-card--interactive:focus-visible { outline:2px solid #0057FF; outline-offset:2px; }
  .ic-collapsed-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .ic-collapsed-title { font-size:11px; font-weight:800; color:var(--ink); }
  .ic-collapsed-badge { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--blue); background:var(--lavender); padding:3px 8px; border-radius:6px; }
  .ic-preview-list { list-style:none; margin:0; padding:0; }
  .ic-preview-list .ic-summary-row { padding:8px 0; border-bottom:1px solid #E8EFFE; }
  .ic-preview-list .ic-summary-row:last-child { border-bottom:none; }
  .ic-summary-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }
  .ic-preview-title { font-size:11px; font-weight:800; color:var(--ink); }
  .ic-preview-ar { display:block; font-size:10.5px; color:var(--muted); margin-bottom:4px; }
  .ic-status-badge { font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:2px 7px; border-radius:5px; background:var(--lavender); color:var(--blue); }
  .ic-status-approved { background:var(--green-bg); color:var(--green); }
  .ic-status-uploaded { background:var(--amber-bg); color:var(--amber); }
  .ic-status-ai { background:var(--purple-bg); color:var(--purple); }
  .ic-summary-meta { font-size:10px; line-height:1.45; color:#3A4254; }
  .ic-meta-tags, .ic-meta-hook { display:block; margin-top:2px; color:var(--muted); font-weight:600; }
  .ic-summary-row--full { padding:10px 0; border-bottom:1px solid #E8EFFE; }
  .ic-summary-fields { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin-top:6px; }
  .ic-field .ic-label { font-size:9px; font-weight:800; text-transform:uppercase; color:var(--muted); display:block; }
  .ic-field .ic-value { font-size:10px; color:#3A4254; }
  .ic-preview-list li { display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding:4px 0; border-bottom:1px solid #EDF2FC; font-size:10.5px; }
  .ic-preview-list li:last-child { border-bottom:none; }
  .ic-preview-title { font-weight:700; color:var(--ink); overflow-wrap:anywhere; }
  .ic-preview-src { font-size:9px; font-weight:700; text-transform:uppercase; color:var(--muted); flex-shrink:0; }
  .ic-more { margin-top:6px; font-size:9.5px; color:var(--muted); font-style:italic; }
  .ic-lang-tabs { display:flex; gap:4px; margin:6px 0; }
  .ic-lang-tab { font-size:9px; font-weight:700; padding:3px 8px; border-radius:6px; border:1px solid #E1E9FB; background:#fff; color:var(--muted); cursor:pointer; }
  .ic-lang-tab.on { background:var(--blue); color:#fff; border-color:var(--blue); }
  .ic-locale-panel { display:none; }
  .ic-locale-stack:not([data-active-lang]) .ic-locale-en, .ic-locale-stack[data-active-lang="en"] .ic-locale-en { display:block; }
  .ic-locale-stack[data-active-lang="ar"] .ic-locale-ar { display:block; }
  .ic-locale-stack[data-active-lang="ar"] .ic-locale-en { display:none; }
  .ic-meta-item { display:block; font-size:10px; color:#3A4254; margin-top:2px; }
  .ic-meta-label { font-weight:700; color:var(--muted); }

  .mt-citation { background:#fff; border:1px solid #E1E9FB; border-radius:10px; padding:10px 12px; margin-bottom:8px; }
  .mt-citation-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  .mt-citation-driver { font-size:11px; font-weight:800; color:var(--ink); }
  .mt-citation-conf { font-size:9px; font-weight:800; color:var(--green); background:var(--green-bg); padding:2px 6px; border-radius:999px; }
  .mt-citation-evidence { font-size:9.5px; color:var(--muted); font-weight:600; margin-bottom:4px; }
  .mt-citation-reason { font-size:10.5px; color:#3A4254; line-height:1.45; }
  .mt-citation-impact { font-size:9.5px; color:var(--blue); font-weight:700; margin-top:4px; }

  .why-rationale { margin-top:10px; border-top:1px dashed #E1E9FB; padding-top:8px; }
  .why-rationale summary { font-size:10px; font-weight:800; color:var(--blue); cursor:pointer; list-style:none; }
  .why-rationale summary::-webkit-details-marker { display:none; }
  .why-rationale ul { margin-top:6px; padding-left:14px; }
  .why-rationale li { font-size:10px; color:#3A4254; line-height:1.45; margin-bottom:3px; }

  .cd-lang-tabs { display:flex; gap:4px; margin-bottom:8px; }
  .cd-lang-tab { font-size:9px; font-weight:700; padding:3px 8px; border-radius:6px; border:1px solid #E1E9FB; background:#fff; color:var(--muted); cursor:pointer; }
  .cd-lang-tab.on { background:var(--blue); color:#fff; border-color:var(--blue); }
  .cd-locale { display:none; }
  .cd-concept[data-active-lang="en"] .cd-locale-en, .cd-concept:not([data-active-lang]) .cd-locale-en { display:block; }
  .cd-concept[data-active-lang="ar"] .cd-locale-ar { display:block; }
  .cd-concept[data-active-lang="ar"] .cd-locale-en { display:none; }

  .footnote-bar { margin-top:14px; padding:11px 16px; background:var(--lavender); border-radius:10px; font-size:10.8px; color:var(--blue); font-weight:600; }

  .cal-body { padding:16px 56px 0 56px; }
  .weekblock { margin-bottom:10px; }
  .weekblock-head { display:flex; align-items:baseline; gap:12px; margin-bottom:6px; }
  .weeklabel {
    background:var(--blue); color:#fff; font-size:11.5px; font-weight:800; letter-spacing:.05em;
    padding:4px 13px; border-radius:999px;
  }
  .weekrange { font-size:11px; color:var(--muted); font-weight:600; }
  .weekphase { font-size:10.5px; color:var(--blue); font-weight:700; }
  .weekgrid { display:grid; grid-template-columns: repeat(7, 1fr); gap:8px; align-items:stretch; }
  .daycol { background:#F7F9FE; border:1px solid #E8EFFE; border-radius:12px; padding:7px; display:flex; flex-direction:column; }
  .daycol-head { display:flex; justify-content:space-between; align-items:baseline; padding:1px 2px 5px 2px; border-bottom:1px solid #E1E9FB; margin-bottom:5px; }
  .dname { font-size:9.5px; font-weight:800; color:var(--blue); letter-spacing:.04em; }
  .ddate { font-size:8.5px; color:var(--muted); font-weight:600; }
  .daycol-body { display:flex; flex-direction:column; gap:5px; flex:1; }
  .empty-day { font-size:9px; color:#B8C2D9; text-align:center; margin-top:12px; }
  .ccard { background:#fff; border:1px solid #E1E9FB; border-radius:7px; padding:5px 6px; }
  .ccard-top { display:flex; align-items:center; gap:5px; margin-bottom:4px; }
  .cav {
    width:16px; height:16px; border-radius:50%; background:var(--lavender);
    color:var(--blue); font-size:6.6px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0;
    letter-spacing:-.02em;
    object-fit: cover;
  }
  a.cav-link {
    display:inline-flex;
    flex-shrink:0;
    text-decoration:none;
    color:inherit;
    border-radius:50%;
    line-height:0;
  }
  a.cav-link:hover .cav { opacity:0.85; }
  .cinfo { min-width:0; }
  .cname { font-size:8.3px; font-weight:700; color:var(--ink); line-height:1.15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:92px; }
  .chandle { font-size:6.8px; color:var(--muted); font-weight:500; }
  .cchips { display:flex; flex-direction:column; gap:2.5px; }
  .chip {
    display:flex; align-items:center; gap:4px;
    font-size:7.4px; font-weight:500; color:var(--muted); white-space:nowrap;
  }
  .chip::before {
    content:""; width:5px; height:5px; border-radius:50%; background:var(--c); flex-shrink:0; display:inline-block;
  }

  .ops-body { padding:20px 56px 56px 56px; display:grid; grid-template-columns: 1fr 1fr; gap:16px; max-height:680px; overflow:hidden; box-sizing:border-box; }
  .ops-card { background:#F7F9FE; border:1px solid #E8EFFE; border-radius:16px; padding:18px 20px; overflow:hidden; min-width:0; max-height:300px; box-sizing:border-box; }
  .ops-card h3 { font-size:14px; font-weight:800; color:var(--ink); margin-bottom:14px; display:flex; align-items:center; gap:8px; }
  .ops-card h3 .ic { width:22px; height:22px; border-radius:7px; background:var(--blue); display:inline-block; }
  .wave-row { display:flex; gap:12px; }
  .wave-card { flex:1; background:#fff; border:1px solid #E1E9FB; border-radius:12px; padding:16px; }
  .wave-tag { font-size:10px; font-weight:800; color:var(--blue); text-transform:uppercase; letter-spacing:.06em; }
  .wave-title { font-size:14px; font-weight:700; margin-top:6px; color:var(--ink); }
  .wave-span { font-size:11px; color:var(--muted); margin-top:4px; font-weight:600; }
  .mrow { display:flex; gap:10px; align-items:baseline; padding:6px 0; border-bottom:1px solid #EDF2FC; min-width:0; }
  .mrow:last-child { border-bottom:none; }
  .mtag { font-size:10px; font-weight:800; color:#fff; background:var(--blue300); padding:3px 9px; border-radius:999px; flex-shrink:0; }
  .mdesc { font-size:11px; color:var(--ink); font-weight:500; min-width:0; overflow-wrap:anywhere; word-break:break-word; flex:1; }
  .pbar-row { display:flex; align-items:center; gap:10px; padding:8px 0; }
  .pbar-label { width:110px; font-size:11.5px; font-weight:700; color:var(--ink); flex-shrink:0; display:flex; align-items:center; gap:6px; }
  .pbar-icon { display:inline-flex; flex-shrink:0; line-height:0; }
  .pbar-track { flex:1; height:10px; background:#E8EFFE; border-radius:6px; overflow:hidden; }
  .pbar-fill { height:100%; border-radius:6px; }
  .pbar-val { width:34px; text-align:right; font-size:12px; font-weight:800; color:var(--ink); }
  .deprow { display:flex; flex-direction:column; gap:3px; padding:10px 0; border-bottom:1px solid #EDF2FC; }
  .deprow:last-child { border-bottom:none; }
  .depwho { font-size:12px; font-weight:700; color:var(--ink); }
  .depdesc { font-size:11px; color:var(--muted); }

  .tbl-body { padding:20px 40px 28px 40px; overflow:visible; }
  table.dl-table { width:100%; border-collapse:collapse; table-layout:fixed; }
  table.dl-table thead th {
    background:var(--navy); color:#fff; font-size:10px; text-transform:uppercase; letter-spacing:.05em;
    text-align:left; padding:10px 10px; font-weight:700; vertical-align:top;
  }
  table.dl-table thead th:nth-child(1) { width:17%; }
  table.dl-table thead th:nth-child(2) { width:30%; }
  table.dl-table thead th:nth-child(3) { width:15%; }
  table.dl-table thead th:nth-child(4) { width:19%; }
  table.dl-table thead th:nth-child(5) { width:19%; }
  table.dl-table tbody td {
    font-size:10.5px; padding:9px 10px; border-bottom:1px solid #EDF2FC; color:var(--ink); vertical-align:top;
    overflow-wrap:anywhere; word-break:break-word; white-space:normal;
  }
  table.dl-table tbody tr:nth-child(even) { background:#F7F9FE; }
  .dl-creator { display:flex; align-items:flex-start; gap:8px; min-width:0; }
  .dl-creator .cav { width:22px; height:22px; font-size:8px; flex-shrink:0; }
  .dl-creator .cav-link { width:22px; height:22px; flex-shrink:0; }
  .dl-creator-text { min-width:0; overflow:hidden; }
  .dl-name { font-weight:700; overflow-wrap:anywhere; }
  .dl-handle { font-size:9px; color:var(--muted); font-weight:500; display:block; overflow-wrap:anywhere; }
  .dl-deliv { color:var(--muted); font-size:9.5px; line-height:1.45; }

  .close {
    background-color:#060810;
    background-image: radial-gradient(circle at 80% 85%, rgba(26,111,255,.3), transparent 45%), linear-gradient(145deg,#0040CC,#0057FF 40%,#1A6FFF 70%,#0048DD);
    height:780px; width:1280px; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
  }
  .close img.logo { height:34px; margin-bottom:36px; }
  .close h2 { font-size:38px; font-weight:800; }
  .close p { margin-top:14px; font-size:14px; color:rgba(255,255,255,.75); }
  .close .contact { margin-top:44px; font-size:12px; color:rgba(255,255,255,.6); }
`;

export type BuildMediaPlanHtmlOptions = {
  contextOverride?: MediaPlanCampaignContext;
  logoSrcs?: ThinkwayReportLogoSrcs;
  /** Route avatar src through /api/creators/avatar for in-app preview (live CDN + OpenGraph fallback). */
  browserAvatarProxy?: boolean;
  /** Section visibility, export mode, and client/internal view. */
  presentation?: MediaPlanPresentationConfig;
  /** Internal preview only — render hide/show toggles on section headers. */
  showSectionToggles?: boolean;
};

function mediaPlanLogo(
  options: BuildMediaPlanHtmlOptions | undefined,
  variant: "header" | "cover" | "closing",
  theme: "dark" | "light"
): string {
  return renderThinkwayReportLogoHtml({
    variant,
    theme,
    ...options?.logoSrcs,
  });
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageNo(page: number): string {
  return String(page).padStart(2, "0");
}

function footerBrandLabel(context: MediaPlanCampaignContext | undefined, fallback: string): string {
  const brand = context?.brandName?.trim();
  return `Thinkway Media Plan · ${brand || fallback}`;
}

function typesForDay(day: MediaPlanDay): string[] {
  const primary = day.serviceTypes?.length
    ? day.serviceTypes
    : day.serviceType?.trim()
      ? [day.serviceType]
      : [];
  const additional =
    day.additionalDeliverables
      ?.filter((entry) => !entry.isMirror && !entry.isCompanion)
      .map((entry) => entry.serviceType)
      .filter((type): type is string => Boolean(type?.trim())) ?? [];
  return [...new Set([...primary, ...additional])];
}

function collectLegendTypes(data: MediaPlanData): string[] {
  const fromDays = data.weeks.flatMap((week) => week.days.flatMap((day) => typesForDay(day)));
  const fromData = data.serviceTypes?.length ? data.serviceTypes : fromDays;
  return [...new Set(fromData)].filter(
    (type): type is string => Boolean(type?.trim() && !GENERIC_OPERATIONAL_TYPES.has(type))
  );
}

function buildAdTypeColorMap(types: string[]): Map<string, string> {
  return new Map(
    types.map((type, index) => [
      type,
      MEDIA_PLAN_AD_TYPE_COLORS[index % MEDIA_PLAN_AD_TYPE_COLORS.length]!,
    ])
  );
}

function dayTypeColor(type: MediaPlanDayType): string {
  return MEDIA_PLAN_DAY_TYPE_COLORS[type];
}

function platformBarColor(platform: string, index: number): string {
  return resolvePlatformBarBackground(platform, index);
}

function platformBarsHtml(bars: Array<{ platform: string; percentage: number }>): string {
  if (!bars.length) return "";
  const maxPct = Math.max(...bars.map((entry) => entry.percentage), 1);
  return bars
    .map((entry, index) => {
      const color = platformBarColor(entry.platform, index);
      const width = Math.round((entry.percentage / maxPct) * 100);
      const icon = platformIconSvgHtml(entry.platform, 14);
      return `<div class="pbar-row">
          <div class="pbar-label"><span class="pbar-icon">${icon}</span>${escapeHtml(entry.platform)}</div>
          <div class="pbar-track"><div class="pbar-fill" style="width:${width}%;background:${color}"></div></div>
          <div class="pbar-val">${entry.percentage}%</div>
        </div>`;
    })
    .join("");
}

function platformAllocationBars(data: MediaPlanData): Array<{ platform: string; percentage: number }> {
  const entries = Object.entries(data.platformAllocation);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([platform, count]) => ({
    platform,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

function sectionToggleHtml(
  sectionKey: MediaPlanSectionKey | undefined,
  options?: BuildMediaPlanHtmlOptions
): string {
  if (!sectionKey || !options?.showSectionToggles) return "";
  return `<button type="button" class="mp-sec-toggle" data-mp-section="${sectionKey}" aria-label="Hide section" title="Hide section">
    <span class="mp-sec-toggle-icon" aria-hidden="true">◉</span>
  </button>`;
}

function renderPgHeader(
  pageLabel: string,
  pageTitle: string,
  options?: BuildMediaPlanHtmlOptions,
  sectionKey?: MediaPlanSectionKey
): string {
  const toggle = sectionToggleHtml(sectionKey ?? resolveMediaPlanSectionKey(pageTitle), options);
  return `<div class="pg-header">
    <div class="brandmark">${mediaPlanLogo(options, "header", "light")}</div>
    <div class="pg-header-right">
      ${toggle}
      <div style="text-align:right;">
        <div class="pagelabel">${escapeHtml(pageLabel)}</div>
        <div class="pagetitle">${escapeHtml(pageTitle)}</div>
      </div>
    </div>
  </div>`;
}

function renderPgFooter(
  context: MediaPlanCampaignContext | undefined,
  fallbackTitle: string,
  page: number
): string {
  return `<div class="pg-footer">
    <span>${escapeHtml(footerBrandLabel(context, fallbackTitle))}</span>
    <span class="pno">${pageNo(page)}</span>
  </div>`;
}

function renderAvatar(
  fields: MediaPlanAvatarFields & Pick<MediaPlanDay, "creator" | "shortName">,
  options?: BuildMediaPlanHtmlOptions
): string {
  const initials = escapeHtml(initialsFromCreatorName(fields.creator ?? fields.shortName ?? "?"));
  const href = resolveMediaPlanCreatorProfileHref(fields);
  const src = resolveMediaPlanAvatarSrc(fields, options);

  const inner = src
    ? `<img class="cav" src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'cav',textContent:'${initials}'}))" />`
    : `<span class="cav">${initials}</span>`;

  if (!href) return inner;

  return `<a class="cav-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="Open creator profile">${inner}</a>`;
}

function renderChips(types: string[], typeColorMap: Map<string, string>, fallback: string): string {
  if (!types.length) return "";
  return types
    .map(
      (type) =>
        `<span class="chip" style="--c:${escapeHtml(typeColorMap.get(type) ?? fallback)}">${escapeHtml(type)}</span>`
    )
    .join("");
}

function renderCreatorCard(
  name: string,
  day: Pick<
    MediaPlanDay,
    "avatarUrl" | "creator" | "shortName" | "handle" | "profileUrl" | "platform"
  >,
  types: string[],
  typeColorMap: Map<string, string>,
  fallback: string,
  options?: BuildMediaPlanHtmlOptions
): string {
  const displayName = escapeHtml(name);
  const avatarFields = { ...day, creator: name, shortName: name };
  const handle = day.handle?.trim();
  const handleHtml = handle
    ? `<div class="chandle">@${escapeHtml(handle.replace(/^@/, ""))}</div>`
    : "";

  return `<div class="ccard">
    <div class="ccard-top">
      ${renderAvatar(avatarFields, options)}
      <div class="cinfo">
        <div class="cname" dir="auto">${displayName}</div>
        ${handleHtml}
      </div>
    </div>
    <div class="cchips">${renderChips(types, typeColorMap, fallback)}</div>
  </div>`;
}

function renderDayColumn(
  day: MediaPlanDay,
  dayIndex: number,
  weekNum: number,
  campaignStart: Date,
  typeColorMap: Map<string, string>,
  options?: BuildMediaPlanHtmlOptions
): string {
  const fallback = dayTypeColor(day.type);
  const dateStr = day.dateLabel ?? formatDayColumnDate(campaignStart, weekNum, dayIndex);
  const dayAbbr = DAY_ABBR[dayIndex] ?? day.day;

  let cards = "";
  if (day.creator) {
    const primaryTypes =
      day.serviceTypes?.length
        ? day.serviceTypes
        : day.serviceType?.trim()
          ? [day.serviceType]
          : typesForDay(day);
    cards += renderCreatorCard(
      day.shortName ?? day.creator,
      day,
      primaryTypes,
      typeColorMap,
      fallback,
      options
    );
    for (const entry of day.additionalDeliverables ?? []) {
      if (entry.isMirror || entry.isCompanion) continue;
      const entryTypes =
        entry.serviceTypes?.length
          ? entry.serviceTypes
          : entry.serviceType?.trim()
            ? [entry.serviceType]
            : [];
      cards += renderCreatorCard(
        entry.shortName ?? entry.creator ?? "Creator",
        entry,
        entryTypes,
        typeColorMap,
        fallback,
        options
      );
    }
  } else {
    const types = typesForDay(day);
    if (types.length) {
      cards = renderCreatorCard(
        day.shortName ?? day.label ?? "Slot",
        day,
        types,
        typeColorMap,
        fallback,
        options
      );
    } else if (!isMediaPlanOpenPublishingSlot(day)) {
      cards = `<div class="ccard"><div class="cchips"><span class="chip" style="--c:${escapeHtml(fallback)}">${escapeHtml(day.label)}</span></div></div>`;
    }
  }

  const body = cards || `<div class="empty-day">—</div>`;

  return `<div class="daycol">
    <div class="daycol-head">
      <span class="dname">${escapeHtml(dayAbbr.toUpperCase())}</span>
      <span class="ddate">${escapeHtml(dateStr)}</span>
    </div>
    <div class="daycol-body">${body}</div>
  </div>`;
}

function renderWeekBlock(
  week: MediaPlanData["weeks"][number],
  data: MediaPlanData,
  typeColorMap: Map<string, string>,
  options?: BuildMediaPlanHtmlOptions
): string {
  const campaignStart = parseCampaignStartDate(data.campaignStartDate);
  const dayCols = week.days
    .map((day, index) =>
      renderDayColumn(day, index, week.week, campaignStart, typeColorMap, options)
    )
    .join("");

  return `<div class="weekblock">
    <div class="weekblock-head">
      <span class="weeklabel">Week ${week.week}</span>
      <span class="weekrange">${escapeHtml(formatWeekRangeLabel(campaignStart, week.week))}</span>
      <span class="weekphase">${escapeHtml(week.phase)} · Wave ${week.wave}</span>
    </div>
    <div class="weekgrid">${dayCols}</div>
  </div>`;
}

function renderMetaRow(context?: MediaPlanCampaignContext): string {
  const fields = [
    context?.groupName ? { label: "Group", value: context.groupName } : null,
    context?.clientName ? { label: "Legal Entity", value: context.clientName } : null,
    context?.brandName ? { label: "Brand", value: context.brandName } : null,
    context?.agencyName ? { label: "Agency", value: context.agencyName } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (!fields.length) return "";

  return `<div class="meta-row">${fields
    .map(
      ({ label, value }) =>
        `<div class="meta-item"><div class="lbl">${escapeHtml(label)}</div><div class="val">${escapeHtml(value)}</div></div>`
    )
    .join("")}</div>`;
}

function renderCoverLegend(data: MediaPlanData): string {
  const legendTypes = collectLegendTypes(data);
  if (!legendTypes.length) return "";

  const typeColorMap = buildAdTypeColorMap(legendTypes);
  const items = legendTypes
    .map(
      (type) =>
        `<div class="legend-item"><span class="dot" style="background:${escapeHtml(typeColorMap.get(type) ?? MEDIA_PLAN_BRAND.muted)}"></span>${escapeHtml(type)}</div>`
    )
    .join("");

  return `<div class="cover-legend">
    <div class="lt">Ad Types</div>
    <div class="legend-grid">${items}</div>
  </div>`;
}

function renderCoverPage(
  content: CampaignOutputContent,
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  options?: BuildMediaPlanHtmlOptions
): string {
  const includeCampaignCost = options?.presentation?.includeCampaignCost !== false;
  const cost = includeCampaignCost ? context?.campaignCost : undefined;
  const costHero = cost
    ? `<div class="cost-hero">
        <div class="lbl">Campaign Cost</div>
        <div class="val">${escapeHtml(formatMoney(cost.amount, cost.currency))}</div>
        <div class="note">${escapeHtml(MEDIA_PLAN_PRICING_DISCLAIMER)}</div>
      </div>`
    : "";

  const adSlots = data.postingSlotCount ?? data.creatorCount;
  const brandPill = context?.brandName?.trim()
    ? `Brand · ${escapeHtml(context.brandName)}`
    : "Media Plan";

  return `<div class="page cover">
  <div class="cover-grid"></div>
  <div class="cover-inner">
    <div class="cover-top">
      ${mediaPlanLogo(options, "cover", "dark")}
      <div class="cover-pill">${brandPill}</div>
    </div>
    <div class="cover-mid">
      <div class="eyebrow">Influencer Campaign · Media Plan</div>
      <h1>${escapeHtml(content.title)}</h1>
      ${content.summary ? `<div class="sub">${escapeHtml(content.summary)}</div>` : ""}
      ${renderMetaRow(context)}
    </div>
    <div class="cover-foot">
      <div class="cover-bottom">
        ${costHero}
        <div class="stat-row">
          <div class="stat-box"><div class="n">${data.durationWeeks}</div><div class="l">Weeks</div></div>
          <div class="stat-box"><div class="n">${adSlots}</div><div class="l">Ad Slots</div></div>
          <div class="stat-box"><div class="n">${data.creatorCount}</div><div class="l">Creators</div></div>
        </div>
      </div>
      ${renderCoverLegend(data)}
    </div>
  </div>
</div>`;
}

function displayStrategySummary(data: MediaPlanData) {
  return refreshMediaPlanStrategySummaryForDisplay(data.strategySummary, data);
}

function resolvePresentationOptions(
  options?: BuildMediaPlanHtmlOptions
): MediaPlanPresentationConfig {
  return options?.presentation ?? defaultMediaPlanPresentation("standard");
}

function displayStrategyBlocks(
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): MediaPlanStrategyBlock[] {
  const summary = displayStrategySummary(data);
  const presentation = resolvePresentationOptions(options);
  const clientFacing = presentation.view === "client";
  return summary?.hasContent
    ? buildMediaPlanStrategyBlocks(summary, { clientFacing, presentation })
    : [];
}

function confPillHtml(confidence?: MediaPlanStrategyBlock["confidence"]): string {
  if (!confidence) return "";
  const level = confidence.level;
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return `<div class="conf-pill ${escapeHtml(level)}">${escapeHtml(label)}</div>`;
}

function confNoteHtml(confidence?: MediaPlanStrategyBlock["confidence"]): string {
  if (!confidence?.reason) return "";
  return `<div class="conf-note">${escapeHtml(confidence.reason)}</div>`;
}

function marketTimingCitationsHtml(
  citations?: MediaPlanStrategyBlock["marketTimingCitations"]
): string {
  if (!citations?.length) return "";
  return citations
    .map(
      (citation) =>
        `<div class="mt-citation">
          <div class="mt-citation-head">
            <span class="mt-citation-driver">${escapeHtml(citation.driver)}</span>
            <span class="mt-citation-conf">${citation.confidencePercent}%</span>
          </div>
          <div class="mt-citation-evidence">Evidence: ${escapeHtml(citation.evidence)}</div>
          <div class="mt-citation-reason">${escapeHtml(citation.reason)}</div>
          <div class="mt-citation-impact">Impact: ${escapeHtml(citation.impact)}</div>
        </div>`
    )
    .join("");
}

function rationaleHtml(rationale?: string[], internalView = true): string {
  if (!internalView || !rationale?.length) return "";
  const items = rationale.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("");
  return `<details class="why-rationale"><summary>▼ Why?</summary><ul>${items}</ul></details>`;
}

function stratCardInnerHtml(
  block: MediaPlanStrategyBlock,
  inner: string,
  internalView: boolean
): string {
  const confidence = internalView ? confPillHtml(block.confidence) + confNoteHtml(block.confidence) : "";
  const citations =
    block.label === "Market Timing Intelligence"
      ? marketTimingCitationsHtml(block.marketTimingCitations)
      : "";
  const why = rationaleHtml(block.rationale, internalView);
  return `${confidence}${inner}${citations}${why}`;
}

function tagRowHtml(tags?: string[]): string {
  if (!tags?.length) return "";
  return `<div class="tag-row">${tags
    .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
    .join("")}</div>`;
}

function weekPhaseColor(phase: string): string {
  return MEDIA_PLAN_WEEK_PHASE_COLORS[phase] ?? MEDIA_PLAN_BRAND.electricBlue;
}

function weekWeightBarsHtml(weekWeights: number[]): string {
  const avg = weekWeights.reduce((sum, weight) => sum + weight, 0) / weekWeights.length;
  return weekWeights
    .map((weight, index) => {
      const phase = deriveMediaPlanWeekPhase(weight, index, weekWeights.length, avg, weekWeights);
      const color = weekPhaseColor(phase);
      return `<div class="wbar-row">
          <div class="wbar-label">W${index + 1}</div>
          <div class="wbar-track"><div class="wbar-fill" style="width:${weight}%;background:${color}"></div></div>
          <div class="wbar-val">${weight}%</div>
        </div>`;
    })
    .join("");
}

function tierRowHtml(chips?: MediaPlanStrategyBlock["tierChips"]): string {
  if (!chips?.length) return "";
  return `<div class="tier-row">${chips
    .map(
      (chip) =>
        `<div class="tier-box"${chip.tier === "UGC" ? ' style="border-color:#1D9E75;background:#F0FDF7"' : ""}><div class="n"${chip.tier === "UGC" ? ' style="color:#1D9E75"' : ""}>${chip.count}</div><div class="l">${escapeHtml(chip.tier)}</div></div>`
    )
    .join("")}</div>`;
}

function weeklyObjectivesHtml(objectives?: MediaPlanStrategyBlock["weeklyObjectives"]): string {
  if (!objectives?.length) return "";
  return `<div class="obj-row">${objectives
    .map((week) => {
      const phaseColor = weekPhaseColor(week.phase);
      return `<div class="obj-card" style="border-left-color:${phaseColor};flex:${weeklyObjectiveCardFlex()}">
          <div class="obj-top"><span class="obj-week">W${week.week}</span><span class="obj-pct">${week.weight}%</span></div>
          <div class="obj-phase" style="color:${phaseColor}">${escapeHtml(week.phase)}</div>
          <div class="obj-weight-bar"><div class="obj-weight-fill" style="width:${weeklyObjectiveWeightBarWidth(week.weight)};background:${phaseColor}"></div></div>
          ${week.goals
            .map((goal) => `<div class="obj-desc">${escapeHtml(goal)}</div>`)
            .join("")}
        </div>`;
    })
    .join("")}</div>`;
}

function creativeRecsHtml(items?: MediaPlanStrategyBlock["creativeItems"]): string {
  if (!items?.length) return "";
  return items
    .map((entry) => {
      const impact = entry.confidence ?? "medium";
      return `<div class="rec-item">
          <span class="impact-badge ${escapeHtml(impact)}">${escapeHtml(impact.toUpperCase())}</span>
          <div class="rec-text"><div class="t">${escapeHtml(entry.format)}</div><div class="d">${escapeHtml(entry.reason)}</div></div>
        </div>`;
    })
    .join("");
}

function creatorTypeGridHtml(items?: MediaPlanStrategyBlock["creativeItems"]): string {
  if (!items?.length) return "";
  return `<div class="type-grid">${items
    .map(
      (entry) =>
        `<div class="type-card"><div class="t">${escapeHtml(entry.format)}</div><div class="d">${escapeHtml(entry.reason)}</div></div>`
    )
    .join("")}</div>`;
}

function stratCardHtml(
  label: string,
  inner: string,
  headExtra = "",
  full = false,
  extraClass = "",
  options?: BuildMediaPlanHtmlOptions
): string {
  const classes = ["strat-card", full ? "full" : "", extraClass].filter(Boolean).join(" ");
  const sectionKey = resolveMediaPlanSectionKey(label);
  const toggle = sectionToggleHtml(sectionKey, options);
  return `<div class="${classes}">
        <div class="strat-head">
          <div class="strat-title"><span class="ic"></span>${escapeHtml(label)}</div>
          <div class="strat-head-actions">${toggle}${headExtra}</div>
        </div>
        ${inner}
      </div>`;
}

function findStrategyBlock(
  blocks: MediaPlanStrategyBlock[],
  matcher: (block: MediaPlanStrategyBlock) => boolean
): MediaPlanStrategyBlock | undefined {
  return blocks.find(matcher);
}

/** Approximate vertical budget for strategy body rows (px-equivalent weight units). */
const STRATEGY_PAGE_ROW_BUDGET = 6;

type StrategyContentRow = {
  html: string;
  weight: number;
};

function strategyRowHasCard(html: string): boolean {
  return html.includes("strat-card");
}

function singleOrPairRowHtml(left: string, right: string): { html: string; weight: number } {
  if (left && right) {
    return { html: `<div class="strat-row cols-2">${left}${right}</div>`, weight: 2 };
  }
  const solo = left || right;
  if (!solo) return { html: "", weight: 0 };
  return { html: `<div class="strat-row">${solo}</div>`, weight: 1 };
}

function buildStrategyContentRows(
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): StrategyContentRow[] {
  const summary = displayStrategySummary(data) ?? data.strategySummary;
  const blocks = displayStrategyBlocks(data, options);
  const presentation = resolvePresentationOptions(options);
  const internalView = presentation.view !== "client";

  if (!summary?.hasContent) {
    return [
      {
        html: `<div class="strat-row"><div class="strat-card full"><div class="strat-body-text">Strategy summary will appear here once the campaign brief or strategy section is complete.</div></div></div>`,
        weight: 2,
      },
    ];
  }

  const executive = findStrategyBlock(blocks, (b) => b.kind === "executive");
  const objective = findStrategyBlock(blocks, (b) => b.kind === "objective");
  const rollout = findStrategyBlock(
    blocks,
    (b) => b.label === "Campaign Rollout Strategy" || b.label === "Launch Approach"
  );
  const platform = findStrategyBlock(blocks, (b) => b.label === "Platform Intelligence");
  const creatorMix = findStrategyBlock(blocks, (b) => b.kind === "tier-chips");
  const weeklyObjectives = findStrategyBlock(blocks, (b) => b.kind === "weekly-grid");
  const marketTiming = findStrategyBlock(blocks, (b) => b.label === "Market Timing Intelligence");

  const rows: StrategyContentRow[] = [];

  if (isSectionVisible(presentation, "executiveSummary") && executive) {
    rows.push({
      html: `<div class="strat-row">${stratCardHtml(
        executive.label,
        `${tagRowHtml(executive.evidence)}${executive.body ? `<div class="strat-body-text">${escapeHtml(executive.body).replace(/\n/g, "<br />")}</div>` : ""}`,
        "",
        true,
        "",
        options
      )}</div>`,
      weight: 3,
    });
  }

  const pairableCards: string[] = [];

  if (isSectionVisible(presentation, "objectives") && objective) {
    pairableCards.push(
      stratCardHtml(
        objective.label,
        `<div class="strat-body-text">${escapeHtml(objective.body).replace(/\n/g, "<br />")}</div>`,
        "",
        false,
        "",
        options
      )
    );
  }

  if (isSectionVisible(presentation, "objectives")) {
    const rolloutBars = summary.weekWeights?.length ? weekWeightBarsHtml(summary.weekWeights) : "";
    const rolloutTiers = tierRowHtml(rollout?.tierChips);
    const rolloutInner = rolloutBars
      ? `${rolloutBars}${rolloutTiers}`
      : rollout?.body
        ? `<div class="strat-body-text">${escapeHtml(rollout.body).replace(/\n/g, "<br />")}</div>${rolloutTiers}`
        : rolloutTiers;
    if (rollout && rolloutInner) {
      pairableCards.push(stratCardHtml(rollout.label, rolloutInner, "", false, "", options));
    } else if (!rollout && summary.weekWeights?.length) {
      pairableCards.push(
        stratCardHtml("Campaign Rollout Strategy", `${rolloutBars}${rolloutTiers}`, "", false, "", options)
      );
    }
  }

  if (isSectionVisible(presentation, "marketTiming") && marketTiming) {
    pairableCards.push(
      stratCardHtml(
        marketTiming.label,
        stratCardInnerHtml(
          marketTiming,
          `<div class="strat-body-text">${escapeHtml(marketTiming.body).replace(/\n/g, "<br />")}</div>`,
          internalView
        ),
        "",
        false,
        "",
        options
      )
    );
  }

  if (isSectionVisible(presentation, "platformIntelligence") && platform) {
    pairableCards.push(
      stratCardHtml(
        platform.label,
        stratCardInnerHtml(
          platform,
          `<div class="strat-body-text">${escapeHtml(platform.body).replace(/\n/g, "<br />")}</div>`,
          internalView
        ),
        "",
        false,
        "",
        options
      )
    );
  }

  while (pairableCards.length >= 2) {
    const left = pairableCards.shift()!;
    const right = pairableCards.shift()!;
    const pair = singleOrPairRowHtml(left, right);
    if (strategyRowHasCard(pair.html)) rows.push(pair);
  }
  if (pairableCards.length === 1) {
    const solo = singleOrPairRowHtml(pairableCards[0]!, "");
    if (strategyRowHasCard(solo.html)) rows.push(solo);
  }

  if (isSectionVisible(presentation, "creatorMix") && creatorMix) {
    rows.push({
      html: `<div class="strat-row">${stratCardHtml(
        creatorMix.label,
        stratCardInnerHtml(
          creatorMix,
          `${tierRowHtml(creatorMix.tierChips)}<div class="strat-body-text">${escapeHtml(creatorMix.body).replace(/\n/g, "<br />")}</div>`,
          internalView
        ),
        "",
        true,
        "strat-card-tier-mix",
        options
      )}</div>`,
      weight: 2,
    });
  }

  if (isSectionVisible(presentation, "weeklyObjectives") && weeklyObjectives) {
    const weekCount = weeklyObjectives.weeklyObjectives?.length ?? 0;
    rows.push({
      html: `<div class="strat-row">${stratCardHtml(
        weeklyObjectives.label,
        stratCardInnerHtml(
          weeklyObjectives,
          weeklyObjectivesHtml(weeklyObjectives.weeklyObjectives),
          internalView
        ),
        "",
        true,
        "",
        options
      )}</div>`,
      weight: weekCount > 6 ? 3 : 2,
    });
  }

  return rows.filter((row) => strategyRowHasCard(row.html));
}

function packStrategyContentRows(
  rows: StrategyContentRow[],
  budget = STRATEGY_PAGE_ROW_BUDGET
): StrategyContentRow[][] {
  if (!rows.length) return [];

  const pages: StrategyContentRow[][] = [];
  let current: StrategyContentRow[] = [];
  let used = 0;

  for (const row of rows) {
    if (current.length > 0 && used + row.weight > budget) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += row.weight;
  }

  if (current.length) pages.push(current);
  return pages;
}

function strategyPackedPageTitle(pageIndex: number, rows: StrategyContentRow[]): string {
  if (pageIndex === 0 && rows[0]?.html.includes("Executive Summary")) {
    return "Executive Summary";
  }
  return pageIndex === 0 ? "Campaign Strategy" : "Campaign Strategy (continued)";
}

function renderPackedStrategyPages(
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  content: CampaignOutputContent,
  options: BuildMediaPlanHtmlOptions | undefined,
  startPageNumber: number
): { html: string; pageCount: number } {
  const rows = buildStrategyContentRows(data, options);
  const packed = packStrategyContentRows(rows);
  if (!packed.length) return { html: "", pageCount: 0 };

  const html = packed
    .map((pageRows, index) => {
      const body = pageRows.map((row) => row.html).join("\n");
      const pageNumber = startPageNumber + index;
      const pageTitle = strategyPackedPageTitle(index, pageRows);

      return `<div class="page">
  ${renderPgHeader("Campaign Strategy", pageTitle, options)}
  <div class="strat-body">${body}</div>
  ${renderPgFooter(context, content.title, pageNumber)}
</div>`;
    })
    .join("\n");

  return { html, pageCount: packed.length };
}

function countPackedStrategyPages(
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): number {
  return packStrategyContentRows(buildStrategyContentRows(data, options)).length;
}

function renderPlanningOverviewPage(
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions
): string {
  const summary = displayStrategySummary(data) ?? data.strategySummary;
  const blocks = displayStrategyBlocks(data, options);
  const overview = blocks.find((block) => block.label === "Campaign Overview");
  const creatorMix = blocks.find((block) => block.label === "Creator Mix");
  const allocationBars = platformAllocationBars(data);

  const overviewCard = overview
    ? stratCardHtml(
        overview.label,
        `<div class="strat-body-text">${escapeHtml(overview.body).replace(/\n/g, "<br />")}</div>`,
        "",
        true,
        "",
        options
      )
    : "";
  const creatorCard = creatorMix
    ? stratCardHtml(
        creatorMix.label,
        `${tierRowHtml(creatorMix.tierChips)}<div class="strat-body-text">${escapeHtml(creatorMix.body).replace(/\n/g, "<br />")}</div>`,
        "",
        true,
        "strat-card-tier-mix",
        options
      )
    : "";
  const allocationCard =
    allocationBars.length > 0
      ? stratCardHtml("Platform Allocation", platformBarsHtml(allocationBars), "", true, "", options)
      : "";

  const body =
    summary?.hasContent
      ? `<div class="strat-row">${overviewCard}</div>
         ${creatorCard ? `<div class="strat-row">${creatorCard}</div>` : ""}
         ${allocationCard ? `<div class="strat-row">${allocationCard}</div>` : ""}`
      : `<div class="strat-row"><div class="strat-card full"><div class="strat-body-text">Quotation data will populate this overview once creators are confirmed.</div></div></div>`;

  return `<div class="page">
  ${renderPgHeader("Campaign Overview", "Publishing Plan", options)}
  <div class="strat-body">${body}</div>
  ${renderPgFooter(context, content.title, 2)}
</div>`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

const CREATIVE_CONCEPTS_PER_PAGE = 2;

function renderCreativeDirectionInner(
  creative: MediaPlanStrategyBlock | undefined,
  conceptSlice?: MediaPlanCreativeConceptDisplay[],
  includeInfluencerSummary = true,
  options?: BuildMediaPlanBodyOptions
): string {
  if (!creative) return "";
  const displays = conceptSlice ?? creative.creativeConceptDisplays;
  const presentation = resolvePresentationOptions(options);
  const exportLevel = presentation.influencerConceptsExport ?? "summary";
  const influencerSummaryOptions = {
    variant: options?.influencerConceptsVariant ?? "static",
    maxPreview: presentation.mode === "standard" ? 4 : 4,
    exportLevel: includeInfluencerSummary && isSectionVisible(presentation, "influencerConcepts")
      ? exportLevel
      : ("none" as const),
    language: presentation.exportLanguage ?? "en",
  } as const;
  if (displays?.length) {
    const conceptsHtml = renderCreativeConceptsHtml(displays, {
      language: presentation.exportLanguage ?? "en",
    });
    const influencerHtml = includeInfluencerSummary
      ? renderInfluencerConceptsSummaryHtml(creative.influencerConcepts ?? [], influencerSummaryOptions)
      : "";
    return `<div class="strat-card-inner-scroll">${conceptsHtml}${influencerHtml}</div>`;
  }
  return (
    (creativeRecsHtml(creative.creativeItems) ||
      `<div class="strat-body-text">${escapeHtml(creative.body).replace(/\n/g, "<br />")}</div>`) +
    (includeInfluencerSummary
      ? renderInfluencerConceptsSummaryHtml(creative.influencerConcepts ?? [], influencerSummaryOptions)
      : "")
  );
}

function renderCreativeDirectionPages(
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions,
  startPageNumber = 4
): { html: string; pageCount: number } {
  const summary = displayStrategySummary(data) ?? data.strategySummary;
  const blocks = displayStrategyBlocks(data, options);
  const creative = findStrategyBlock(
    blocks,
    (b) =>
      b.kind === "creative-list" &&
      (b.label === "Creative Recommendations" || b.label === "Creative Direction")
  );
  const creatorType = findStrategyBlock(blocks, (b) => b.label === "Creator-Type Content");

  if (!summary?.hasContent) {
    return {
      html: `<div class="page creative-direction-page" style="page: strategypage; height:900px;">
  ${renderPgHeader("Campaign Strategy", "Creative Direction", options)}
  <div class="strat-body"><div class="strat-row"><div class="strat-card full"><div class="strat-body-text">Strategy summary will appear here once the campaign brief or strategy section is complete.</div></div></div></div>
  ${renderPgFooter(context, content.title, startPageNumber)}
</div>`,
      pageCount: 1,
    };
  }

  const conceptDisplays = creative?.creativeConceptDisplays ?? [];
  const hasCreativeSection = Boolean(creative || creatorType);
  const isStandard = resolvePresentationOptions(options).mode === "standard";
  const conceptChunks =
    isStandard
      ? conceptDisplays.length
        ? [conceptDisplays.slice(0, 2)]
        : hasCreativeSection
          ? [[]]
          : []
      : conceptDisplays.length > CREATIVE_CONCEPTS_PER_PAGE
        ? chunkArray(conceptDisplays, CREATIVE_CONCEPTS_PER_PAGE)
        : hasCreativeSection
          ? [conceptDisplays]
          : [];

  const footnote = creative?.limitations
    ? `<div class="footnote-bar">${escapeHtml(creative.limitations)}</div>`
    : "";

  const pages: string[] = [];

  for (let index = 0; index < conceptChunks.length; index += 1) {
    const isFirst = index === 0;
    const slice = conceptDisplays.length ? conceptChunks[index]! : undefined;
    const creativeInner = renderCreativeDirectionInner(creative, slice, isFirst, options);
    const creativeCard = creative
      ? stratCardHtml(
          index === 0 ? creative.label : `${creative.label} (continued)`,
          creativeInner,
          "",
          false,
          "",
          options
        )
      : "";
    const creatorTypeCard =
      isFirst && creatorType
        ? stratCardHtml(
            creatorType.label,
            creatorTypeGridHtml(creatorType.creativeItems) ||
              `<div class="strat-body-text">${escapeHtml(creatorType.body).replace(/\n/g, "<br />")}</div>`,
            "",
            false,
            "",
            options
          )
        : "";

    const body =
      creatorTypeCard && creativeCard
        ? `<div class="strat-row cols-2">${creativeCard}${creatorTypeCard}</div>${isFirst ? footnote : ""}`
        : creativeCard
          ? `<div class="strat-row">${creativeCard}</div>${isFirst ? footnote : ""}`
          : creatorTypeCard
            ? `<div class="strat-row">${creatorTypeCard}</div>${footnote}`
            : footnote;

    if (!body.trim() || (!strategyRowHasCard(body) && !footnote)) continue;

    pages.push(`<div class="page creative-direction-page" style="page: strategypage; height:900px;">
  ${renderPgHeader("Campaign Strategy", index === 0 ? "Creative Direction" : "Creative Direction (continued)", options, "creativeDirection")}
  <div class="strat-body">${body}</div>
  ${renderPgFooter(context, content.title, startPageNumber + pages.length)}
</div>`);
  }

  return { html: pages.join("\n"), pageCount: pages.length };
}

function calendarPageTitle(data: MediaPlanData, campaignStart: Date, week?: MediaPlanData["weeks"][number]): string {
  if (week && data.weeks.length > 1) {
    return `Week ${week.week} · ${formatWeekRangeLabel(campaignStart, week.week)}`;
  }
  return data.durationWeeks > 1 ? `Weeks 1 – ${data.durationWeeks}` : "Week 1";
}

/** Single scrollable calendar for in-app preview — all weeks, auto height, no per-week page gaps. */
function renderCalendarPreviewPage(
  content: CampaignOutputContent,
  data: MediaPlanData,
  typeColorMap: Map<string, string>,
  context: MediaPlanCampaignContext | undefined,
  options: BuildMediaPlanHtmlOptions | undefined,
  pageNumber: number
): string {
  const campaignStart = parseCampaignStartDate(data.campaignStartDate);
  const weeksHtml = data.weeks
    .map((week) => renderWeekBlock(week, data, typeColorMap, options))
    .join("\n");

  return `<div class="page calendar-preview-page">
  ${renderPgHeader("Publishing Calendar", calendarPageTitle(data, campaignStart), options, "publishingCalendar")}
  <div class="cal-body">${weeksHtml}</div>
  ${renderPgFooter(context, content.title, pageNumber)}
</div>`;
}

/** Per-week fixed pages for PDF/HTML export. */
function renderCalendarPages(
  content: CampaignOutputContent,
  data: MediaPlanData,
  typeColorMap: Map<string, string>,
  context: MediaPlanCampaignContext | undefined,
  options: BuildMediaPlanHtmlOptions | undefined,
  startPageNumber: number
): { html: string; pageCount: number } {
  const campaignStart = parseCampaignStartDate(data.campaignStartDate);
  const pages = data.weeks.map((week, index) => {
    const weekHtml = renderWeekBlock(week, data, typeColorMap, options);

    return `<div class="page calendar-page" style="page: calendarpage; min-height:860px;">
  ${renderPgHeader("Publishing Calendar", calendarPageTitle(data, campaignStart, week), options, "publishingCalendar")}
  <div class="cal-body">${weekHtml}</div>
  ${renderPgFooter(context, content.title, startPageNumber + index)}
</div>`;
  });

  return { html: pages.join("\n"), pageCount: pages.length };
}

function renderOperationsPage(
  content: CampaignOutputContent,
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  options: BuildMediaPlanHtmlOptions | undefined,
  pageNumber: number
): string {
  const showWaves = data.planMode !== "planning" && data.waves.length > 0;
  const wavesCard = showWaves
    ? `<div class="ops-card">
      <h3><span class="ic"></span>Activation Waves</h3>
      <div class="wave-row">${data.waves
        .map((wave) => {
          const weekSpan =
            wave.weeks.length > 1
              ? `Weeks ${wave.weeks[0]}–${wave.weeks[wave.weeks.length - 1]}`
              : `Week ${wave.weeks[0] ?? wave.wave}`;
          return `<div class="wave-card">
          <div class="wave-tag">Wave ${wave.wave}</div>
          <div class="wave-title">${escapeHtml(wave.theme)}</div>
          <div class="wave-span">${escapeHtml(weekSpan)}</div>
        </div>`;
        })
        .join("")}</div>
    </div>`
    : "";

  const allocationBars = platformAllocationBars(data);
  const platformCard =
    allocationBars.length > 0
      ? `<div class="ops-card">
          <h3><span class="ic"></span>Platform Allocation</h3>
          ${platformBarsHtml(allocationBars)}
        </div>`
      : "";

  const milestonesCard = `<div class="ops-card">
      <h3><span class="ic"></span>Milestones &amp; Windows</h3>
      ${data.milestones
        .slice(0, 14)
        .map(
          (milestone) =>
            `<div class="mrow"><span class="mtag">W${milestone.week}</span><span class="mdesc">${escapeHtml(milestone.label)}</span></div>`
        )
        .join("")}
    </div>`;

  const depsCard =
    data.dependencies.length > 0
      ? `<div class="ops-card">
          <h3><span class="ic"></span>Creator Dependencies</h3>
          ${data.dependencies
            .map(
              (dep) =>
                `<div class="deprow"><div class="depwho">${escapeHtml(dep.creator)}</div><div class="depdesc">${escapeHtml(dep.note)}</div></div>`
            )
            .join("")}
        </div>`
      : "";

  return `<div class="page">
  ${renderPgHeader("Overview", "Campaign Operations", options, "campaignOperations")}
  <div class="ops-body">
    ${wavesCard}
    ${platformCard}
    ${milestonesCard}
    ${depsCard}
  </div>
  ${renderPgFooter(context, content.title, pageNumber)}
</div>`;
}

function renderDeadlineCreatorCell(
  deadline: MediaPlanData["deadlines"][number],
  options?: BuildMediaPlanHtmlOptions
): string {
  const displayName = deadline.shortName ?? deadline.creator;
  const name = escapeHtml(displayName);
  const handle = deadline.handle?.trim();
  const handleHtml = handle
    ? `<span class="dl-handle">@${escapeHtml(handle.replace(/^@/, ""))}</span>`
    : "";
  const avatarFields = {
    ...deadline,
    creator: displayName,
    shortName: displayName,
  };

  return `<div class="dl-creator">
    ${renderAvatar(avatarFields, options)}
    <div class="dl-creator-text">
      <div class="dl-name">${name}</div>
      ${handleHtml}
    </div>
  </div>`;
}

function renderDeadlinesTableRows(
  deadlines: MediaPlanData["deadlines"],
  options?: BuildMediaPlanHtmlOptions
): string {
  return deadlines
    .map((deadline) => {
      const deliverables = deadline.serviceTypes?.length
        ? deadline.serviceTypes
        : deadline.serviceType?.trim()
          ? [deadline.serviceType]
          : [];
      const deliverableText = deliverables.length ? deliverables.join(" · ") : "—";

      return `<tr>
          <td>${renderDeadlineCreatorCell(deadline, options)}</td>
          <td class="dl-deliv">${escapeHtml(deliverableText)}</td>
          <td>Week ${deadline.publishWeek} · ${escapeHtml(deadline.publishDay)}</td>
          <td>${escapeHtml(deadline.productionStart)}</td>
          <td>${escapeHtml(deadline.assetDelivery)}</td>
        </tr>`;
    })
    .join("");
}

function renderDeadlinesPage(
  content: CampaignOutputContent,
  deadlines: MediaPlanData["deadlines"],
  context: MediaPlanCampaignContext | undefined,
  options: BuildMediaPlanHtmlOptions | undefined,
  pageNumber: number,
  pageOptions?: { continuation?: boolean; previewAutoHeight?: boolean }
): string {
  const rows = deadlines.length ? renderDeadlinesTableRows(deadlines, options) : "";
  const subtitle = pageOptions?.continuation ? "Asset Delivery Deadlines (continued)" : "Asset Delivery Deadlines";
  const pageClass = pageOptions?.previewAutoHeight ? "page deadlines-preview-page" : "page";
  const heightStyle = pageOptions?.previewAutoHeight
    ? "page: strategypage; min-height:720px; height:auto;"
    : "page: strategypage; height:900px;";

  return `<div class="${pageClass}" style="${heightStyle}">
  ${renderPgHeader("Production Schedule", subtitle, options, "productionSchedule")}
  <div class="tbl-body">
    <table class="dl-table">
      <thead><tr><th>Creator</th><th>Deliverables</th><th>Publish</th><th>Production Starts</th><th>Assets Due</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${renderPgFooter(context, content.title, pageNumber)}
</div>`;
}

const DEADLINES_ROWS_PER_PAGE = 22;

function renderDeadlinesPages(
  content: CampaignOutputContent,
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  options: BuildMediaPlanBodyOptions | undefined,
  startPageNumber: number
): { html: string; pageCount: number } {
  const deadlines = data.deadlines;
  if (!deadlines.length) {
    return {
      html: renderDeadlinesPage(content, [], context, options, startPageNumber, {
        previewAutoHeight: options?.calendarLayout === "preview",
      }),
      pageCount: 1,
    };
  }

  const previewAutoHeight = options?.calendarLayout === "preview";
  const chunks: MediaPlanData["deadlines"][] = [];
  for (let index = 0; index < deadlines.length; index += DEADLINES_ROWS_PER_PAGE) {
    chunks.push(deadlines.slice(index, index + DEADLINES_ROWS_PER_PAGE));
  }

  const html = chunks
    .map((chunk, index) =>
      renderDeadlinesPage(content, chunk, context, options, startPageNumber + index, {
        continuation: index > 0,
        previewAutoHeight,
      })
    )
    .join("\n");

  return { html, pageCount: chunks.length };
}

function renderClosePage(
  content: CampaignOutputContent,
  context: MediaPlanCampaignContext | undefined,
  options?: BuildMediaPlanHtmlOptions
): string {
  const label = formatMediaPlanPreparedForLabel(context, content.title);
  return `<div class="page close">
  ${mediaPlanLogo(options, "closing", "dark")}
  <h2>Let's bring it to life.</h2>
  <p>Thinkway Media Plan — prepared exclusively for ${escapeHtml(label)}</p>
  <div class="contact">Thinkway · Influencer Marketing Studio</div>
</div>`;
}

/** Google Fonts import — matches quotation / IO report exports for PDF + preview. */
const MEDIA_PLAN_FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`;

/** Rounded slide corners — preview (screen) and PDF (print) share the same radius. */
const MEDIA_PLAN_PAGE_CARD_RADIUS = "14px";

/** Auto-height calendar + deadlines pages — shared by in-app preview and standard export. */
const MEDIA_PLAN_PREVIEW_LAYOUT_PAGE_CSS = `
  .page.calendar-preview-page {
    height: auto;
    min-height: 780px;
    overflow: visible;
    display: flex;
    flex-direction: column;
  }
  .page.calendar-preview-page .cal-body {
    flex: 1 1 auto;
    padding-bottom: 12px;
  }
  .page.calendar-preview-page .pg-footer {
    position: relative;
    bottom: auto;
    margin-top: auto;
  }
  .page.deadlines-preview-page {
    height: auto;
    min-height: 720px;
    overflow: visible;
    display: flex;
    flex-direction: column;
  }
  .page.deadlines-preview-page .tbl-body {
    flex: 1 1 auto;
    padding-bottom: 20px;
  }
  .page.deadlines-preview-page .pg-footer {
    position: relative;
    bottom: auto;
    margin-top: auto;
  }
`;

export function buildMediaPlanStyles(): string {
  return `
    ${MEDIA_PLAN_FONT_IMPORT}
    ${THINKWAY_REPORT_LOGO_STYLES}
    ${E_MEDIA_PLAN_CSS}
    ${MEDIA_PLAN_PREVIEW_LAYOUT_PAGE_CSS}
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pg-header .brandmark .thinkway-report-logo-img {
      height: 22px;
    }
    @media screen {
      body {
        background: #e5e7eb;
      }
      .page + .page {
        margin-top: 24px;
      }
      .page {
        box-shadow: 0 4px 24px rgba(11, 15, 26, 0.12);
        border-radius: ${MEDIA_PLAN_PAGE_CARD_RADIUS};
      }
    }
    @media print {
      html, body {
        background: #e5e7eb;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page + .page {
        margin-top: 0;
      }
      .page {
        box-shadow: none;
        border-radius: ${MEDIA_PLAN_PAGE_CARD_RADIUS};
      }
      .page:not(.cover):not(.close) {
        background: #fff;
      }
    }
  `;
}

/** Scale fixed 1280px pages to the preview viewport width (print/PDF unchanged). */
function buildMediaPlanPreviewScreenStyles(widthPx: number): string {
  return `
    @media screen {
      html, body {
        width: 100%;
        min-width: 0;
        margin: 0;
        padding: 0;
        overflow-x: hidden;
        overflow-y: auto;
        background: #e5e7eb;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .mp-sec-toggle {
        display:inline-flex; align-items:center; justify-content:center;
        width:26px; height:26px; border-radius:8px;
        border:1px solid #D6E4FF; background:#fff;
        color:var(--blue); cursor:pointer; padding:0;
        flex-shrink:0; font-size:12px; line-height:1;
      }
      .mp-sec-toggle:hover { background:#EEF3FF; border-color:var(--blue); }
      .page {
        width: ${widthPx}px;
        transform-origin: top center;
        transform: scale(calc(100vw / ${widthPx}));
        margin-left: auto;
        margin-right: auto;
        margin-bottom: calc(var(--page-h, 780px) * max(0, (100vw / ${widthPx} - 1)) * 0.92);
        box-shadow: 0 4px 24px rgba(11, 15, 26, 0.12);
        border-radius: ${MEDIA_PLAN_PAGE_CARD_RADIUS};
        page-break-after: auto;
      }
      .page.calendar-preview-page {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        display: flex;
        flex-direction: column;
      }
      .page.calendar-preview-page .cal-body {
        flex: 1 1 auto;
        padding-bottom: 12px;
      }
      .page.calendar-preview-page .pg-footer {
        position: relative;
        bottom: auto;
        margin-top: auto;
      }
      .page.deadlines-preview-page {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        display: flex;
        flex-direction: column;
      }
      .page.deadlines-preview-page .tbl-body {
        flex: 1 1 auto;
        padding-bottom: 20px;
      }
      .page.deadlines-preview-page .pg-footer {
        position: relative;
        bottom: auto;
        margin-top: auto;
      }
      .page[style*="height:900px"] {
        --page-h: 900px;
        height: 900px;
      }
      .page.cover,
      .page.close {
        --page-h: 780px;
      }
      .pg-header .brandmark .thinkway-report-logo-img {
        height: 22px;
      }
    }
    @media print {
      html, body {
        width: ${widthPx}px;
        background: #e5e7eb;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        transform: none;
        margin: 0;
        box-shadow: none;
        border-radius: ${MEDIA_PLAN_PAGE_CARD_RADIUS};
        page-break-after: always;
      }
      .page:last-child {
        page-break-after: auto;
      }
    }
  `;
}

type BuildMediaPlanBodyOptions = BuildMediaPlanHtmlOptions & {
  /** Preview + standard export use one auto-height calendar; strategy export splits per week. */
  calendarLayout?: "preview" | "export";
  /** Interactive cards postMessage to parent; static export shows honest summary-only copy. */
  influencerConceptsVariant?: "static" | "interactive";
};

/** Resolve body build options so preview and standard export share pagination/layout. */
export function resolveMediaPlanDocumentBuildOptions(
  options?: BuildMediaPlanHtmlOptions,
  context: "preview" | "export" = "export"
): BuildMediaPlanBodyOptions {
  const presentation = resolvePresentationOptions(options);
  const isStandard = presentation.mode === "standard";

  return {
    ...options,
    calendarLayout: isStandard ? "preview" : "export",
    browserAvatarProxy: context === "preview" ? true : options?.browserAvatarProxy,
    influencerConceptsVariant: context === "preview" ? "interactive" : "static",
  };
}

/** Extract ordered page class signatures from generated HTML (for preview/export parity tests). */
export function extractMediaPlanPageSignatures(html: string): string[] {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] ?? html;
  return [...body.matchAll(/<div class="(page[^"]*)"/g)].map((match) => match[1] ?? "");
}

function buildMediaPlanBody(
  content: CampaignOutputContent,
  data: MediaPlanData,
  options?: BuildMediaPlanBodyOptions
): string {
  const context = mergeMediaPlanContext(data.campaignContext, options?.contextOverride);
  const legendTypes = collectLegendTypes(data);
  const typeColorMap = buildAdTypeColorMap(legendTypes);
  const presentation = resolvePresentationOptions(options);
  const isPlanning = data.planMode === "planning";
  const showCreativeDirection =
    !isPlanning && isSectionVisible(presentation, "creativeDirection");
  const packedStrategyPageCount = !isPlanning
    ? countPackedStrategyPages(data, options)
    : 0;
  const creativeDirectionPageCount = showCreativeDirection
    ? renderCreativeDirectionPages(
        data,
        mergeMediaPlanContext(data.campaignContext, options?.contextOverride),
        content,
        options,
        2 + packedStrategyPageCount
      ).pageCount
    : 0;
  const strategyPageCount = !isPlanning ? packedStrategyPageCount + creativeDirectionPageCount : 0;
  const preCalendarPages = isPlanning ? 2 : Math.max(1, 1 + strategyPageCount);
  const calendarStartPage = preCalendarPages + 1;
  const calendarLayout =
    options?.calendarLayout ??
    (presentation.mode === "standard" ? "preview" : "export");

  const calendarHtml = isSectionVisible(presentation, "publishingCalendar")
    ? calendarLayout === "preview"
      ? renderCalendarPreviewPage(content, data, typeColorMap, context, options, calendarStartPage)
      : renderCalendarPages(content, data, typeColorMap, context, options, calendarStartPage).html
    : "";
  const calendarPageCount =
    isSectionVisible(presentation, "publishingCalendar")
      ? calendarLayout === "preview"
        ? 1
        : data.weeks.length
      : 0;

  let pageCursor = calendarStartPage + calendarPageCount;
  const pages: string[] = [renderCoverPage(content, data, context, options)];

  if (isPlanning) {
    pages.push(renderPlanningOverviewPage(data, context, content, options));
  } else if (strategyPageCount > 0) {
    let strategyPageNumber = 2;
    const packedStrategy = renderPackedStrategyPages(
      data,
      context,
      content,
      options,
      strategyPageNumber
    );
    if (packedStrategy.html.trim()) {
      pages.push(packedStrategy.html);
      strategyPageNumber += packedStrategy.pageCount;
    }
    if (showCreativeDirection) {
      const creative = renderCreativeDirectionPages(data, context, content, options, strategyPageNumber);
      if (creative.html.trim()) {
        pages.push(creative.html);
      }
    }
  }

  if (calendarHtml) pages.push(calendarHtml);

  if (!isPlanning && isSectionVisible(presentation, "campaignOperations")) {
    pages.push(renderOperationsPage(content, data, context, options, pageCursor));
    pageCursor += 1;
  }

  if (isSectionVisible(presentation, "productionSchedule")) {
    const deadlinesPages = renderDeadlinesPages(content, data, context, options, pageCursor);
    if (deadlinesPages.html.trim()) {
      pages.push(deadlinesPages.html);
      pageCursor += deadlinesPages.pageCount;
    }
  }

  pages.push(renderClosePage(content, context, options));

  return pages.filter((page) => page.trim().length > 0).join("\n");
}

/** Standalone HTML document for the in-app preview iframe — matches EMediaPlan layout and scales to fit. */
export function buildMediaPlanPreviewHtmlDocument(
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions
): string {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan preview requires structured calendar data.");
  }

  const widthPx = MEDIA_PLAN_PAGE.widthPx;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <title>${escapeHtml(content.title)} — Thinkway</title>
  <style>
    ${THINKWAY_REPORT_LOGO_STYLES}
    ${E_MEDIA_PLAN_CSS}
    ${buildMediaPlanPreviewScreenStyles(widthPx)}
  </style>
</head>
<body>
  ${buildMediaPlanBody(content, content.data, resolveMediaPlanDocumentBuildOptions(options, "preview"))}
  <script>
    (function () {
      var widthPx = ${widthPx};
      var expandMessage = ${JSON.stringify(INFLUENCER_CONCEPTS_EXPAND_MESSAGE)};
      function layoutPages() {
        var scale = window.innerWidth / widthPx;
        document.querySelectorAll(".page").forEach(function (page) {
          var h = page.offsetHeight;
          page.style.setProperty("--page-h", h + "px");
          page.style.marginBottom = scale < 1 ? h * (scale - 1) + "px" : "0px";
        });
      }
      function scheduleLayout() {
        window.requestAnimationFrame(layoutPages);
      }
      function openInfluencerConcepts() {
        window.parent.postMessage({ type: expandMessage }, "*");
      }
      function bindSectionToggles() {
        document.querySelectorAll(".mp-sec-toggle").forEach(function (btn) {
          btn.addEventListener("click", function (event) {
            event.stopPropagation();
            event.preventDefault();
            var section = btn.getAttribute("data-mp-section");
            if (!section) return;
            window.parent.postMessage({ type: ${JSON.stringify(MEDIA_PLAN_SECTION_TOGGLE_MESSAGE)}, section: section, visible: false }, "*");
          });
        });
      }
      function bindInfluencerConceptCards() {
        document.querySelectorAll("[data-ic-expand]").forEach(function (el) {
          el.addEventListener("click", openInfluencerConcepts);
          el.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openInfluencerConcepts();
            }
          });
        });
      }
      function bindLanguageTabs(selector, stackSelector) {
        document.querySelectorAll(selector).forEach(function (tabs) {
          tabs.querySelectorAll("[data-ic-lang], [data-cd-lang]").forEach(function (btn) {
            btn.addEventListener("click", function (event) {
              event.stopPropagation();
              var lang = btn.getAttribute("data-ic-lang") || btn.getAttribute("data-cd-lang");
              var row = tabs.closest("[data-ic-concept-id]") || tabs.closest(".cd-concept");
              if (!row || !lang) return;
              tabs.querySelectorAll(".ic-lang-tab, .cd-lang-tab").forEach(function (t) {
                t.classList.toggle("on", t === btn);
              });
              if (stackSelector) {
                var stack = row.querySelector(stackSelector);
                if (stack) stack.setAttribute("data-active-lang", lang);
              }
              row.setAttribute("data-active-lang", lang);
            });
          });
        });
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleLayout);
        document.addEventListener("DOMContentLoaded", bindSectionToggles);
        document.addEventListener("DOMContentLoaded", bindInfluencerConceptCards);
        document.addEventListener("DOMContentLoaded", function () {
          bindLanguageTabs(".ic-lang-tabs", ".ic-locale-stack");
          bindLanguageTabs(".cd-lang-tabs", null);
        });
      } else {
        scheduleLayout();
        bindSectionToggles();
        bindInfluencerConceptCards();
        bindLanguageTabs(".ic-lang-tabs", ".ic-locale-stack");
        bindLanguageTabs(".cd-lang-tabs", null);
      }
      window.addEventListener("resize", scheduleLayout);
      window.addEventListener("load", scheduleLayout);
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(scheduleLayout).observe(document.body);
      }
    })();
  </script>
</body>
</html>`;
}

/** Markup alias for the in-app preview document builder. */
export function buildMediaPlanPreviewMarkup(
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions
): string {
  return buildMediaPlanPreviewHtmlDocument(content, options);
}

/** Build a standalone HTML document for Media Plan preview / PDF / download. */
export function buildMediaPlanHtml(
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions
): string {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan export requires structured calendar data.");
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${MEDIA_PLAN_PAGE.widthPx}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <title>${escapeHtml(content.title)} — Thinkway</title>
  <style>${buildMediaPlanStyles()}</style>
</head>
<body>
  ${buildMediaPlanBody(content, content.data, resolveMediaPlanDocumentBuildOptions(options, "export"))}
</body>
</html>`;
}
