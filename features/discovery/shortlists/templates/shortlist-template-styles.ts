import { SHORTLIST_PAGE_CSS_VARS } from "./shortlist-page-geometry";

/** Reuse quotation brand tokens/components; shortlist owns its A4 page canvas. */
export {
  QUOTATION_TEMPLATE_LOGO_SVG,
  QUOTATION_TEMPLATE_LOGO_SVG_DARK,
  QUOTATION_TEMPLATE_STYLES,
} from "@/features/quotations/templates/quotation-template-styles";

/**
 * Shortlist page architecture — fixed landscape A4 canvases.
 * Preview and PDF share ONE layout. Pagination engine builds `.page` nodes;
 * Chromium must not invent page height.
 *
 * Canvas: 297mm × 210mm (A4 landscape)
 * Footer: absolute to the physical page bottom (part of each Page object)
 * Content: fixed height reserving footer space
 */
export const SHORTLIST_TEMPLATE_EXTRA_STYLES = `
  :root{
    ${SHORTLIST_PAGE_CSS_VARS}
  }

  .platform-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .platform-link { display: inline-flex; align-items: center; text-decoration: none; line-height: 0; }
  .platform-link-icon { width: 22px; height: 22px; border-radius: 50%; display: block; }
  .platform-link-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 22px; padding: 0 6px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
  }
  .verified-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%; background: var(--blue);
    color: #fff; font-size: 10px; font-weight: 700; margin-left: 6px;
    vertical-align: middle; line-height: 1;
  }
  .sl-context-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 8px;
  }
  .sl-context-card {
    background: var(--lav); border: 1px solid var(--lav-line); border-radius: 12px;
    padding: 14px 16px;
  }
  .sl-context-card .l {
    font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 6px;
  }
  .sl-context-card .v {
    font-size: 13px; font-weight: 600; color: var(--navy); margin: 0;
  }
  .roster-note {
    font-size: 13px; color: var(--muted); max-width: none; margin: 0 0 18px; line-height: 1.55;
    white-space: pre-wrap; overflow-wrap: break-word; word-break: normal;
  }
  .categories-cell { max-width: 220px; white-space: normal; overflow-wrap: break-word; }
  .notes-cell {
    max-width: none; min-width: 140px; font-size: 12px; color: var(--muted);
    white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; line-height: 1.45;
  }
  .sl-context-card .v {
    white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; line-height: 1.45;
  }

  /* Measurement host — same content width as a real page pad. */
  #sl-measure-root{
    position:absolute;
    left:-10000px;
    top:0;
    width:var(--sl-page-w-px);
    visibility:hidden;
    pointer-events:none;
  }
  #sl-measure-root .sl-flow{
    width:var(--sl-page-w-px);
    box-sizing:border-box;
    padding:36px 48px 20px;
  }
  #sl-measure-root .sl-flow[data-sl-page-class*="cover"]{
    padding:44px 52px 20px;
  }
  #sl-page-root:empty::before{
    content:"Preparing pages…";
    display:block;
    padding:48px;
    color:#5b657a;
    font:500 14px Geist,system-ui,sans-serif;
  }

  body.shortlist-export-preview,
  body.shortlist-export-print{
    background:#c9d4e8;
  }
  body.shortlist-export-print{background:#fff;}

  /* ONE page canvas for preview + print (engine-emitted .page nodes). */
  body.shortlist-export-preview .page,
  body.shortlist-export-print .page{
    position:relative !important;
    box-sizing:border-box !important;
    width:var(--sl-page-w) !important;
    height:var(--sl-page-h) !important;
    min-height:var(--sl-page-h) !important;
    max-width:var(--sl-page-w) !important;
    max-height:var(--sl-page-h) !important;
    margin:22px auto !important;
    box-shadow:0 3px 18px rgba(6,8,16,.16);
    overflow:hidden !important;
    display:block !important;
    flex-direction:unset !important;
    page-break-after:always;
    break-after:page;
    page-break-inside:avoid !important;
    break-inside:avoid !important;
  }
  body.shortlist-export-print .page{
    margin:0 !important;
    box-shadow:none !important;
  }
  body.shortlist-export-preview .page:last-of-type,
  body.shortlist-export-print .page:last-of-type{
    page-break-after:auto;
    break-after:auto;
  }

  body.shortlist-export-preview .page .pad,
  body.shortlist-export-print .page .pad{
    position:relative;
    box-sizing:border-box;
    height:calc(var(--sl-page-h) - var(--sl-footer-h)) !important;
    max-height:calc(var(--sl-page-h) - var(--sl-footer-h)) !important;
    overflow:hidden !important;
    flex:none !important;
    padding:36px 48px 20px !important;
  }
  body.shortlist-export-preview .page.cover .pad,
  body.shortlist-export-print .page.cover .pad{
    padding:44px 52px 20px !important;
  }

  body.shortlist-export-preview .page .foot,
  body.shortlist-export-print .page .foot{
    position:absolute !important;
    bottom:0 !important;
    left:0 !important;
    right:0 !important;
    height:var(--sl-footer-h) !important;
    margin:0 !important;
    margin-top:0 !important;
    box-sizing:border-box;
    padding:12px 48px !important;
    border-top:1px solid var(--hair);
    display:flex;
    justify-content:space-between;
    align-items:center;
    background:inherit;
    z-index:2;
    flex:none !important;
  }
  body.shortlist-export-preview .page.cover .foot,
  body.shortlist-export-print .page.cover .foot{
    border-top-color:rgba(205,216,245,.18);
    color:#7f8bb0;
    background:var(--navy);
  }

  body.shortlist-export-preview.shortlist-showcase .showcase-pubs-grid,
  body.shortlist-export-print.shortlist-showcase .showcase-pubs-grid{
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:10px;
    margin-bottom:14px;
  }
  body.shortlist-export-preview.shortlist-showcase .showcase-pub-card,
  body.shortlist-export-print.shortlist-showcase .showcase-pub-card{
    aspect-ratio:1/1;
    height:auto;
    max-height:148px;
  }

  @media print{
    body.shortlist-export-print{background:#fff !important;}
    body.shortlist-export-print .page{
      margin:0 !important;
      box-shadow:none !important;
      box-sizing:border-box !important;
      width:297mm !important;
      height:210mm !important;
      min-height:210mm !important;
      max-height:210mm !important;
      overflow:hidden !important;
      display:block !important;
      page-break-after:always !important;
      break-after:page !important;
      page-break-inside:avoid !important;
      break-inside:avoid !important;
    }
    body.shortlist-export-print .page:last-of-type{
      page-break-after:auto !important;
      break-after:auto !important;
    }
    body.shortlist-export-print .page .pad{
      height:calc(210mm - var(--sl-footer-h)) !important;
      max-height:calc(210mm - var(--sl-footer-h)) !important;
      overflow:hidden !important;
      flex:none !important;
    }
    body.shortlist-export-print .page .foot{
      position:absolute !important;
      bottom:0 !important;
      left:0 !important;
      right:0 !important;
      height:var(--sl-footer-h) !important;
      margin:0 !important;
      margin-top:0 !important;
    }
    @page{size:A4 landscape; margin:0;}
  }
`;
