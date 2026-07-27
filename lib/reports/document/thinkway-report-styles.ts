import { THINKWAY_REPORT_LOGO_STYLES } from "@/lib/reports/document/thinkway-report-logo";

/** IO-style document CSS for report HTML preview + PDF (A4 portrait canvas). */
export const THINKWAY_REPORT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  :root {
    --navy:   #0A0F1E;
    --blue:   #0057FF;
    --blue-lt:#EEF4FF;
    --blue-md:#C8D6F5;
    --ink:    #1A1F36;
    --muted:  #6B7280;
    --rule:   #E2E8F0;
    --bg:     #F8FAFC;
    --white:  #FFFFFF;
    --green:  #059669;
    --radius: 6px;
    --page-w: 210mm;
    --page-h: 297mm;
    --footer-h: 56px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 0;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: var(--ink);
    background: #c9d4e8;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    width: var(--page-w);
    min-height: var(--page-h);
    margin: 24px auto;
    background: var(--white);
    border-radius: 0;
    box-shadow: 0 3px 18px rgba(6,8,16,.14);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .doc-header {
    background: var(--navy);
    padding: 28px 36px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex: none;
  }
  .doc-header .brand { display: flex; flex-direction: column; gap: 8px; }
  .doc-header .tagline {
    font-size: 10.5px;
    color: #8899BB;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
  ${THINKWAY_REPORT_LOGO_STYLES}
  .doc-header .thinkway-report-logo--header .thinkway-report-logo-img {
    height: 28px;
  }
  .doc-header .thinkway-report-logo--header .thinkway-report-logo-text {
    font-size: 20px;
  }

  .doc-header .title-block { text-align: right; }
  .doc-header .report-title {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .serial-badge {
    display: inline-block;
    margin-top: 8px;
    background: var(--blue);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 100px;
    letter-spacing: 0.5px;
  }
  .doc-header .meta {
    margin-top: 10px;
    font-size: 11px;
    color: #8899BB;
  }

  .stripe { height: 4px; background: var(--blue); flex: none; }

  .doc-body {
    padding: 28px 36px;
    padding-bottom: calc(var(--footer-h) + 28px);
    flex: 1 1 auto;
  }

  .section { margin-bottom: 28px; }
  .section:last-child { margin-bottom: 0; }

  .section-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .section-label .num {
    background: var(--navy);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .section-label .title {
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--rule);
  }

  .scope-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 22px;
  }
  .scope-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--blue-lt);
    color: var(--blue);
    font-size: 11.5px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 100px;
    border: 1px solid var(--blue-md);
  }
  .scope-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--blue); }

  .report-note {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 14px;
    line-height: 1.6;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    font-size: 12px;
  }
  .data-table thead tr {
    background: var(--navy);
    color: #fff;
  }
  .data-table thead th {
    padding: 10px 12px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .data-table thead th:first-child {
    border-left: 3px solid var(--blue);
    padding-left: 11px;
  }
  .data-table thead th.num { text-align: right; }
  .data-table tbody tr { border-bottom: 1px solid var(--rule); }
  .data-table tbody tr:last-child { border-bottom: none; }
  .data-table tbody tr:nth-child(even) { background: var(--blue-lt); }
  .data-table tbody tr:nth-child(odd) { background: var(--white); }
  .data-table tbody tr:nth-child(even) td:first-child { border-left: 3px solid var(--blue-md); }
  .data-table tbody tr:nth-child(odd) td:first-child { border-left: 3px solid var(--blue); }
  .data-table tbody td {
    padding: 9px 12px;
    color: var(--ink);
    vertical-align: top;
  }
  .data-table tbody td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .data-table tbody tr.emphasis {
    background: var(--navy) !important;
    color: #fff;
  }
  .data-table tbody tr.emphasis td {
    color: #fff;
    font-weight: 600;
  }
  .data-table tbody tr.emphasis td:first-child {
    border-left: 3px solid var(--blue) !important;
  }
  .data-table tbody tr.total-row {
    background: var(--navy) !important;
    color: #fff;
    font-weight: 700;
  }
  .data-table tbody tr.total-row td {
    color: #fff;
  }
  .data-table tbody tr.total-row td:first-child {
    border-left: 3px solid var(--blue) !important;
  }
  .data-table .muted { color: var(--muted); font-size: 11px; }

  .table-scroll { overflow-x: auto; }

  /* Footer belongs to the page canvas, not the content flow. */
  .doc-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--footer-h);
    background: var(--bg);
    border-top: 1px solid var(--rule);
    padding: 0 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
  }
  .doc-footer .left { font-size: 11px; color: var(--muted); }
  .doc-footer .left strong { color: var(--ink); }
  .doc-footer .right { font-size: 11px; color: var(--blue); font-weight: 600; letter-spacing: 0.3px; }

  @media print {
    body { background: #fff !important; }
    .page {
      margin: 0 !important;
      box-shadow: none !important;
      width: 210mm !important;
      min-height: 297mm !important;
    }
    .section { page-break-inside: avoid; }
    .table-scroll { overflow: visible; }
    .doc-footer {
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
    }
  }

  @media (max-width: 600px) {
    .page { width: 100%; min-height: auto; }
    .doc-header { flex-direction: column; align-items: flex-start; }
    .doc-header .title-block { text-align: left; }
    .doc-body { padding: 24px 20px 72px; }
    .doc-footer { position: relative; height: auto; padding: 14px 20px; }
  }
`;
