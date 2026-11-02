import type { StatementsReportData, StatementLedgerLine } from "../statements/statement-types";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { THINKWAY_AGENCY_DEFAULTS as agency } from "@/lib/io/thinkway-agency-defaults";
import { statementCss, statementLogo } from "./statement-assets";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money = (n: number) => (n < 0 ? '−' : '') + (Math.abs(n) / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const cents = (n: number) => Math.round(n * 100);
const date = (s: string) => new Date(s.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});

export function statementCurrencyModel(report: StatementsReportData, currency: string) {
  const end = report.to_date ?? new Date().toISOString().slice(0,10);
  const sign = report.type === 'client' ? 1 : -1;
  const history = (report.history_lines ?? report.lines).filter(l => l.currency === currency && l.date <= end).sort((a,b) => a.date.localeCompare(b.date) || Number(a.kind.includes('payment')) - Number(b.kind.includes('payment')) || a.document_number.localeCompare(b.document_number));
  const opening = history.filter(l => report.from_date && l.date < report.from_date).reduce((n,l) => n + sign*(cents(l.debit)-cents(l.credit)),0);
  let balance = opening;
  const rows = history.filter(l => !report.from_date || l.date >= report.from_date).map(l => {
    balance += sign*(cents(l.debit)-cents(l.credit));
    return {...l, balance:balance/100};
  });
  const debit = rows.reduce((n,l)=>n+cents(l.debit),0), credit = rows.reduce((n,l)=>n+cents(l.credit),0);
  let credits = history.reduce((n,l)=>n+cents(report.type==='client'?l.credit:l.debit),0);
  const dueBased = history.some(l => l.due_date);
  const aging = [0,0,0,0,0];
  for(const l of history) {
    let amount=cents(report.type==='client'?l.debit:l.credit);
    const applied=Math.min(amount,credits); amount-=applied; credits-=applied;
    const days=Math.floor((Date.parse(end)-Date.parse(dueBased ? l.due_date || l.date : l.date))/86400000);
    const bucket = dueBased ? (days<=0?0:days<=30?1:days<=60?2:days<=90?3:4) : (days<=30?0:days<=60?1:days<=90?2:days<=120?3:4);
    aging[bucket]!+=amount;
  }
  return {end,opening,rows,balance,debit,credit,aging,dueBased,unapplied:credits};
}

