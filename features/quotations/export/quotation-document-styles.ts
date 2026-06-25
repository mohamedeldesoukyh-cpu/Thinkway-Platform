/**
 * Print/PDF styles for client quotation exports.
 * Uses Thinkway brand green (#1D9E75) for document chrome — not app Tailwind tokens.
 */
export const QUOTATION_DOCUMENT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  :root {
    --brand: #1D9E75;
    --brand-soft: #E8F6F0;
    --ink: #1A1F36;
    --muted: #6B7280;
    --rule: #E5E7EB;
    --bg: #F8FAF9;
    --white: #FFFFFF;
    --success: #1D9E75;
    --warning: #D97706;
    --danger: #DC2626;
    --destructive: var(--danger);
  }

  @page {
    size: A4;
    margin: 14mm;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: var(--ink);
    background: var(--bg);
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page-break { page-break-before: always; break-before: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }

  .doc { max-width: 210mm; margin: 0 auto; background: var(--white); }

  /* Cover */
  .cover {
    min-height: 250mm;
    padding: 28mm 18mm 18mm;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, var(--brand-soft) 0%, var(--white) 42%);
    border-bottom: 4px solid var(--brand);
  }
  .cover-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .brand-mark { font-size: 28px; font-weight: 800; color: var(--brand); letter-spacing: -0.6px; }
  .brand-mark small { display: block; font-size: 10px; font-weight: 600; color: var(--muted); letter-spacing: 1.2px; text-transform: uppercase; margin-top: 4px; }
  .confidential {
    font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    color: var(--danger); border: 1px solid var(--danger); padding: 4px 10px; border-radius: 999px;
  }
  .cover-title { margin-top: 36px; }
  .cover-title h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; }
  .cover-title p { margin-top: 8px; color: var(--muted); font-size: 13px; }
  .cover-meta-grid {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .meta-card {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.85);
  }
  .meta-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); }
  .meta-card .value { margin-top: 3px; font-size: 12px; font-weight: 600; }
  .hero-kpis {
    margin-top: auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding-top: 24px;
  }
  .hero-kpi {
    background: var(--brand);
    color: #fff;
    border-radius: 10px;
    padding: 14px 12px;
  }
  .hero-kpi .label { font-size: 9px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px; }
  .hero-kpi .value { margin-top: 4px; font-size: 18px; font-weight: 700; }

  /* Inner pages */
  .section { padding: 16mm 18mm; }
  .section-head {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid var(--brand); padding-bottom: 8px; margin-bottom: 14px;
  }
  .section-head h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
  .section-head .serial { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); }

  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .kpi {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--bg);
  }
  .kpi .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .kpi .value { margin-top: 3px; font-size: 14px; font-weight: 700; }

  table.data { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.data thead th {
    background: var(--brand);
    color: #fff;
    text-align: left;
    padding: 8px 6px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.35px;
  }
  table.data tbody td { padding: 7px 6px; border-bottom: 1px solid var(--rule); vertical-align: top; }
  table.data tbody tr:nth-child(even) { background: #FAFBFC; }
  table.data td.num, table.data th.num { text-align: right; white-space: nowrap; }
  table.data td.creator { font-weight: 600; max-width: 120px; }

  .summary-box {
    margin-top: 14px;
    display: flex;
    justify-content: flex-end;
  }
  .summary-box table { width: 280px; border-collapse: collapse; }
  .summary-box td { padding: 6px 8px; border-bottom: 1px solid var(--rule); }
  .summary-box tr.total td { font-weight: 700; border-top: 2px solid var(--brand); }
  .summary-box tr.gp td.num { font-weight: 700; }

  .terms-list { list-style: none; }
  .terms-list li { margin-bottom: 10px; }
  .terms-list h4 { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
  .terms-list p { font-size: 10.5px; color: var(--ink); }

  .sign-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-top: 40px;
  }
  .sign-slot { border-top: 1px solid var(--ink); padding-top: 8px; min-height: 64px; }
  .sign-slot .role { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .sign-slot .hint { margin-top: 28px; font-size: 10px; color: var(--muted); }

  .revision-foot {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px dashed var(--rule);
    font-size: 9px;
    color: var(--muted);
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .badge-expired { background: #FEE2E2; color: var(--danger); }
  .badge-status { background: var(--brand-soft); color: var(--brand); }
`;
