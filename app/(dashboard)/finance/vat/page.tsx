import {Suspense} from 'react';
import {FinanceSuiteShell} from '@/components/finance/suite/finance-suite-shell';
import {VatLedgerWorkspace} from '@/features/finance/vat/components/vat-ledger-workspace';
import {loadVatLedger} from '@/features/finance/vat/ledger-query';
export const dynamic='force-dynamic';
export default async function FinanceVatPage(){const data=await loadVatLedger().catch(()=>null);return <FinanceSuiteShell title="VAT" description="Monthly invoice VAT and tax authority payment records">{data?<Suspense fallback={<p>Loading VAT…</p>}><VatLedgerWorkspace data={data}/></Suspense>:<p>VAT records are unavailable. Reload or check your Finance access.</p>}</FinanceSuiteShell>;}
