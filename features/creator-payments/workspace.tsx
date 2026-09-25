"use client";
import { paymentCurrencyRate } from "./payment-plan";
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { COMMERCIAL_CURRENCIES } from '@/lib/commercial/fx-aggregation';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OperationalFloatingActionBar } from '@/components/workspace/operational-floating-action-bar';
import { DecimalInput } from './decimal-input';
import { paymentAllocation } from './allocations';
import { PaymentRegister } from './payment-register';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { loadCreatorPayments, recordCreatorPayments, exportCreatorPayments, downloadCreatorPaymentBatch, confirmCreatorPayment } from './actions';
import { CREATOR_BANK_SAVED, applySavedCreatorBank, type CreatorBankSaved } from './bank-sync';
import { AaibBankEditor, downloadFile } from './bank-editor';
import { calculatePayment, money, type PaymentRow, type PaymentDraft, type PaymentBatch } from './model';
import { PAYMENT_FILENAME, type ExportSettings } from './aaib';
import { defaultPaymentDraft as defaultDraft, changedPaymentPlans } from './payment-plan';
import purposes from './purpose-codes.json';
import { CampaignWorkspaceFrame, type WorkspaceSummaryStat } from '@/features/campaigns/components/aurora/campaign-workspace-frame';
import '@/app/styles/creator-payments.css';
const fmt = (n: number, c: string) => `${Number.isFinite(n) ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '—'} ${c}`;
const inputClass = 'h-9 rounded-md border bg-background px-2 text-sm';
function PaymentLoading() {
    return <div className="cp-panel cp-loading" aria-busy="true">
        <div className="cp-panel-head"><span className="cp-loading-spinner" aria-hidden="true"/><div role="status" aria-live="polite"><h2>Loading creator payments</h2><p>Fetching creator fees, VAT and payment balances. Please wait…</p></div></div>
        <div className="cp-loading-track" role="progressbar" aria-label="Loading creator payments"><span/></div>
        <div aria-hidden="true"><div className="cp-summary">{['Agreed fees', 'VAT', 'Total creator fees', 'Paid', 'Outstanding'].map(label => <div key={label}><span>{label}</span><i className="cp-loading-placeholder"/></div>)}</div>
        <div className="cp-loading-rows">{[0, 1, 2].map(row => <div className="cp-loading-row" key={row}><i className="cp-loading-placeholder cp-loading-avatar"/><i className="cp-loading-placeholder"/><i className="cp-loading-placeholder"/><i className="cp-loading-placeholder"/></div>)}</div></div>
    </div>;
}
function Totals({ rows, drafts, selected = false, floating = false, tools }: {
    rows: PaymentRow[];
    drafts: Record<string, PaymentDraft>;
    selected?: boolean;
    floating?: boolean;
    tools?: ReactNode;
}) {
    const totals = new Map<string, {
        fee: number;
        vat: number;
        total: number;
        paid: number;
        outstanding: number;
        remaining: number;
        earned: number;
        advance: number;
    }>();
    const payments = new Map<string, number>();
    for (const row of rows) {
        const draft = drafts[row.assignmentId] ?? defaultDraft(row);
        const c = calculatePayment(row, draft);
        const t = totals.get(row.currency) ?? { fee: 0, vat: 0, total: 0, paid: 0, outstanding: 0, remaining: 0, earned: 0, advance: 0 };
        const allocation = paymentAllocation(row);
        t.earned += allocation.earned; t.advance += allocation.advance;
        t.fee += c.fee;
        t.vat += c.vatAmount;
        t.total += c.total;
        t.paid += row.paid;
        t.outstanding += c.outstanding;
        t.remaining += c.remaining;
        totals.set(row.currency, t);
        payments.set(draft.currency, (payments.get(draft.currency) ?? 0) + (Number.isFinite(c.payNow) ? c.payNow : 0));
    }
    const metrics: { key: keyof NonNullable<ReturnType<typeof totals.get>>; label: string; tone?: WorkspaceSummaryStat['tone'] }[] = [
        { key: 'fee', label: 'Agreed fees', tone: 'blue' },
        { key: 'vat', label: 'VAT' },
        { key: 'total', label: 'Total creator fees' },
        { key: 'paid', label: 'Paid', tone: 'pos' },
        { key: 'outstanding', label: 'Remaining to pay', tone: 'amber' },
        { key: 'earned', label: 'Actual / earned' },
        { key: 'advance', label: 'Advance', tone: 'amber' },
        ...(selected ? [{ key: 'remaining' as const, label: 'Remaining after payment' }] : []),
    ];
    const stats: WorkspaceSummaryStat[] = metrics.map(metric => ({
        key: metric.key, label: metric.label, tone: metric.tone,
        value: totals.size ? <div className="space-y-1">{[...totals].map(([currency, total]) => <div key={currency}>{currency} {fmt(money(total[metric.key]), currency).replace(' '+currency, '')}</div>)}</div> : '—',
    }));
    if (selected) stats.push({ key: 'pay-now', label: 'Pay now', tone: 'blue', value: <div className="space-y-1">{[...payments].map(([currency, value]) => <div key={currency}>{fmt(money(value),currency)}</div>)}</div> });
    if (floating) return <div className="tw-selbar-sum">{stats.filter(stat => ["fee", "vat", "total", "pay-now", "remaining"].includes(stat.key)).map(stat => <span key={stat.key} className="tw-selbar-metric"><i>{stat.label}</i><b className={stat.key === "pay-now" ? "g" : undefined}>{stat.value}</b></span>)}</div>;
    if (!selected) return <div className="cp-panel"><div className="cp-panel-head"><h2>Creator payment totals</h2><span>Agreed fees, VAT and balances · original currencies</span><div className="cp-head-actions">{tools}</div></div><div className="cp-summary">{stats.map(stat => <div key={stat.key}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div><p className="cp-note">{new Set(rows.map(row => row.creatorId)).size} creators · {rows.length} payment lines. Totals include VAT. Save records an actual payment; exports stay pending until confirmed.</p></div>;
    return <CampaignWorkspaceFrame
        title={selected ? 'Selected creator payments' : 'Creator payment totals'}
        subtitle={selected ? `${new Set(rows.map(row => row.creatorId)).size} creators · ${rows.length} payments` : 'Agreed fees, VAT and payment balances · original currencies'}
        tools={tools}
        stats={stats}
    />;
}
export function CreatorPaymentsWorkspace({ campaignId, creatorId }: {
    campaignId?: string;
    creatorId?: string;
}) {
    const router = useRouter();
    const [canWrite, setCanWrite] = useState(false);
    const [search, setSearch] = useState('');
    const [campaignFilter, setCampaignFilter] = useState('');
    const [rows, setRows] = useState<PaymentRow[]>([]);
    const [batches, setBatches] = useState<PaymentBatch[]>([]);
    const [drafts, setDrafts] = useState<Record<string, PaymentDraft>>({});
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [bankRow, setBankRow] = useState<PaymentRow | null>(null);
    const [activeTab, setActiveTab] = useState('payments');
    const [calculatorOpen, setCalculatorOpen] = useState(false);
    const [template, setTemplate] = useState('aaib-bulk-advice');
    const [exportOpen, setExportOpen] = useState(false);
    const [resultOpen, setResultOpen] = useState<string | null>(null);
    const [reference, setReference] = useState('');
    const [outcome, setOutcome] = useState<'paid' | 'failed'>('paid');
    const [bulkPct, setBulkPct] = useState(50);
    const [bulkCurrency, setBulkCurrency] = useState('');
    const loadVersion = useRef(0);
    const requestId = useRef<string | null>(null);
    const [settings, setSettings] = useState<ExportSettings>({ debitAccount: '', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), charge: 'SHA', purpose: '', details: 'Creator campaign payment', advice: false });
    const acceptResult = useCallback((r: Awaited<ReturnType<typeof loadCreatorPayments>>, preserveDrafts = false) => { setLoading(false); if (!r.ok) {
        setError(r.message);
        return;
    } setError(''); setCanWrite(r.canWrite); setRows(r.rows); setBatches(r.batches); if (!preserveDrafts) { setDrafts({}); setSelected(new Set()); } }, []);
    const reload = useCallback(async (preserveDrafts = false) => {
        const version = ++loadVersion.current;
        if (!preserveDrafts) setLoading(true);
        setError('');
        try { const result = await loadCreatorPayments({ campaignId, creatorId }); if (version === loadVersion.current) acceptResult(result, preserveDrafts); }
        catch { if (version === loadVersion.current) { setLoading(false); setError('Could not load payments. Please try Refresh again.'); } }
    }, [campaignId, creatorId, acceptResult]);
    // The counter intentionally invalidates every outstanding request on cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    useEffect(() => { void reload(); return () => { loadVersion.current++; }; }, [reload]);
    useEffect(() => {
        const saved = (event: Event) => {
            const change = (event as CustomEvent<CreatorBankSaved>).detail;
            if (!change?.creatorId || !change.bank) return;
            // A completed save supersedes every load that started before it.
            loadVersion.current++;
            requestId.current = null;
            setLoading(false);
            setRows(current => applySavedCreatorBank(current, change));
            setBankRow(current => current?.creatorId === change.creatorId ? { ...current, bank: change.bank } : current);
            void reload(true);
        };
        const refresh = () => { if (document.visibilityState === 'visible') void reload(true); };
        const timer = window.setInterval(refresh, 30000);
        window.addEventListener(CREATOR_BANK_SAVED, saved);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => { window.clearInterval(timer); window.removeEventListener(CREATOR_BANK_SAVED, saved); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [reload]);
    function patch(row: PaymentRow, change: Partial<PaymentDraft>) { if (busy || !canWrite) return; requestId.current = null; paymentRequest.current = null; setDrafts(current => ({ ...current, [row.assignmentId]: { ...(current[row.assignmentId] ?? defaultDraft(row)), ...change } })); }
    const [registerFilter,setRegisterFilter]=useState('all');
    const dirtyRows = changedPaymentPlans(rows, drafts).filter(row => calculatePayment(row,drafts[row.assignmentId]).payNow > 0);
    const paymentRequest = useRef<{id:string; items:{assignmentId:string;draft:PaymentDraft}[]} | null>(null);
    async function savePlans() {
        if (!dirtyRows.length || busy) return;
        paymentRequest.current ??= {id:crypto.randomUUID(),items:dirtyRows.map(row=>({assignmentId:row.assignmentId,draft:{...drafts[row.assignmentId],mode:'manual',amount:calculatePayment(row,drafts[row.assignmentId]).payNow}}))};
        const saved = paymentRequest.current.items;
        setBusy(true);
        loadVersion.current++;
        try {
            const result = await recordCreatorPayments(paymentRequest.current.id,saved);
            if (!result.ok) { toast.error(result.message); return; }
            loadVersion.current++;
            setDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !saved.some(item => item.assignmentId === id))));
            paymentRequest.current = null;
            toast.success('Payment recorded. History and remaining balances updated.');
            await reload(true);
        } catch { toast.error('Could not confirm the save. Your entries are kept; retrying will not duplicate the payment.'); }
        finally { setBusy(false); }
    }
    const visibleRows = rows.filter(r => (!campaignFilter || r.campaignId === campaignFilter) && `${r.creator} ${r.username ?? ""}`.toLowerCase().includes(search.toLowerCase()));
    const chosen = rows.filter(r => selected.has(r.assignmentId));
    const oneCampaign = new Set(chosen.map(r => r.campaignId)).size === 1;
    const purposeSource = chosen.some(r => r.bank.payment_type === 'I') ? purposes.international : purposes.domestic;
    const purposeOptions = purposeSource.filter(p => chosen.every(r => (r.bank.payment_type === 'I' ? purposes.international : purposes.domestic).some(code => code.value === p.value)));
    async function exportBatch() { if (!chosen.length || !oneCampaign)
        return; setBusy(true); requestId.current ??= crypto.randomUUID(); const r = await exportCreatorPayments({ id: requestId.current, campaignId: chosen[0].campaignId, settings, rows: chosen.map(row => ({ assignmentId: row.assignmentId, draft: drafts[row.assignmentId] ?? defaultDraft(row) })) }); setBusy(false); if (!r.ok) {
        toast.error(r.message);
        return;
    } downloadFile(r.csv, PAYMENT_FILENAME, 'text/csv;charset=windows-1252'); setExportOpen(false); requestId.current = null; toast.success('Export saved. Confirm results after the bank processes it.'); await reload(); router.refresh(); }
    return <section className={`thinkway-creator-payments space-y-3 ${chosen.length ? "creator-payments-has-selection" : ""}`} aria-label="Creator payments">
    {!loading && <Totals rows={rows} drafts={{}} tools={<Button className="thinkway-campaign-btn" variant="outline" onClick={() => void reload(true)}>Refresh</Button>}/>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{loading ? <PaymentLoading/> : <>
    {!rows.length && !error && <p className="text-sm text-muted-foreground">Creator payments appear here after a creator IO has been generated. Continue using the existing IO workflow.</p>}
    {!['advance','paid'].includes(registerFilter) && !!dirtyRows.length && <div className="cp-save-bar" role="status"><span><b>{dirtyRows.length} payments ready to record</b> · Save records money already paid. For a bank upload, use Export instead.</span><div><Button variant="outline" disabled={busy} onClick={() => { paymentRequest.current=null; setDrafts({}); }}>Discard</Button><Button disabled={busy || !canWrite} onClick={() => void savePlans()}>{busy ? 'Saving…' : 'Save payments'}</Button></div></div>}
    <Tabs value={activeTab} onValueChange={setActiveTab} className="campaign-finance-workspace"><TabsList aria-label="Creator payment sections" className="campaign-finance-tabs"><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="export">Export</TabsTrigger></TabsList><TabsContent value="payments">
    {!!rows.length && <PaymentRegister filter={registerFilter} onFilterChange={setRegisterFilter} onSaved={async savedRow => { if (savedRow) { setRows(current => current.map(row => row.assignmentId === savedRow.assignmentId ? savedRow : row)); setDrafts(current=>{const next={...current};delete next[savedRow.assignmentId];return next;}); paymentRequest.current=null;requestId.current=null; } await reload(true); }} rows={visibleRows} drafts={drafts} selected={selected} canWrite={canWrite && !busy} showCampaign={!campaignId} onPatch={patch} onBank={setBankRow} onSelect={(id, checked) => { requestId.current = null; setSelected(current => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; }); }} onSelectAll={(ids, checked) => { requestId.current = null; setSelected(current => { const next = new Set(current); ids.forEach(id => checked ? next.add(id) : next.delete(id)); return next; }); }} onExport={() => setActiveTab('export')} onReview={() => { requestId.current = null; setExportOpen(true); }} canReview={canWrite && chosen.length > 0 && oneCampaign} filters={<><Input aria-label="Filter creators" placeholder="Find creator…" value={search} onChange={e => setSearch(e.target.value)}/>{!campaignId && <select className={inputClass} aria-label="Filter campaigns" value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}><option value="">All campaigns</option>{[...new Map(rows.map(r => [r.campaignId, r.campaign])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}</>}/>}

    {!['advance','paid'].includes(registerFilter) && !!dirtyRows.length && !chosen.length && <div className="cp-save-bar cp-save-bottom"><span>Record payments already made, with their payment dates.</span><div><Button variant="outline" disabled={busy} onClick={() => { paymentRequest.current=null; setDrafts({}); }}>Discard</Button><Button disabled={busy || !canWrite} onClick={() => void savePlans()}>{busy ? 'Saving…' : 'Save payments'}</Button></div></div>}
    </TabsContent><TabsContent value="export"><div className="creator-payment-export-panel space-y-3"><h3 className="font-semibold">Export payments</h3><p className="text-muted-foreground">Select creators in Payments, then choose your bank template.</p><label className="block">Bank template<select className={`${inputClass} mt-1 block w-full max-w-md`} value={template} onChange={e => setTemplate(e.target.value)}><option value="aaib-bulk-advice">AAIB — Bulk payment with advice (CSV)</option></select></label><p>{chosen.length} payments selected · {new Set(chosen.map(r => r.creatorId)).size} creators</p>{chosen.length > 0 && !oneCampaign && <p className="text-amber-800">Select creators from one campaign per file.</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setActiveTab('payments')}>Choose creators</Button><Button disabled={!canWrite || !chosen.length || !oneCampaign || template !== 'aaib-bulk-advice'} onClick={() => { requestId.current = null; setExportOpen(true); }}>Review export</Button></div></div>
    <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Payment batch history ({batches.length})</summary>{batches.map(batch => <div key={batch.id} className="mt-3 space-y-2 border-t pt-3"><div className="flex items-center justify-between text-sm"><span>{batch.transfer_date} · {batch.entries.length} payments</span><Button variant="outline" size="sm" onClick={async () => { const r = await downloadCreatorPaymentBatch(batch.id); if (r.ok)
            downloadFile(r.csv, PAYMENT_FILENAME, 'text/csv;charset=utf-8');
        else
            toast.error(r.message); }}>Download same file</Button></div>{batch.entries.map(e => <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{e.creator_name} · {fmt(e.payment_amount, e.payment_currency)} · <b>{e.cleared_at ? 'Cleared record' : e.status === 'exported' ? 'Awaiting bank result' : e.revision ? 'Paid · revised record' : e.status}</b>{e.bank_reference ? ` · ${e.bank_reference}` : ''}</span>{canWrite && e.status === 'exported' && <Button size="sm" variant="outline" onClick={() => { setResultOpen(e.id); setReference(''); setOutcome('paid'); }}>Confirm result</Button>}</div>)}</div>)}</details>
    </TabsContent></Tabs>
    {!['advance','paid'].includes(registerFilter) && !loading && !!chosen.length && activeTab === 'payments' && !calculatorOpen && !exportOpen && <OperationalFloatingActionBar visible className="tw-selbar creator-payment-flybar"><span className="tw-selbar-n"><b>{chosen.length}</b> payments selected<button type="button" className="tw-selbar-x" aria-label="Clear selection" onClick={() => { requestId.current = null; setSelected(new Set()); }}>×</button></span><Totals rows={chosen} drafts={drafts} selected floating/><span className="tw-selbar-acts"><select aria-label="Payment percentage preset" className="payment-bar-percent" value={bulkPct} onChange={e => setBulkPct(Number(e.target.value))}><option value={25}>25%</option><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100%</option>{![25,50,75,100].includes(bulkPct) && <option value={bulkPct}>{bulkPct}%</option>}</select><DecimalInput percentage aria-label="Custom payment percentage" className="payment-bar-percent" value={bulkPct} onValueChange={setBulkPct}/><button className="tw-selbar-btn" disabled={!canWrite} onClick={() => chosen.forEach(r => patch(r, { mode: 'percent', percent: bulkPct }))}>Apply %</button><button className="tw-selbar-btn pri" disabled={!canWrite || busy || !dirtyRows.length} onClick={() => void savePlans()}>Save payments</button><button className="tw-selbar-btn" onClick={() => setCalculatorOpen(true)}>Calculator</button><button className="tw-selbar-btn pri" onClick={() => setActiveTab('export')}>Export</button></span></OperationalFloatingActionBar>}
    </>}
    <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogTitle>Selected payment calculator</DialogTitle><Totals rows={chosen} drafts={drafts} selected/><div className="flex flex-wrap items-center gap-2"><DecimalInput percentage aria-label="Apply percentage to selected creators" className="w-20"  min="0" max="100" value={bulkPct} onValueChange={value => setBulkPct(value)}/><Button variant="outline" disabled={!chosen.length} onClick={() => chosen.forEach(r => patch(r, { mode: 'percent', percent: bulkPct }))}>Apply %</Button><select aria-label="Payment currency for selected creators" className={inputClass} value={bulkCurrency} onChange={e => setBulkCurrency(e.target.value)}><option value="">Currency</option>{COMMERCIAL_CURRENCIES.map(code => <option key={code}>{code}</option>)}</select><Button variant="outline" disabled={!chosen.length || !/^[A-Z]{3}$/.test(bulkCurrency)} onClick={() => chosen.forEach(r => patch(r, { currency: bulkCurrency, rate: paymentCurrencyRate(r, bulkCurrency) }))}>Apply currency</Button></div><p className="text-xs text-muted-foreground">Percentages use total creator fees including VAT. For a different payment currency, enter each creator’s exchange rate.</p><Button onClick={() => setCalculatorOpen(false)}>Done</Button></DialogContent></Dialog>
    <Dialog open={!!bankRow} onOpenChange={open => { if (!open)
        setBankRow(null); }}><DialogContent className="creator-bank-dialog"><DialogTitle className="sr-only">Creator bank details</DialogTitle>{bankRow && <AaibBankEditor key={bankRow.creatorId} creatorId={bankRow.creatorId} row={bankRow} initial={bankRow.bank}/>}</DialogContent></Dialog>
    <Dialog open={exportOpen} onOpenChange={setExportOpen}><DialogContent className="creator-payment-export-dialog thinkway-campaign-workspace max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogTitle>Review AAIB payment export</DialogTitle><p className="text-xs text-muted-foreground">Exporting does not mark payments as paid. Upload the file to AAIB, then confirm each result.</p><Totals rows={chosen} drafts={drafts} selected/>{(['debitAccount', 'date', 'details'] as const).map(key => <label key={key} className="text-sm">{key === 'debitAccount' ? 'Company AAIB debit account / IBAN' : key === 'date' ? 'Transfer date' : 'Payment details'}<Input type={key === 'date' ? 'date' : 'text'} value={settings[key]} onChange={e => { requestId.current = null; setSettings({ ...settings, [key]: e.target.value }); }}/></label>)}<label className="text-sm">Charges<select className={`${inputClass} w-full`} value={settings.charge} onChange={e => { requestId.current = null; setSettings({ ...settings, charge: e.target.value }); }}><option value="SHA">SHA — shared</option><option value="OUR">OUR — company pays</option><option value="BEN">BEN — beneficiary pays</option></select></label><label className="text-sm">Purpose code<select className={`${inputClass} w-full`} value={settings.purpose} onChange={e => { requestId.current = null; setSettings({ ...settings, purpose: e.target.value }); }}><option value="">Select bank purpose code</option>{purposeOptions.map((p, i) => <option key={`${p.value}-${i}`} value={p.value}>{p.value} — {p.label}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.advice} onChange={e => { requestId.current = null; setSettings({ ...settings, advice: e.target.checked }); }}/>Send beneficiary advice through AAIB (email required)</label>{settings.advice && chosen.map(row => { const d = drafts[row.assignmentId] ?? defaultDraft(row); return <fieldset key={row.assignmentId} className="space-y-2 rounded border p-3"><legend className="text-sm font-semibold">{row.creator} · invoice advice</legend><Input aria-label="Invoice number" placeholder="Actual invoice number" value={d.invoiceNumber ?? ''} onChange={e => patch(row, { invoiceNumber: e.target.value })}/><Input aria-label="Invoice date" type="date" value={d.invoiceDate ?? ''} onChange={e => patch(row, { invoiceDate: e.target.value })}/><label className="text-xs">Invoice amount ({d.currency})<DecimalInput  min="0" step="0.01" value={d.invoiceAmount ?? 0} onValueChange={value => patch(row, { invoiceAmount: value })}/></label></fieldset>; })}<Button disabled={busy || !canWrite} onClick={() => void exportBatch()}>{busy ? 'Preparing…' : `Download ${PAYMENT_FILENAME}`}</Button></DialogContent></Dialog>
    <Dialog open={!!resultOpen} onOpenChange={open => { if (!open)
        setResultOpen(null); }}><DialogContent><DialogTitle>Confirm bank payment result</DialogTitle><p className="text-sm">Record the actual result from AAIB. A successful result updates the creator balance everywhere.</p><select aria-label="Bank result" className={inputClass} value={outcome} onChange={e => setOutcome(e.target.value as 'paid' | 'failed')}><option value="paid">Successful payment</option><option value="failed">Rejected / cancelled before payment</option></select><Input aria-label="Bank reference or rejection reason" placeholder="Bank reference or rejection reason" value={reference} onChange={e => setReference(e.target.value)}/><Button disabled={busy || !reference.trim()} onClick={async () => { if (!resultOpen)
        return; setBusy(true); const r = await confirmCreatorPayment(resultOpen, outcome, reference); setBusy(false); if (!r.ok) {
        toast.error(r.message);
        return;
    } setResultOpen(null); toast.success('Payment result recorded.'); await reload(); router.refresh(); }}>Confirm result</Button></DialogContent></Dialog>
  </section>;
}
