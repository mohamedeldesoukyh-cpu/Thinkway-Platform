"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveAaibBank, exportAaibBeneficiaries } from './actions';
import { BENEFICIARY_FILENAME, PAYMENT_FILENAME, paymentFileBytes } from './aaib';
import { bankDetails, type BankDetails } from './model';
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
][] = [['nickname', 'AAIB beneficiary nickname'], ['beneficiary_name', 'Beneficiary name'], ['iban', 'IBAN'], ['account_number', 'Account number (if no IBAN)'], ['beneficiary_address', 'Beneficiary address'], ['country', 'Bank country (EG, AE, etc.)'], ['swift', 'SWIFT / BIC'], ['email', 'Advice email'], ['mobile', 'Mobile (digits only)'], ['bank_name', 'Bank name'], ['bank_branch', 'Bank branch'], ['bank_address', 'Bank address'], ['identifier', 'Clearing identifier (if no SWIFT)'], ['clearing_code', 'Clearing code']];
export function AaibBankEditor({ creatorId, initial, onSaved }: {
    creatorId: string;
    initial: BankDetails;
    onSaved?: () => void;
}) {
    const [bank, setBank] = useState(initial);
    const [savedBank,setSavedBank]=useState(initial);
    const router=useRouter();
    const [pending, setPending] = useState(false);
    async function save() { setPending(true); const r = await saveAaibBank(creatorId, bank); setPending(false); if (!r.ok) {
        toast.error(r.message);
        return;
    } setBank(r.bank);setSavedBank(r.bank);router.refresh(); toast.success(r.message); onSaved?.(); }
    return <section className="space-y-3 rounded-xl border bg-white p-4"><h3 className="font-semibold">AAIB beneficiary bank details</h3>
    <p className="text-xs text-muted-foreground">Shared with CRM and campaign payments. Use the exact nickname registered in AAIBeConnect.</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs">Transfer type<select className="mt-1 h-9 w-full rounded border px-2" value={bank.payment_type} onChange={e => setBank({ ...bank, payment_type: e.target.value })}><option value="">Select transfer type</option><option value="B">Within AAIB</option><option value="D">Domestic (EGP)</option><option value="I">International / foreign currency</option></select></label>
      <label className="text-xs">Beneficiary currency<Input className="mt-1" value={bank.currency} maxLength={3} placeholder="EGP" onChange={e => setBank({ ...bank, currency: e.target.value.toUpperCase() })}/></label>
      {fields.map(([key, label]) => <label key={key} className="text-xs">{label}<Input className="mt-1" value={String(bank[key])} onChange={e => setBank({ ...bank, [key]: ['country', 'swift', 'iban'].includes(key) ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value })}/></label>)}
    </div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bank.registered} onChange={e => setBank({ ...bank, registered: e.target.checked })}/> I confirm these beneficiary details are registered and accepted in AAIB</label>
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
