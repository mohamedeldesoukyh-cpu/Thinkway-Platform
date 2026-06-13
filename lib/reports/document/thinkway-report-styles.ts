/** IO-style document CSS extracted from Thinkway_IO_Global.html for report exports. */
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
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: var(--ink);
    background: var(--bg);
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: 1100px;
    margin: 32px auto;
    background: var(--white);
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,.07), 0 8px 32px rgba(0,0,0,.05);
    overflow: hidden;
  }

  .doc-header {
    background: var(--navy);
    padding: 32px 40px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .doc-header .brand { display: flex; flex-direction: column; gap: 6px; }
  .doc-header .logo-text {
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.5px;
  }
  .doc-header .logo-text span { color: var(--blue); }
  .doc-header .tagline { font-size: 11px; color: #8899BB; letter-spacing: 0.5px; text-transform: uppercase; }

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

  .stripe { height: 4px; background: var(--blue); }

  .doc-body { padding: 36px 40px 48px; }

  .section { margin-bottom: 36px; }
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
    margin-bottom: 24px;
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
    margin-bottom: 16px;
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
  }
  .data-table tbody td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
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

  .doc-footer {
    background: var(--bg);
    border-top: 1px solid var(--rule);
    padding: 16px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .doc-footer .left { font-size: 11px; color: var(--muted); }
  .doc-footer .left strong { color: var(--ink); }
  .doc-footer .right { font-size: 11px; color: var(--blue); font-weight: 600; letter-spacing: 0.3px; }

  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; border-radius: 0; max-width: none; }
    .section { page-break-inside: avoid; }
    .table-scroll { overflow: visible; }
  }

  @media (max-width: 600px) {
    .doc-header { flex-direction: column; align-items: flex-start; }
    .doc-header .title-block { text-align: left; }
    .doc-body { padding: 24px 20px 36px; }
    .doc-footer { flex-direction: column; }
  }
`;
