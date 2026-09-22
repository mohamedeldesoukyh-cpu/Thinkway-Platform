"use client";
import './bank-editor.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { COMMERCIAL_CURRENCIES } from '@/lib/commercial/fx-aggregation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveAaibBank, exportAaibBeneficiaries, loadCreatorBankAccounts, setCreatorDefaultBank, checkCreatorBankDuplicates } from './actions';
import { BENEFICIARY_FILENAME, PAYMENT_FILENAME, paymentFileBytes, validateBank } from './aaib';
import { bankDetails, ioBadge, money, paymentStatus, type PaymentRow, type BankDetails } from './model';
import { isEmptyBank, duplicateFieldLabels, draftKey, readBankDrafts, type BankDuplicate } from './bank-form-state';
import { notifyCreatorBankSaved } from './bank-sync';
import { changeIban, fillFromIban, inspectIban } from './iban';
export function downloadFile(data: string, name: string, type: string, base64 = false) {
    const bytes = base64 ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : name === PAYMENT_FILENAME ? paymentFileBytes(data) : data;
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AaibBankEditor({ creatorId, initial, onSaved, row }: {
    creatorId: string; initial: BankDetails; onSaved?: () => void; row?: PaymentRow;
}) {
    const [draftStorageKey, setDraftStorageKey] = useState('');
    const [draftNotice, setDraftNotice] = useState('');
    const [draftStorageError, setDraftStorageError] = useState('');
    const [matches, setMatches] = useState<BankDuplicate[]>([]);
    const [checkingDuplicates, setCheckingDuplicates] = useState(false);
    const [duplicateCheckError, setDuplicateCheckError] = useState('');
    const [accounts, setAccounts] = useState<{ id: string; isDefault: boolean; bank: BankDetails }[]>([]);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [accountsError, setAccountsError] = useState('');
    const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
    const [makeDefault, setMakeDefault] = useState(false);
    const [bank, setBank] = useState(initial);
    const [savedBank, setSavedBank] = useState(initial);
    const [accountMode, setAccountMode] = useState(initial.iban || !initial.account_number ? 'iban' : 'account');
    const [routeMode, setRouteMode] = useState(!initial.swift && initial.identifier ? 'clearing' : 'swift');
    const [pending, setPending] = useState(false);
    const [ibanChecked, setIbanChecked] = useState(false);
    const [issues, setIssues] = useState<string[]>([]);
    const router = useRouter();
    const activeBank = { ...bank, iban: accountMode === 'iban' ? bank.iban : '', swift: routeMode === 'swift' ? bank.swift : '', identifier: routeMode === 'clearing' ? bank.identifier : '', clearing_code: routeMode === 'clearing' ? bank.clearing_code : '' };
    const dirty = JSON.stringify(activeBank) !== JSON.stringify(savedBank);
    const info = accountMode === 'iban' && bank.iban ? inspectIban(bank.iban) : null;
    const conflicts = Object.entries(info?.detected ?? {}).filter(([key, value]) => {
        const current = String(bank[key as keyof BankDetails]);
        return current && current !== value && !(key === 'swift' && current.slice(0, 8) === value);
    });
    const required: (keyof BankDetails)[] = [accountMode === 'iban' ? 'iban' : 'account_number', 'beneficiary_name', 'beneficiary_address', 'country', 'currency', 'payment_type', 'nickname'];
    if (bank.payment_type !== 'B') required.push(...(routeMode === 'swift' ? ['swift' as const] : ['bank_name', 'bank_branch', 'bank_address', 'identifier', 'clearing_code'] as const));
    const complete = required.filter(key => String(activeBank[key]).trim()).length;
    const remaining = required.length - complete;
    const currencyOptions = [...new Set([...COMMERCIAL_CURRENCIES, ...(bank.currency ? [bank.currency] : [])])];
    function rememberDraft() {
        if (!draftStorageKey || accountsLoading || accountsError) return;
        try {
            const cache = readBankDrafts(sessionStorage.getItem(draftStorageKey));
            cache.selected = accountId;
            if (dirty || makeDefault) cache.drafts[accountId ?? 'new'] = { bank, accountMode, routeMode, makeDefault, updatedAt: Date.now() };
            else delete cache.drafts[accountId ?? 'new'];
            sessionStorage.setItem(draftStorageKey, JSON.stringify(cache));
            setDraftStorageError('');
        } catch { setDraftStorageError('This browser could not keep your draft. Save before leaving this form.'); }
    }
    // Storage availability is external state; report failures instead of claiming the draft was kept.
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    useEffect(() => { rememberDraft(); }, [bank, savedBank, accountId, accountMode, routeMode, makeDefault, draftStorageKey, accountsLoading, accountsError]);
    function forgetDraft() {
        if (!draftStorageKey) return;
        try {
            const cache = readBankDrafts(sessionStorage.getItem(draftStorageKey));
            delete cache.drafts[accountId ?? 'new'];
            sessionStorage.setItem(draftStorageKey, JSON.stringify(cache));
        } catch { /* Saving remains available when browser storage is blocked. */ }
    }
    function chooseAccount(id: string, discard = false) {
        if (discard) forgetDraft(); else rememberDraft();
        const chosen = accounts.find(account => account.id === id);
        const next = chosen?.bank ?? bankDetails();
        let draft;
        try { draft = !discard && draftStorageKey ? readBankDrafts(sessionStorage.getItem(draftStorageKey)).drafts[id || 'new'] : undefined; } catch { /* Use saved data. */ }
        setAccountId(chosen?.id ?? null); setBank(draft?.bank ?? next); setSavedBank(next);
        setAccountMode(draft?.accountMode ?? (next.iban || !next.account_number ? 'iban' : 'account'));
        setRouteMode(draft?.routeMode ?? (!next.swift && next.identifier ? 'clearing' : 'swift'));
        setIbanChecked(false); setIssues([]); setDuplicate(null); setMatches([]); setMakeDefault(draft?.makeDefault ?? false);
        setDraftNotice(draft ? 'Restored your unsaved draft. Review it before saving.' : '');
    }
    function clearDetails() {
        setBank(bankDetails()); setAccountMode('iban'); setRouteMode('swift'); setMakeDefault(false);
        setIbanChecked(false); setIssues([]); setDuplicate(null); setMatches([]);
        setDraftNotice('Details cleared in this draft. Save cleared details to remove the incorrect saved data.');
    }
    useEffect(() => {
        let cancelled = false;
        void loadCreatorBankAccounts(creatorId).then(result => {
            if (cancelled) return;
            if (!result.ok) { setAccountsError(result.message); return; }
            setAccounts(result.accounts);
            const key = draftKey(result.draftScope, creatorId);
            setDraftStorageKey(key);
            let cache;
            try { cache = readBankDrafts(sessionStorage.getItem(key)); } catch { /* Storage is optional. */ }
            const selected = cache?.selected;
            const current = result.accounts.find(a => a.id === selected) ?? (cache?.drafts.new && selected === null ? undefined : result.accounts.find(a => a.isDefault) ?? result.accounts[0]);
            const restored = cache?.drafts[current?.id ?? 'new'];
            const saved = current?.bank ?? (cache?.drafts.new && selected === null ? bankDetails() : initial);
            const next = restored?.bank ?? saved;
            setAccountId(current?.id ?? null); setBank(next); setSavedBank(saved);
            setAccountMode(restored?.accountMode ?? (next.iban || !next.account_number ? 'iban' : 'account'));
            setRouteMode(restored?.routeMode ?? (!next.swift && next.identifier ? 'clearing' : 'swift'));
            setMakeDefault(restored?.makeDefault ?? false);
            if (restored) setDraftNotice('Restored your unsaved draft. Review it before saving.');
        }).catch(() => { if (!cancelled) setAccountsError('Could not load saved bank accounts. Close and reopen this form to retry.'); })
          .finally(() => { if (!cancelled) setAccountsLoading(false); });
        return () => { cancelled = true; };
    }, [creatorId]); // eslint-disable-line react-hooks/exhaustive-deps
    const duplicateInput = JSON.stringify({ nickname: bank.nickname, iban: accountMode === 'iban' ? bank.iban : '', account_number: accountMode === 'account' ? bank.account_number : '', beneficiary_name: bank.beneficiary_name, email: bank.email, mobile: bank.mobile, country: bank.country, swift: bank.swift, bank_name: bank.bank_name });
    useEffect(() => {
        if (accountsLoading || accountsError) return;
        let cancelled = false;
        // Reset the previous request's feedback before subscribing to the new lookup.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMatches([]); setDuplicateCheckError('');
        const values = JSON.parse(duplicateInput) as Record<string, string>;
        if (!Object.keys(duplicateFieldLabels).some(key => values[key]?.trim().length >= 3)) { setCheckingDuplicates(false); return; }
        setCheckingDuplicates(true);
        const timer = setTimeout(() => {
            void checkCreatorBankDuplicates(creatorId, accountId, values).then(result => {
                if (cancelled) return;
                if (result.ok) setMatches(result.matches); else setDuplicateCheckError(result.message);
            }).catch(() => { if (!cancelled) setDuplicateCheckError('Duplicate check unavailable. Saving still checks beneficiary nickname uniqueness.'); })
              .finally(() => { if (!cancelled) setCheckingDuplicates(false); });
        }, 600);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [creatorId, accountId, duplicateInput, accountsLoading, accountsError]);
    function duplicateHint(key: string) {
        if (!(key in duplicateFieldLabels)) return null;
        const found = matches.filter(match => match.field === key);
        if (!found.length) return null;
        return <span className={key === 'nickname' ? 'cbd-inline-duplicate cbd-error' : 'cbd-inline-duplicate cbd-warning'} role="status">{key === 'nickname' ? 'Already used — choose a distinct AAIB nickname.' : 'Also used by another saved account. Check that this is intentional.'} {found.map(match => <a key={match.account_id} href={`/vendors/${match.creator_id}`} target="_blank" rel="noopener noreferrer">{match.creator_name} ↗</a>)}</span>;
    }
    async function changeDefault() {
        if (!accountId) return;
        setPending(true);
        try {
            const result = await setCreatorDefaultBank(creatorId, accountId);
            if (!result.ok) { setIssues([result.message]); return; }
            notifyCreatorBankSaved(creatorId, result.defaultBank);
            setAccounts(previous => previous.map(a => ({ ...a, isDefault: a.id === accountId })));
            toast.success('Default bank account updated. New payment exports will use this account.'); onSaved?.(); router.refresh();
        } catch { setIssues(['Could not change the default account. Please try again.']); }
        finally { setPending(false); }
    }
    function update(key: keyof BankDetails, value: string) {
        setIssues([]); setDuplicate(null);
        setBank(previous => ({ ...previous, [key]: value, registered: false }));
    }
    function detect() {
        setIbanChecked(true);
        setBank(previous => fillFromIban(previous));
    }
    useEffect(() => {
        if (accountMode !== 'iban' || !bank.iban.trim() || pending) return;
        const timer = setTimeout(() => {
            setIbanChecked(true);
            setBank(previous => fillFromIban(previous));
        }, 500);
        return () => clearTimeout(timer);
    }, [bank.iban, accountMode, pending]);
    async function save() {
        const empty = isEmptyBank(activeBank);
        const errors = empty ? [] : validateBank(activeBank);
        if (!empty && accountMode === 'iban' && !bank.iban.trim()) errors.unshift('Enter an IBAN or select Account number.');
        if (!empty && matches.some(match => match.field === 'nickname')) errors.push('This AAIB beneficiary nickname is already used. Review the matching creator next to the nickname field.');
        setIssues(errors);
        if (errors.length) return;
        setPending(true);
        try {
            const r = await saveAaibBank(creatorId, activeBank, accountId, makeDefault);
            if (!r.ok) { setIssues([r.message]); setDuplicate('duplicate' in r ? r.duplicate ?? null : null); return; }
            notifyCreatorBankSaved(creatorId, r.defaultBank);
            forgetDraft(); setDraftNotice('');
            setAccountId(r.accountId); setDuplicate(null); setMakeDefault(false);
            const list = await loadCreatorBankAccounts(creatorId);
            if (list.ok) setAccounts(list.accounts);
            setBank(r.bank); setSavedBank(r.bank); router.refresh(); toast.success(r.message); onSaved?.();
        } catch { setIssues(['Could not save bank details. Please try again.']); } finally { setPending(false); }
    }
    function field(key: Exclude<keyof BankDetails, 'registered'>, label: string, placeholder = '', note?: string) {
        return <label className="cbd-field">{label}{note && <span> · {note}</span>}<Input className="cbd-input" value={bank[key]} placeholder={placeholder} aria-required={required.includes(key)} onChange={e => update(key, ['country', 'currency', 'swift'].includes(key) ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value)}/>{duplicateHint(key)}</label>;
    }
    const name = row?.creator || initial.beneficiary_name || 'Creator bank details';
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const total = row ? money(row.fee + money(row.fee * row.vat / 100)) : 0;
    const amount = (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${row?.currency ?? ''}`;
    return <section className="creator-bank-card">
      <aside className="cbd-identity">
        <div className="cbd-avatar" aria-hidden="true">{row || initial.beneficiary_name ? initials : 'AAIB'}</div>
        {row?.campaign && <p className="cbd-campaign">{row.campaign}</p>}
        <h2>{name}</h2>{row?.username && <p className="cbd-handle">@{row.username.replace(/^@/, '')}</p>}
        {row && <div className="cbd-stats"><div><span>Vendor IO</span><b>{row.ioNumber}</b></div><div><span>Agreed fee</span><b>{amount(row.fee)}</b></div><div><span>Outstanding</span><b className="cbd-positive">{amount(Math.max(0, total - row.paid))}</b></div></div>}
        <div className="cbd-badges">{row && <><span>{ioBadge(row.ioStatus).label}</span><span>{paymentStatus(row.paid, total).label}</span></>}<span aria-live="polite">{complete} of {required.length} filled</span></div>
      </aside>
      <div className="cbd-main">
        <header className="cbd-header"><h3>Creator bank details</h3><span className="cbd-bank-tag">AAIB</span><p>Shared with CRM and campaign payments</p>{row && <p className="cbd-mobile-identity">{row.creator}{row.username ? ` · @${row.username.replace(/^@/, "")}` : ""}</p>}</header>
        <fieldset className="cbd-body" disabled={pending || accountsLoading || !!accountsError}>
          <section className="cbd-section">
            <div className="cbd-section-title">Saved bank accounts <span>{accounts.length} saved</span></div>
            {accountsLoading ? <p role="status">Loading saved accounts…</p> : accountsError ? <p role="alert" className="cbd-error">{accountsError}</p> : <>
              <div className="cbd-account-actions"><label className="cbd-field">Bank account<select className="cbd-input" value={accountId ?? ''} onChange={e => chooseAccount(e.target.value)}><option value="">New bank account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.bank.bank_name || a.bank.nickname || (isEmptyBank(a.bank) ? 'Empty account' : 'Bank account')} · {a.bank.currency || 'Currency not set'} · …{(a.bank.iban || a.bank.account_number).slice(-4)}{a.isDefault ? ' · Default' : ''}</option>)}</select></label><Button className="cbd-button" variant="outline" disabled={!accountId} onClick={() => chooseAccount('')}>+ Add account</Button><Button className="cbd-button" variant="outline" onClick={clearDetails}>Clear details</Button>{accountId && !accounts.find(a => a.id === accountId)?.isDefault && <Button className="cbd-button" variant="outline" disabled={dirty} onClick={() => void changeDefault()}>Make default</Button>}</div>
              {!accountId && accounts.length > 0 && <label className="cbd-confirm"><input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)}/>Use as default after saving</label>}
              <p className="cbd-hint">The default account is used for new campaign payment exports. Previously exported files and payment history stay unchanged.</p>
              {draftNotice && <p className="cbd-note" role="status">{draftNotice}</p>}{draftStorageError && <p className="cbd-note cbd-warning" role="alert">{draftStorageError}</p>}{checkingDuplicates && <p className="cbd-hint" role="status">Checking for duplicate details…</p>}{duplicateCheckError && <p className="cbd-hint cbd-warning">{duplicateCheckError}</p>}{dirty && <p className="cbd-hint">{draftStorageError ? 'Changes have not been saved.' : 'Unsaved draft kept in this browser tab for up to 24 hours.'} <button type="button" className="cbd-button" onClick={() => chooseAccount(accountId ?? '', true)}>Discard changes</button></p>}
            </>}
          </section>
          <section className="cbd-section"><div className="cbd-section-title">1 · Account <span>Required unless marked optional</span></div>
            <div className="cbd-segment" aria-label="Account identifier">{[['iban', 'IBAN'], ['account', 'Account number']].map(([value, label]) => <button key={value} type="button" aria-pressed={accountMode === value} onClick={() => { if (accountMode === value) return; setAccountMode(value); setIssues([]); setBank(previous => ({ ...previous, registered: false })); }}>{label}</button>)}</div>
            <div className="cbd-pane">{accountMode === 'iban' ? <><label className="cbd-field">IBAN<Input className="cbd-input cbd-mono" value={bank.iban} placeholder="Paste IBAN to fill available bank details" maxLength={42} aria-required="true" aria-invalid={ibanChecked && !!bank.iban && !!info?.error} onChange={e => { setIbanChecked(false); setIssues([]); setBank(previous => changeIban(previous, e.target.value)); }} onBlur={detect}/>{duplicateHint('iban')}</label><p className="cbd-hint">Fills country and account details for Egyptian, UAE and Saudi IBANs; bank name and SWIFT for supported banks. Name, address, currency and registration stay manual.</p></> : <>{field('account_number', 'Account number', 'Local account number')}<p className="cbd-hint">Use where the beneficiary bank does not issue an IBAN.</p></>}</div>
            {ibanChecked && info?.error && <p role="alert" className="cbd-note cbd-error">{info.error}</p>}
            {ibanChecked && info?.detected && <><p role="status" className="cbd-hint cbd-success">IBAN checksum checked · {info.country}{info.bankCode ? ` · Bank code ${info.bankCode}` : ''}{info.detected.bank_name ? ` · ${info.detected.bank_name}` : ''}. Review bank details before saving; account ownership is not verified.</p>{info.detected.bank_name && !info.detected.swift && <p className="cbd-note cbd-warning">Bank identified. Enter the SWIFT / BIC supplied by the bank; verified routing is not available for this bank code.</p>}{!info.detected.bank_name && <p className="cbd-note cbd-warning">This bank is not yet supported by automatic bank lookup. Country and available account details were detected; enter the bank name and SWIFT manually. Personal details and currency always require your input.</p>}</>}
            {ibanChecked && conflicts.length > 0 && <div className="cbd-note cbd-warning">Existing {conflicts.map(([key]) => key.replaceAll('_', ' ')).join(', ')} differ from the IBAN. Your entries were kept. <button type="button" className="cbd-button" onClick={() => { setBank(previous => fillFromIban(previous, true)); setIssues([]); }}>Use detected details</button></div>}
          </section>
          <section className="cbd-section"><div className="cbd-section-title">2 · Beneficiary</div><div className="cbd-grid">
            {field('beneficiary_name', 'Beneficiary name')}{field('beneficiary_address', 'Beneficiary address')}{field('country', 'Bank country', 'AE, EG, SA…')}<label className="cbd-field">Beneficiary currency<select className="cbd-input" aria-required="true" value={bank.currency} onChange={e => update('currency', e.target.value)}><option value="">Select currency</option>{currencyOptions.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
            <label className="cbd-field">Transfer type<select className="cbd-input" value={bank.payment_type} aria-required="true" onChange={e => update('payment_type', e.target.value)}><option value="">Select transfer type</option><option value="B">Within AAIB</option><option value="D">Domestic (EGP)</option><option value="I">International / foreign currency</option></select></label>
            {field('nickname', 'AAIB beneficiary nickname', 'Exact nickname in AAIBeConnect')}
          </div>{bank.payment_type === 'D' && (bank.currency !== 'EGP' || (info?.country && info.country !== 'EG')) && <p className="cbd-note cbd-warning">Domestic is for Egyptian EGP transfers. Select International / foreign currency for this beneficiary.</p>}</section>
          <section className="cbd-section"><div className="cbd-section-title">3 · Routing <span>{bank.payment_type === 'B' ? 'Optional within AAIB' : 'Choose one'}</span></div>
            <div className="cbd-segment" aria-label="Payment routing">{[['swift', 'SWIFT / BIC'], ['clearing', 'Clearing details']].map(([value, label]) => <button key={value} type="button" aria-pressed={routeMode === value} onClick={() => { if (routeMode === value) return; setRouteMode(value); setIssues([]); setBank(previous => ({ ...previous, registered: false })); }}>{label}</button>)}</div>
            <div className="cbd-pane">{routeMode === 'swift' ? <><div className="cbd-grid">{field('swift', 'SWIFT / BIC', '8 or 11 characters')}{field('bank_name', 'Bank name', '', 'Optional')}</div><p className="cbd-hint">A SWIFT code replaces clearing details. Branch and address are optional.</p><details className="cbd-optional"><summary>Optional bank branch and address</summary><div className="cbd-grid">{field('bank_branch', 'Bank branch', '', 'Optional')}{field('bank_address', 'Bank address', '', 'Optional')}</div></details></> : <><div className="cbd-grid">{field('bank_name', 'Bank name')}{field('bank_branch', 'Bank branch')}<div className="cbd-wide">{field('bank_address', 'Bank address')}</div>{field('identifier', 'Clearing identifier')}{field('clearing_code', 'Clearing code')}</div><p className="cbd-hint">All five fields are required without SWIFT, except for transfers within AAIB. Use the clearing format supported by the bank country.</p></>}</div>
          </section>
          <section className="cbd-section"><div className="cbd-section-title">4 · Payment advice</div><div className="cbd-grid">{field('email', 'Advice email', 'name@domain.com', 'Required for advice')}{field('mobile', 'Mobile', 'Digits only', 'Optional')}</div><p className="cbd-hint">Email is required when payment advice is enabled during payment export.</p></section>
          <section className="cbd-section"><div className="cbd-section-title">5 · AAIB registration</div><label className="cbd-confirm"><input type="checkbox" checked={bank.registered} onChange={e => setBank({ ...bank, registered: e.target.checked })}/>I confirm these beneficiary details are registered and accepted in AAIB</label><p className="cbd-note">Required to export a payment run. You can save and export the beneficiary registration file without confirmation.</p></section>
          {issues.length > 0 && <div role="alert" className="cbd-note cbd-error"><strong>Bank details could not be saved:</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>{duplicate && <a className="cbd-duplicate-link" href={`/vendors/${duplicate.id}`} target="_blank" rel="noopener noreferrer">Open {duplicate.name} — creator details ↗</a>}</div>}
        </fieldset>
        <footer className="cbd-footer"><Button className="cbd-button cbd-primary" disabled={pending || accountsLoading || !!accountsError} onClick={() => void save()}>{pending ? 'Please wait…' : isEmptyBank(activeBank) ? 'Save cleared details' : 'Save bank details'}</Button><Button className="cbd-button" variant="outline" disabled={pending || accountsLoading || !!accountsError || !accountId || dirty || remaining > 0 || validateBank(activeBank).length > 0} onClick={async () => { setPending(true); try { const r = await exportAaibBeneficiaries([creatorId], accountId ?? undefined); if (r.ok) downloadFile(r.base64, BENEFICIARY_FILENAME, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true); else setIssues([r.message]); } finally { setPending(false); } }}>Export beneficiary</Button><p aria-live="polite">{isEmptyBank(activeBank) ? 'Empty details can be saved · payments require complete bank details' : remaining ? `${remaining} required fields remaining` : dirty ? 'Save changes before exporting' : 'Required fields filled · review details'}</p></footer>
      </div>
    </section>;
}
export function CrmAaibBankEditor({ creatorId, details }: { creatorId: string; details: Record<string, unknown> }) {
    return <AaibBankEditor key={JSON.stringify(details)} creatorId={creatorId} initial={bankDetails(details)}/>;
}
