/** Reuse quotation landscape brand template styles for shortlist parity. */
export {
  QUOTATION_TEMPLATE_LOGO_SVG,
  QUOTATION_TEMPLATE_LOGO_SVG_DARK,
  QUOTATION_TEMPLATE_STYLES,
} from "@/features/quotations/templates/quotation-template-styles";

/** Shortlist-specific extensions (platform links, context cards, verified badge). */
export const SHORTLIST_TEMPLATE_EXTRA_STYLES = `
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
    padding: 14px 16px; break-inside: avoid;
  }
  .sl-context-card .l {
    font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 6px;
  }
  .sl-context-card .v {
    font-size: 13px; font-weight: 600; color: var(--navy); margin: 0;
  }
  .roster-note {
    font-size: 13px; color: var(--muted); max-width: 72ch; margin: 0 0 18px; line-height: 1.5;
  }
  .categories-cell { max-width: 180px; }
  .notes-cell { max-width: 200px; font-size: 12px; color: var(--muted); }
`;
