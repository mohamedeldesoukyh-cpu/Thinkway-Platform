"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveAaibBank, exportAaibBeneficiaries } from './actions';
import { BENEFICIARY_FILENAME, PAYMENT_FILENAME, paymentFileBytes, validateBank } from './aaib';
import { bankDetails, type BankDetails } from './model';
import { bankFieldRequirement, changeIban, fillFromIban, inspectIban } from './iban';
export function downloadFile(data: string, name: string, type: string, base64 = false) {
    const bytes = base64 ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : name === PAYMENT_FILENAME ? paymentFileBytes(data) : data;
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fields: [
    keyof BankDetails,
    string
][] = [['nickname', 'AAIB beneficiary nickname'], ['beneficiary_name', 'Beneficiary name'], ['account_number', 'Account number'], ['beneficiary_address', 'Beneficiary address'], ['country', 'Bank country (EG, AE, etc.)'], ['swift', 'SWIFT / BIC'], ['email', 'Advice email'], ['mobile', 'Mobile (digits only)'], ['bank_name', 'Bank name'], ['bank_branch', 'Bank branch'], ['bank_address', 'Bank address'], ['identifier', 'Clearing identifier'], ['clearing_code', 'Clearing code']];
export function AaibBankEditor({ creatorId, initial, onSaved }: {
    creatorId: string;
    initial: BankDetails;
    onSaved?: () => void;
}) {
    const [bank, setBank] = useState(initial);
    const [savedBank,setSavedBank]=useState(initial);
    const router=useRouter();
    const [pending, setPending] = useState(false);
    const [ibanChecked, setIbanChecked] = useState(false);
    const [issues, setIssues] = useState<string[]>([]);
    const info = bank.iban ? inspectIban(bank.iban) : null;
    const conflicts = Object.entries(info?.detected ?? {}).filter(([key, value]) => {
        const current = String(bank[key as keyof BankDetails]);
        // An explicit branch BIC is compatible with its bank's eight-character BIC.
        return current && current !== value && !(key === 'swift' && current.slice(0, 8) === value);
    });
    function update(key: keyof BankDetails, value: string) {
        setIssues([]);
        setBank(previous => ({ ...previous, [key]: value, registered: false }));
    }
    function detect() {
        setIbanChecked(true);
        setBank(previous => fillFromIban(previous));
    }
    async function save() {
        const errors = validateBank(bank);
        setIssues(errors);
        if (errors.length) return;
        setPending(true); const r = await saveAaibBank(creatorId, bank); setPending(false); if (!r.ok) {
        toast.error(r.message);
        return;
    } setBank(r.bank);setSavedBank(r.bank);router.refresh(); toast.success(r.message); onSaved?.(); }
    return <section className="space-y-3 rounded-xl border bg-white p-4"><h3 className="font-semibold">AAIB beneficiary bank details</h3>
    <p className="text-xs text-muted-foreground">Shared with CRM and campaign payments. Use the exact nickname registered in AAIBeConnect.</p>
    <p className="text-xs text-muted-foreground"><strong className="text-foreground">Required</strong> fields must be completed. <strong className="text-foreground">Optional</strong> fields may be left blank. Conditional requirements are shown beside each field.</p>
    <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
      <label className="block text-xs">IBAN <span className="ml-1 text-muted-foreground">· {bankFieldRequirement('iban', bank)}</span>
        <Input className="mt-1 font-mono" value={bank.iban} placeholder="Paste IBAN to fill available bank details" maxLength={42} aria-describedby="bank-iban-help" aria-invalid={ibanChecked && !!bank.iban && !!info?.error} onChange={e => { setIbanChecked(false); setIssues([]); setBank(previous => changeIban(previous, e.target.value)); }} onBlur={detect}/>
      </label>
      <p id="bank-iban-help" className="text-xs text-muted-foreground">Fills country and account details for UAE and Egyptian IBANs; bank name and SWIFT for supported banks. Name, address, currency, contact details and AAIB registration stay manual. If you change the IBAN, review any retained bank details.</p>
      {ibanChecked && info?.error && <p role="alert" className="text-xs text-red-700">{info.error}</p>}
      {ibanChecked && info?.detected && <p role="status" className="text-xs text-emerald-800">IBAN checksum checked · {info.country}{info.bankCode ? ` · Bank code ${info.bankCode}` : ''}. {info.detected.bank_name ? 'Bank details detected. Review before saving.' : 'Bank name and SWIFT are not available in the local directory; enter them manually.'} This does not verify account ownership.</p>}
      {ibanChecked && conflicts.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800"><span>Existing details differ from the IBAN: {conflicts.map(([key]) => key.replaceAll('_', ' ')).join(', ')}. Your entries have been kept.</span><Button size="sm" variant="outline" onClick={() => { setBank(previous => fillFromIban(previous, true)); setIssues([]); }}>Use detected details</Button></div>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs">Transfer type <span className="text-muted-foreground">· Required</span><select required className="mt-1 h-9 w-full rounded border px-2" value={bank.payment_type} onChange={e => update('payment_type', e.target.value)}><option value="">Select transfer type</option><option value="B">Within AAIB</option><option value="D">Domestic (EGP)</option><option value="I">International / foreign currency</option></select></label>
      <label className="text-xs">Beneficiary currency <span className="text-muted-foreground">· Required</span><Input required className="mt-1" value={bank.currency} maxLength={3} placeholder="e.g. USD" onChange={e => update('currency', e.target.value.toUpperCase())}/></label>
      {fields.map(([key, label]) => <label key={key} className="text-xs">{label} <span className="text-muted-foreground">· {bankFieldRequirement(key, bank)}</span><Input className="mt-1" required={bankFieldRequirement(key, bank) === 'Required'} value={String(bank[key])} onChange={e => update(key, ['country', 'swift'].includes(key) ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value)}/></label>)}
    </div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bank.registered} onChange={e => setBank({ ...bank, registered: e.target.checked })}/> I confirm these beneficiary details are registered and accepted in AAIB</label>
    <p className="text-xs text-muted-foreground">Registration confirmation is required for payment export, not for saving or exporting a beneficiary.</p>
    {bank.payment_type === 'D' && (bank.currency !== 'EGP' || (info?.country && info.country !== 'EG')) && <p className="text-xs text-amber-800">Domestic is for Egyptian EGP transfers. Select International / foreign currency for this beneficiary.</p>}
    {issues.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><strong>Complete these details before saving:</strong><ul className="mt-1 list-disc pl-4">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    {JSON.stringify(bank)!==JSON.stringify(savedBank)&&<p className="text-xs text-amber-800">Save changes before exporting this beneficiary.</p>}
    <div className="flex gap-2"><Button disabled={pending} onClick={() => void save()}>Save bank details</Button><Button variant="outline" disabled={pending || JSON.stringify(bank)!==JSON.stringify(savedBank)} onClick={async () => { setPending(true); const r = await exportAaibBeneficiaries([creatorId]); setPending(false); if (r.ok)
        downloadFile(r.base64, BENEFICIARY_FILENAME, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
    else
        toast.error(r.message); }}>Export beneficiary</Button></div>
  </section>;
}
export function CrmAaibBankEditor({ creatorId, details }: {
    creatorId: string;
    details: Record<string, unknown>;
}) { return <AaibBankEditor key={JSON.stringify(details)} creatorId={creatorId} initial={bankDetails(details)}/>; }
