"use client";
import { formatMoneyKpi } from '@/lib/finance/currency-format';
import { clientQuotationCommercialView, clientFacingCreatorCardAmount } from '../selection-flow';
import { originalInvestmentForDisplay, visibleOriginalCurrencyAmount } from '../quotation-client-facing';
import type { ClientWorkspaceView } from '../types';
import { CommercialReveal, CommercialCount } from './commercial-motion';

export function commercialPresentation(view: ClientWorkspaceView) {
  const approved = clientQuotationCommercialView(view.creators, view.journey?.clientSelection);
  const ids = new Set([...approved.original.creatorIds, ...approved.extensions.flatMap(x => x.creatorIds)]);
  const creators = new Map(view.creators.map(x => [x.creatorId, x]));
  const source = view.quotation?.lines.length ? view.quotation.lines : view.commercial.lines.map((line, index) => ({...line, creatorId: view.creators.find(x => x.displayName === line.label)?.creatorId ?? `line-${index}`}));
  const rows = source.map(line => {
    const creator = creators.get(line.creatorId);
    return {id: line.creatorId, name: line.label, creator,
      amount: view.hideCostAndFees && creator ? clientFacingCreatorCardAmount(creator) : line.amount,
      status: ids.has(line.creatorId) ? 'Client approved' : 'Pending your approval'};
  });
  for (const id of ids) {
    if (rows.some(row => row.id === id)) continue;
    const creator = creators.get(id);
    if (creator) rows.push({id, name: creator.displayName, creator, amount: view.hideCostAndFees ? clientFacingCreatorCardAmount(creator) : creator.investmentAmount, status: 'Client approved'});
  }
  return {rows, count: new Set(rows.map(x => x.id)).size, subtotal: rows.reduce((sum, x) => sum + (x.amount ?? 0), 0),
    fees: ids.size ? approved.original.agencyFees + approved.extensions.reduce((sum, x) => sum + x.agencyFees, 0) : null,
    total: approved.totalInvestment > 0 ? approved.totalInvestment : null,
    approved: view.journey?.quotationStage === 'approved' && ids.size > 0};
}

export function CommercialInvestment({view}: {view: ClientWorkspaceView}) {
  const model = commercialPresentation(view);
  const currency = view.commercial.currency;
  const money = (n: number) => formatMoneyKpi(n, currency);
  return <>
    <CommercialReveal className="cm-hero">
      <div className="cm-hero-top"><p className="cm-eyebrow">Campaign investment</p><span className={`cm-pill ${model.approved ? 'success' : 'info'}`}>{model.approved ? 'Approved' : 'Awaiting your approval'}</span></div>
      <h2 className="cm-amount">{model.subtotal > 0 ? <><span className="cm-currency">{currency}</span><CommercialCount value={model.subtotal} format={n => money(n).replace(currency, "").trim()}/></> : 'To be confirmed'}</h2>
      <p className="cm-caption">Proposed creator {view.hideCostAndFees ? 'investment' : 'cost'} · {model.count} creators{view.quotation ? <> · quotation <bdi>{view.quotation.serialNumber}</bdi>{view.quotation.version ? ` (v${view.quotation.version})` : ''}</> : null}</p>
      <p className="cm-helper">{model.approved ? 'Your commercial approval is recorded. View or download the campaign documents below.' : model.total ? 'Review the proposed investment and campaign documents before confirming commercial approval.' : 'Review and approve your creator selection. Agency fees and the final total investment will appear once confirmed.'}</p>
      <div className="cm-stats"><div><span>Proposed creators</span><strong><CommercialCount value={model.count}/></strong></div>{!view.hideCostAndFees && <div><span>Agency fees</span><strong className={model.fees == null ? 'cm-muted' : ''}>{model.fees == null ? 'To be confirmed' : money(model.fees)}</strong></div>}<div><span>Total investment</span><strong className={model.total == null ? 'cm-muted' : ''}>{model.total == null ? 'To be confirmed' : money(model.total)}</strong></div></div>
    </CommercialReveal>
    <CommercialReveal className="cm-list">
      <div className="cm-list-head"><h2>Proposed creators</h2><span>{model.count} creators · {money(model.subtotal)}</span></div>
      {model.rows.map((row, index) => {
        const original = row.creator && visibleOriginalCurrencyAmount(originalInvestmentForDisplay(row.creator, currency), Boolean(view.showOriginalCurrency));
        const segments = row.name.match(/[\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+)*|[^\u0600-\u06ff]+/g) ?? [row.name];
        return <div className="cm-creator" key={`${row.id}-${index}`}>
          <span className="cm-avatar" aria-hidden="true">{row.name.trim().split(/\s+/).slice(0, 2).map(x => Array.from(x)[0]).join('').toUpperCase()}</span>
          <div className="cm-creator-main"><span className="cm-name">{segments.map((segment, i) => <bdi key={i}>{segment}</bdi>)}</span><span className="cm-meta">{row.status}</span></div>
          <div className="cm-price">{row.amount != null ? money(row.amount) : 'To be confirmed'}{original && <span className="cm-meta">Original: {formatMoneyKpi(original.amount, original.currency)}</span>}</div>
          <div className="cm-track" aria-hidden="true"><span style={{width: `${model.subtotal > 0 ? Math.max(0, (row.amount ?? 0) / model.subtotal * 100) : 0}%`}}/></div>
        </div>;
      })}
      {!model.rows.length && <p className="cm-helper cm-empty">Review your creator selection to build the proposed investment.</p>}
      <div className="cm-list-foot"><span>Subtotal{!view.hideCostAndFees && <small>Creator costs only · agency fees {model.fees == null ? 'to be confirmed' : 'shown separately above'}</small>}</span><strong>{model.subtotal > 0 ? money(model.subtotal) : 'To be confirmed'}</strong></div>
    </CommercialReveal>
  </>;
}