export function renderStatementHtml(report: StatementsReportData): string {
  const code=esc(formatDocumentNumberForDisplay(report.entity_code));
  const generated=new Date().toLocaleString('en-GB',{timeZone:'Africa/Cairo'});
  const currencies=[...new Set((report.history_lines ?? report.lines).map(l=>l.currency))];
  if(!currencies.length) currencies.push(report.currency);
  const thead='<colgroup><col style="width:76px"><col style="width:104px"><col style="width:74px"><col><col style="width:100px"><col style="width:100px"><col style="width:108px"></colgroup><thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Campaign</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead>';
  const band=(currency:string)=>`<header class="band"><div class="brand"><img src="${statementLogo}" alt="Thinkway"><span>Ideas. Influence. Impact.</span></div><div class="doc"><h1>Statement of Account</h1><div class="ref"><b>${code}</b> · ${esc(currency)}</div></div></header>`;
  const row=(l:StatementLedgerLine)=>`<tr data-balance="${cents(l.balance)}"><td>${esc(date(l.date))}</td><td><span class="doc-no">${esc(formatDocumentNumberForDisplay(l.document_number))}</span></td><td><span class="type ${l.kind==='credit_note'?'type--cn':l.kind.includes('payment')?'type--pay':'type--inv'}">${l.kind==='credit_note'?'Credit note':l.kind==='debit_note'?'Debit note':l.kind.includes('payment')?'Payment':'Invoice'}</span></td><td>${esc(l.campaign_name)||'—'}</td><td class="r num">${l.debit?money(cents(l.debit)):'—'}</td><td class="r num">${l.credit?money(cents(l.credit)):'—'}</td><td class="r num">${money(cents(l.balance))}</td></tr>`;
  const groups=currencies.map(currency=>{
    const m=statementCurrencyModel(report,currency);
    const tile=(label:string,amount:number,last=false)=>`<div class="tile ${last?'tile--due':''}"><span class="k">${label}</span><b class="num">${money(amount)}</b><small>${esc(currency)}</small></div>`;
    const aging=(m.dueBased ? ['Not yet due','1–30 overdue','31–60 overdue','61–90 overdue','Over 90 overdue'] : ['0–30 days','31–60 days','61–90 days','91–120 days','Over 120 days']).map((label,i)=>`<div class="ag ${m.aging[i]>0&&m.aging[i]===Math.max(...m.aging)?'ag--hot':''}"><span>${label}</span><b class="num">${money(m.aging[i])}</b></div>`).join('');
    const payment=report.type==='client'?`<dl class="pay"><dt>Account name</dt><dd>${esc(agency.beneficiary)}</dd><dt>Bank</dt><dd>${esc(agency.bankName)}</dd><dt>IBAN</dt><dd>${esc(agency.iban)}</dd><dt>SWIFT</dt><dd>${esc(agency.swift)}</dd><dt>Reference</dt><dd>${code} + invoice no.</dd></dl>`:'<p class="note">Payments are made to the vendor’s verified bank account on file.</p>';
    return `<section class="page" data-currency="${esc(currency)}" data-opening="${m.opening}">${band(currency)}<div class="body"><div class="intro"><div class="parties"><div class="to"><span class="k">${report.type==='client'?'Client':'Vendor'}</span><h2>${esc(report.entity_name)}</h2><p>${esc(report.group_name)}</p><p>${code}</p>${report.entity_address?`<p>${esc(report.entity_address)}</p>`:""}${report.entity_tax_id?`<p>Tax ID: ${esc(report.entity_tax_id)}</p>`:""}</div><dl class="meta"><dt>Statement date</dt><dd>${esc(date(m.end))}</dd><dt>Period</dt><dd>${report.from_date?esc(date(report.from_date)):'All dates'} – ${esc(date(m.end))}</dd><dt>Currency</dt><dd>${esc(currency)}</dd><dt>Transactions</dt><dd>${m.rows.length}</dd></dl></div><div class="sum">${tile('Opening balance',m.opening)}${tile(report.type==='client'?'Invoiced':'Payments',m.debit)}${tile(report.type==='client'?'Payments & credits':'Vendor invoices',m.credit)}${tile(m.balance<0?'Credit balance':'Balance due',Math.abs(m.balance),true)}</div></div><div class="sh"><h3>Account activity</h3><span>All amounts in ${esc(currency)}</span></div><table>${thead}<tbody><tr class="open"><td colspan="6">Opening balance${report.from_date?' · '+esc(date(report.from_date)):''}</td><td class="r num">${money(m.opening)}</td></tr>${m.rows.map(row).join('')||'<tr class="empty"><td colspan="7">No activity in this period.</td></tr>'}</tbody></table><div class="closing"><table><colgroup><col><col style="width:100px"><col style="width:100px"><col style="width:108px"></colgroup><tfoot><tr><td>Totals</td><td class="r num">${money(m.debit)}</td><td class="r num">${money(m.credit)}</td><td class="r num">${money(m.balance)}</td></tr></tfoot></table><div class="lower"><div class="box"><h3>Aging of balance</h3>${aging}${m.unapplied?`<div class="ag"><span>Unapplied credit</span><b>${money(-m.unapplied)}</b></div>`:''}<p class="note">Based on ${m.dueBased ? "due date (invoice date when unavailable)" : "invoice date"} as of ${esc(date(m.end))}. Credits applied to oldest invoices first.</p></div><div class="box"><h3>Payment details</h3>${payment}</div></div><p class="terms"><b>Please check this statement against your records.</b> If anything differs, contact Thinkway accounts quoting the client ID and document number. Payments received after the statement date will appear on the next statement.</p></div></div><footer class="foot"><span><b>Thinkway Platform</b> · Confidential</span><span>${esc(generated)} Cairo</span><span class="page-number"></span></footer></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Statement of Account — ${code}</title><style>${statementCss}
  td,th{padding:9px 6px}tbody td:first-child{font-size:10px}td .doc-no{font-size:9px}.num{font-size:10px}.tile b{font-size:16px}.pay dd{overflow-wrap:anywhere}.brand span{letter-spacing:1px}.page{margin-bottom:24px}.page .body{padding-bottom:0}.closing{break-inside:avoid}.toolbar{position:sticky;top:0;padding:12px;background:#050443;text-align:center;z-index:2}.toolbar a{display:inline-block;margin:0 5px;background:white;border-radius:6px;padding:9px 16px;color:#050443;font:14px Arial;text-decoration:none}@media print{.toolbar{display:none}.page{margin-bottom:0}}
  </style></head><body><nav class="toolbar" aria-label="Statement downloads"><a id="download-pdf">Download PDF</a><a id="download-html">Download HTML</a></nav>${groups}<script>
  (async()=>{await document.fonts.ready;
  const fmt=n=>(n<0?'−':'')+(Math.abs(n)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  for(const original of [...document.querySelectorAll('.page')]){
    let current=original;const closing=original.querySelector('.closing');closing.remove();
    const rows=[...original.querySelectorAll('tbody tr')].slice(1);rows.forEach(r=>r.remove());
    function next(){const p=original.cloneNode(true);p.querySelector('.intro')?.remove();p.querySelector('.closing')?.remove();p.querySelector('.band').classList.add('band--compact');p.querySelector('.sh h3').textContent='Account activity, continued';p.querySelector('tbody').innerHTML='';current.after(p);current=p;return p;}
    function carry(balance){current.querySelector('tbody').innerHTML='<tr class="carry"><td colspan="6">Balance brought forward</td><td class="r num">'+fmt(balance)+'</td></tr>';}
    const fits=()=>current.querySelector('.body').getBoundingClientRect().bottom<=current.querySelector('.foot').getBoundingClientRect().top-18;
    let balance=Number(original.dataset.opening);
    for(const row of rows){current.querySelector('tbody').append(row);if(!fits()&&current.querySelectorAll('tbody tr').length>2){row.remove();next();carry(balance);current.querySelector('tbody').append(row);}balance=Number(row.dataset.balance??balance);}
    current.querySelector('.body').append(closing);
    if(!fits()){closing.remove();const last=current.querySelector('tbody tr:last-child');const previous=last?.previousElementSibling;const brought=Number(previous?.dataset.balance??original.dataset.opening);if(last&&!last.classList.contains('carry')&&!last.classList.contains('open'))last.remove();next();carry(brought);if(last)current.querySelector('tbody').append(last);current.querySelector('.body').append(closing);}
  }
  const pages=[...document.querySelectorAll('.page')];pages.forEach((p,i)=>p.querySelector('.page-number').textContent='Page '+(i+1)+' of '+pages.length);
  for(const format of ['pdf','html']){const u=new URL(location.href);u.searchParams.set('format',format);u.searchParams.set('download','1');document.getElementById('download-'+format).href=u.href;}
  document.documentElement.setAttribute('data-statement-ready','true');})();
  </script></body></html>`;
}
