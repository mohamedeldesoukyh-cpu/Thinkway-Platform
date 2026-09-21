"use client";
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { exportAaibBeneficiaries } from './actions';
import { BENEFICIARY_FILENAME } from './aaib';
import { downloadFile } from './bank-editor';
export function BeneficiaryExport({ creators }: {
    creators: {
        id: string;
        display_name: string;
    }[];
}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    return <><Button variant="outline" onClick={() => setOpen(true)}>Export AAIB beneficiaries</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogTitle>Export AAIB beneficiaries</DialogTitle>
      <p className="text-sm text-muted-foreground">Select creators from this CRM page. Bank details are managed in each creator’s Payments tab.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={creators.length > 0 && creators.every(c => selected.has(c.id))} onChange={e => setSelected(new Set(e.target.checked ? creators.map(c => c.id) : []))}/>Select all on this page</label>
      {creators.map(c => <label key={c.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.has(c.id)} onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked)
        n.add(c.id);
    else
        n.delete(c.id); return n; })}/>{c.display_name}</label>)}
      <Button disabled={busy || !selected.size} onClick={async () => { setBusy(true); const r = await exportAaibBeneficiaries([...selected]); setBusy(false); if (!r.ok) {
        toast.error(r.message);
        return;
    } downloadFile(r.base64, BENEFICIARY_FILENAME, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true); setOpen(false); }}>Download {selected.size} beneficiaries</Button>
    </DialogContent></Dialog></>;
}
