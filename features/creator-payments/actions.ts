"use server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireRequestUser } from "@/lib/supabase/server";
import { requireFinancePermission, requirePermission } from "@/lib/auth/permissions-server";
import { bankDetails, calculatePayment, money, type PaymentRow, type PaymentDraft, type BankDetails, type PaymentBatch, type PaymentEntry } from "./model";
import { beneficiaryCells, createPaymentCsv, validateBank, type ExportSettings } from "./aaib";
import { isEmptyBank, type BankDuplicate } from './bank-form-state';
import { paymentUnits } from './allocations';
import { paymentDraftSchema } from './payment-plan';
import { allPaymentRows, paymentRowsByIds } from './query-pages';
async function access(write = false) {
    const ctx = await requireRequestUser();
    const check = await requireFinancePermission(ctx.supabase, write ? 'finance.write' : 'finance.read');
    if ('error' in check)
        throw new Error(check.error);
    return ctx.supabase as SupabaseClient;
}
function fail(error: unknown) { return { ok: false as const, message: error instanceof Error ? error.message : 'Payment operation failed.' }; }
const template = (name: string) => path.join(process.cwd(), 'features', 'creator-payments', 'templates', name);
type Scope = {
    campaignId?: string;
    creatorId?: string;
    assignmentIds?: string[];
};
async function loadRows(db: SupabaseClient, scope: Scope) {
    let query = db.from('vendor_ios').select('id,assignment_id,campaign_header_id,influencer_id,document_number,status,amount,currency_code,created_at,is_superseded').not('document_generated_at', 'is', null).order('created_at', { ascending: false });
    if (scope.campaignId)
        query = query.eq('campaign_header_id', z.string().uuid().parse(scope.campaignId));
    if (scope.creatorId)
        query = query.eq('influencer_id', z.string().uuid().parse(scope.creatorId));
    if (scope.assignmentIds) query = query.in('assignment_id', scope.assignmentIds);
    const ioResult = await allPaymentRows(query.order('id'));
    const ios = [...new Map((ioResult.data ?? []).reverse().map(io => [io.assignment_id, io])).values()];
    if (!ios.length)
        return { rows: [] as PaymentRow[], batches: [] as PaymentBatch[] };
    const assignmentIds = ios.map(io => io.assignment_id);
    const [assignments, creators, terms, entries, campaigns, plans] = await Promise.all([
        paymentRowsByIds(assignmentIds,ids=>db.from('campaign_influencers').select('id,campaign_line_id,agreed_fee,cost_before_vat,cost_vat_percent,currency,vendor_payment_status').in('id', ids).order('id')),
        paymentRowsByIds(ios.map(io=>io.influencer_id),ids=>db.from('influencers').select('id,display_name,legal_name,payment_details,platform_accounts:influencer_platform_accounts!influencer_platform_accounts_influencer_id_fkey(handle,username,profile_display_name,is_primary)').in('id', ids).order('id')),
        paymentRowsByIds(assignmentIds,ids=>db.from('creator_payment_terms').select('*').in('assignment_id', ids).order('assignment_id')),
        paymentRowsByIds(assignmentIds,ids=>db.from('creator_payment_entries').select('*').in('assignment_id', ids).order('created_at', { ascending: false }).order('id')),
        paymentRowsByIds(ios.map(io=>io.campaign_header_id),ids=>db.from('campaign_headers').select('id,name,document_number').in('id', ids).order('id')),
        paymentRowsByIds(assignmentIds,ids=>db.from('creator_payment_plans').select('assignment_id,draft').in('assignment_id', ids).order('assignment_id')),
    ]);
    const lineIds = assignments.data.map(a=>a.campaign_line_id).filter((id): id is string=>!!id);
    const [deliverables, posts, publications, links] = await Promise.all([
        paymentRowsByIds(lineIds,ids=>db.from('assignment_deliverables').select('id,campaign_line_id,quantity,sort_order,deliverable_type,created_at').in('campaign_line_id',ids).order('id')),
        paymentRowsByIds(lineIds,ids=>db.from('assignment_post_schedule').select('id,assignment_deliverable_id,sequence_number,status').in('campaign_line_id',ids).order('id')),
        paymentRowsByIds(ios.map(io=>io.campaign_header_id),ids=>db.from('campaign_publications').select('id,assignment_deliverable_id,assignment_post_schedule_id,status').in('campaign_header_id',ids).order('id')),
        paymentRowsByIds(ios.map(io=>io.campaign_header_id),ids=>db.from('deliverable_publication_links').select('id,assignment_deliverable_id,assignment_post_schedule_id,publication_id').in('campaign_header_id',ids).order('id')),
    ]);
    const rows: PaymentRow[] = ios.map(io => {
        const a = assignments.data?.find(a => a.id === io.assignment_id);
        const creator = creators.data?.find(c => c.id === io.influencer_id);
        const term = terms.data?.find(t => t.assignment_id === io.assignment_id);
        const account = creator?.platform_accounts?.find(p => p.is_primary) ?? creator?.platform_accounts?.[0];
        const campaign = campaigns.data?.find(c => c.id === io.campaign_header_id);
        const ledger = (entries.data ?? []).filter(e => e.assignment_id === io.assignment_id);
        const fee = Number(a?.cost_before_vat ?? a?.agreed_fee ?? io.amount ?? 0);
        const vat = Number(term?.vat ?? a?.cost_vat_percent ?? 0);
        const paid = ledger.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.original_amount), 0);
        const saved = paymentDraftSchema.safeParse(plans.data?.find(p => p.assignment_id === io.assignment_id)?.draft);
        return { history: ledger.filter(e=>e.status === 'paid').sort((a,b)=>(a.payment_sequence ?? 0)-(b.payment_sequence ?? 0)) as PaymentEntry[], units: paymentUnits(deliverables.data.filter(d=>d.campaign_line_id === a?.campaign_line_id),posts.data,publications.data,links.data), savedDraft: saved.success ? saved.data : undefined, assignmentId: io.assignment_id, campaignId: io.campaign_header_id, creatorId: io.influencer_id,
            campaign: campaign?.name ?? campaign?.document_number ?? 'Campaign',
            creator: account?.profile_display_name || creator?.legal_name || creator?.display_name || 'Creator', username: account?.username || account?.handle || undefined, ioId: io.id, ioNumber: io.document_number ?? 'IO', ioStatus: io.is_superseded ? 'superseded' : io.status,
            payable: !io.is_superseded && !['cancelled','rejected','void','voided'].includes(io.status),
            currency: a?.currency ?? io.currency_code, fee, vat,
            paid: paid || (a?.vendor_payment_status === 'paid' ? fee + Math.round(fee * vat) / 100 : 0),
            reserved: ledger.filter(e => e.status === 'exported').reduce((s, e) => s + Number(e.original_amount), 0),
            bank: bankDetails(creator?.payment_details ?? {}) };
    });
    const batchIds = [...new Set((entries.data ?? []).map(e => e.batch_id).filter((id): id is string=>!!id))];
    let batches: PaymentBatch[] = [];
    if (batchIds.length) {
        const result = await paymentRowsByIds(batchIds,ids=>db.from('creator_payment_exports').select('id,created_at,transfer_date').in('id', ids).order('created_at', { ascending: false }).order('id'));
        batches = (result.data ?? []).map(b => ({ ...b, entries: (entries.data ?? []).filter(e => e.batch_id === b.id) as PaymentEntry[] }));
    }
    return { rows, batches };
}
export async function loadCreatorPayments(scope: Scope) {
    try {
        const db = await access();
        const permission = await requireFinancePermission(db, 'finance.write');
        return { ok: true as const, canWrite: !('error' in permission), ...await loadRows(db, scope) };
    }
    catch (e) {
        return fail(e);
    }
}
export async function saveCreatorPaymentPlans(input: { assignmentId: string; draft: PaymentDraft }[]) {
    try {
        const db = await access(true);
        const items = z.array(z.object({ assignmentId: z.string().uuid(), draft: paymentDraftSchema })).min(1).max(200).parse(input);
        const { rows } = await loadRows(db, { assignmentIds: items.map(item => item.assignmentId) });
        for (const item of items) {
            const row = rows.find(row => row.assignmentId === item.assignmentId);
            if (!row || row.payable === false) throw new Error('Creator IO is unavailable. Refresh payments.');
            if (money(item.draft.fee) !== money(row.fee)) throw new Error(row.creator + ': agreed fee changed. Refresh payments.');
            const calc = calculatePayment(row, item.draft);
            if (calc.errors.length) throw new Error(row.creator + ': ' + calc.errors.join(' '));
        }
        const result = await db.rpc('save_creator_payment_plans', { p_rows: items });
        if (result.error) throw new Error(result.error.message);
        revalidatePath('/campaigns', 'layout');
        return { ok: true as const };
    } catch (error) { return fail(error); }
}
export async function recordCreatorPayments(requestId: string, input: { assignmentId: string; draft: PaymentDraft }[]) {
    try {
        const db = await access(true);
        z.string().uuid().parse(requestId);
        const items = z.array(z.object({ assignmentId: z.string().uuid(), draft: paymentDraftSchema })).min(1).max(200).parse(input);
        const { rows } = await loadRows(db, { assignmentIds: items.map(item=>item.assignmentId) });
        const payments = items.map(item=>{
            const row = rows.find(row=>row.assignmentId===item.assignmentId);
            if (!row) throw new Error('Creator payment is unavailable. Refresh payments.');
            const calc = calculatePayment(row,item.draft);
            const date = item.draft.paymentDate;
            if (!date || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new Error(row.creator+': enter a valid payment date.');
            // Amount/balance/IO checks happen under a database lock, after idempotent
            // retry detection. A successful retry must not fail on its reduced balance.
            return { assignmentId:row.assignmentId, creator:row.creator, fee:item.draft.fee, vat:item.draft.vat, amount:calc.payNow, rate:calc.rate, currency:item.draft.currency, paymentDate:date };
        });
        const result = await db.rpc('record_creator_payments',{p_request:requestId,p_rows:payments});
        if (result.error) throw new Error(result.error.message);
        revalidatePath('/campaigns','layout');
        revalidatePath('/vendors','layout');
        revalidatePath('/billing');
        return {ok:true as const};
    } catch(error) {return fail(error);}
}
export async function exportCreatorPayments(input: {
    id: string;
    campaignId: string;
    settings: ExportSettings;
    rows: {
        assignmentId: string;
        draft: PaymentDraft;
    }[];
}) {
    try {
        const db = await access(true);
        z.string().uuid().parse(input.id);
        z.string().uuid().parse(input.campaignId);
        if (input.rows.length < 1 || input.rows.length > 200 || new Set(input.rows.map(r => r.assignmentId)).size !== input.rows.length)
            throw new Error('Select 1–200 distinct creator assignments.');
        const existing = await db.from('creator_payment_exports').select('csv_content').eq('id', input.id).eq('campaign_id', input.campaignId).maybeSingle();
        if (existing.data)
            return { ok: true as const, csv: existing.data.csv_content as string };
        const { rows } = await loadRows(db, { campaignId: input.campaignId });
        const transfers = input.rows.map((item, index) => {
            const row = rows.find(r => r.assignmentId === item.assignmentId);
            if (!row)
                throw new Error('Creator IO is unavailable. Refresh the campaign.');
            const draft = paymentDraftSchema.parse(item.draft);
            if (money(draft.fee) !== money(row.fee)) throw new Error(`${row.creator}: agreed fee changed. Refresh and use the agreed amount.`);
            const calc = calculatePayment(row, draft);
            if (calc.errors.length)
                throw new Error(`${row.creator}: ${calc.errors.join(' ')}`);
            const reference = input.id.replaceAll('-', '').slice(0, 12) + String(index + 1).padStart(4, '0');
            return { row, draft, calc, reference };
        });
        const header = (await readFile(template('payments.csv'), 'latin1')).split(/\r?\n/)[0];
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const csv = createPaymentCsv(header, input.settings, transfers.map(t => ({ bank: t.row.bank, currency: t.draft.currency, amount: t.calc.payNow, reference: t.reference, invoiceNumber: t.draft.invoiceNumber, invoiceDate: t.draft.invoiceDate, invoiceAmount: t.draft.invoiceAmount })), today);
        const result = await db.rpc('create_creator_payment_export', { p_id: input.id, p_campaign: input.campaignId, p_date: input.settings.date, p_csv: csv, p_rows: transfers.map(t => ({ assignmentId: t.row.assignmentId, ioId: t.row.ioId, creator: t.row.creator, fee: t.draft.fee, vat: t.draft.vat, currency: t.draft.currency, rate: t.calc.rate, amount: t.calc.payNow, nickname: t.row.bank.nickname })) });
        if (result.error)
            throw new Error(result.error.message);
        revalidatePath(`/campaigns/${input.campaignId}`);
        const stored = await db.from('creator_payment_exports').select('csv_content').eq('id', input.id).single();
        if (stored.error)
            throw new Error(stored.error.message);
        return { ok: true as const, csv: stored.data.csv_content as string };
    }
    catch (e) {
        return fail(e);
    }
}
export async function downloadCreatorPaymentBatch(id: string) {
    try {
        const db = await access();
        const r = await db.from('creator_payment_exports').select('csv_content').eq('id', z.string().uuid().parse(id)).single();
        if (r.error)
            throw new Error(r.error.message);
        return { ok: true as const, csv: r.data.csv_content as string };
    }
    catch (e) {
        return fail(e);
    }
}
export async function confirmCreatorPayment(id: string, status: 'paid' | 'failed', reference: string) {
    try {
        const db = await access(true);
        const r = await db.rpc('confirm_creator_payment', { p_entry: z.string().uuid().parse(id), p_status: z.enum(['paid', 'failed']).parse(status), p_reference: z.string().trim().min(1).max(250).parse(reference) });
        if (r.error)
            throw new Error(r.error.message);
        revalidatePath('/campaigns', 'layout');
        revalidatePath('/vendors', 'layout');
        revalidatePath('/billing');
        return { ok: true as const };
    }
    catch (e) {
        return fail(e);
    }
}
export async function saveAaibBank(creatorId: string, bank: BankDetails, accountId: string | null = null, makeDefault = false) {
    try {
        const ctx = await requireRequestUser();
        const db = ctx.supabase as SupabaseClient;
        const permission = await requirePermission(db, 'influencers.write');
        if ('error' in permission)
            throw new Error(permission.error);
        z.string().uuid().parse(creatorId);
        const schema = z.object({ payment_type: z.string(), currency: z.string(), nickname: z.string(), beneficiary_name: z.string(), account_number: z.string(), iban: z.string(), beneficiary_address: z.string(), email: z.string(), mobile: z.string(), country: z.string(), swift: z.string(), identifier: z.string(), clearing_code: z.string(), bank_name: z.string(), bank_address: z.string(), bank_branch: z.string(), registered: z.boolean() });
        bank = schema.parse(bank);
        const issues = isEmptyBank(bank) ? [] : validateBank(bank);
        if (issues.length)
            throw new Error(issues.join(' '));
        if (accountId) z.string().uuid().parse(accountId);
        const details = { beneficiary_name: bank.beneficiary_name, account_number: bank.account_number, iban: bank.iban, swift: bank.swift, bank_name: bank.bank_name, bank_branch: bank.bank_branch,
            aaib_payment_type: bank.payment_type, aaib_currency: bank.currency, aaib_nickname: bank.nickname.trim(), aaib_address: bank.beneficiary_address, aaib_email: bank.email, aaib_mobile: bank.mobile, aaib_country: bank.country, aaib_identifier: bank.identifier, aaib_clearing_code: bank.clearing_code, aaib_bank_address: bank.bank_address, aaib_registered: bank.registered };
        const saved = await db.rpc('save_creator_bank_account', { p_creator: creatorId, p_account: accountId, p_details: details, p_default: makeDefault });
        if (saved.error) {
            if (saved.error.code === '23505') {
                const match = await db.from('influencer_bank_accounts').select('id,influencer_id').ilike('aaib_details->>aaib_nickname', bank.nickname.trim().replace(/[\\%_]/g, '\\$&'));
                const duplicate = match.data?.find(item => item.id !== accountId);
                const creator = duplicate ? await db.from('influencers').select('id,display_name,legal_name').eq('id', duplicate.influencer_id).maybeSingle() : null;
                return { ok: false as const, message: creator?.data ? 'This AAIB beneficiary nickname is already used by a saved bank account. Open the creator below to review it, or use the distinct nickname registered with AAIB.' : 'This AAIB beneficiary nickname is already used by another saved account. You do not have access to its creator details; ask an administrator to review the duplicate.', duplicate: creator?.data ? { id: creator.data.id, name: creator.data.legal_name || creator.data.display_name || 'Creator' } : undefined };
            }
            throw new Error('Could not save the bank account. Please refresh and try again.');
        }
        const account = await db.from('influencer_bank_accounts').select('aaib_details').eq('id', saved.data).single();
        if (account.error) throw new Error('Account saved; refresh to load its details.');
        const result = bankDetails(account.data.aaib_details);
        const currentDefault = await db.from('influencers').select('payment_details').eq('id', creatorId).single();
        if (currentDefault.error) throw new Error('Bank account saved. Refresh the payment list to load its status.');
        revalidatePath('/vendors'); revalidatePath('/campaigns'); revalidatePath(`/vendors/${creatorId}`);
        return { ok: true as const, bank: result, defaultBank: bankDetails(currentDefault.data.payment_details ?? {}), accountId: saved.data as string, message: isEmptyBank(result) ? 'Bank details cleared. Add correct details before exporting payments.' : bank.registered && !result.registered ? 'Bank details changed. Confirm AAIB registration again after updating the bank.' : 'Bank account saved.' };
    }
    catch (e) {
        return fail(e);
    }
}
export async function exportAaibBeneficiaries(ids: string[], accountId?: string) {
    try {
        const db = await access();
        z.array(z.string().uuid()).min(1).max(200).parse(ids);
        const result = await db.from('influencers').select('id,display_name,payment_details').in('id', [...new Set(ids)]);
        if (result.error)
            throw new Error(result.error.message);
        if (result.data?.length !== new Set(ids).size)
            throw new Error('Some selected creators are unavailable.');
        let selectedBank: BankDetails | undefined;
        if (accountId) {
            z.string().uuid().parse(accountId);
            if (ids.length !== 1) throw new Error('Select one creator for an individual bank account export.');
            const account = await db.from('influencer_bank_accounts').select('aaib_details').eq('id', accountId).eq('influencer_id', ids[0]).single();
            if (account.error) throw new Error('Bank account unavailable.');
            selectedBank = bankDetails(account.data.aaib_details);
        }
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(template('beneficiaries.xlsx'));
        const sheet = workbook.getWorksheet('Beneficiary Details');
        if (!sheet)
            throw new Error('Bank template missing.');
        const seen = new Set<string>();
        result.data.forEach((creator, index) => {
            const bank = selectedBank ?? bankDetails(creator.payment_details ?? {});
            const errors = validateBank(bank);
            if (errors.length)
                throw new Error(`${creator.display_name}: ${errors.join(' ')}`);
            if (seen.has(bank.nickname.toLowerCase()))
                throw new Error('Duplicate beneficiary nickname.');
            seen.add(bank.nickname.toLowerCase());
            beneficiaryCells(bank).forEach((value, col) => { const cell = sheet.getCell(index + 2, col + 1); cell.value = value; cell.numFmt = '@'; });
        });
        return { ok: true as const, base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64') };
    }
    catch (e) {
        return fail(e);
    }
}

export async function loadCreatorBankAccounts(creatorId: string) {
    try {
        const { supabase, userId } = await requireRequestUser();
        z.string().uuid().parse(creatorId);
        const { data, error } = await (supabase as SupabaseClient).from('influencer_bank_accounts').select('id,is_default,aaib_details,bank_name,beneficiary_name,account_holder,iban,account_number,swift,branch_name,country_code,currency').eq('influencer_id', creatorId).order('created_at');
        if (error) throw new Error('Could not load saved bank accounts. Please try again.');
        return { ok: true as const, draftScope: userId, accounts: (data ?? []).map(a => ({ id: a.id as string, isDefault: a.is_default as boolean, bank: bankDetails({ ...a.aaib_details, bank_name: a.bank_name ?? '', beneficiary_name: a.beneficiary_name ?? a.account_holder ?? '', iban: a.iban ?? '', account_number: a.account_number ?? '', swift: a.swift ?? '', bank_branch: a.branch_name ?? '', aaib_country: a.country_code ?? '', aaib_currency: a.currency ?? '' }) })) };
    } catch (e) { return fail(e); }
}
export async function setCreatorDefaultBank(creatorId: string, accountId: string) {
    try {
        const { supabase } = await requireRequestUser();
        const permission = await requirePermission(supabase, 'influencers.write');
        if ('error' in permission) throw new Error(permission.error);
        z.string().uuid().parse(creatorId); z.string().uuid().parse(accountId);
        const { error } = await (supabase as SupabaseClient).rpc('save_creator_bank_account', { p_creator: creatorId, p_account: accountId, p_details: null, p_default: true });
        if (error) throw new Error('Could not change the default account. Refresh and try again.');
        revalidatePath('/vendors'); revalidatePath('/campaigns'); revalidatePath(`/vendors/${creatorId}`);
        const currentDefault = await (supabase as SupabaseClient).from('influencers').select('payment_details').eq('id', creatorId).single();
        if (currentDefault.error) throw new Error('Default updated. Refresh the payment list to load its status.');
        return { ok: true as const, defaultBank: bankDetails(currentDefault.data.payment_details ?? {}) };
    } catch (e) { return fail(e); }
}

export async function checkCreatorBankDuplicates(creatorId: string, accountId: string | null, values: Record<string, string>) {
    try {
        const { supabase } = await requireRequestUser();
        const permission = await requirePermission(supabase, 'influencers.write');
        if ('error' in permission) throw new Error(permission.error);
        z.string().uuid().parse(creatorId); if (accountId) z.string().uuid().parse(accountId);
        const input = z.object({ nickname: z.string().max(200), iban: z.string().max(200), account_number: z.string().max(200), beneficiary_name: z.string().max(200), beneficiary_address: z.string().max(500), email: z.string().max(200), mobile: z.string().max(200), country: z.string().max(20), swift: z.string().max(50), bank_name: z.string().max(200) }).parse(values);
        const { data, error } = await (supabase as SupabaseClient).rpc('find_creator_bank_duplicates', { p_creator: creatorId, p_account: accountId, p_values: input });
        if (error) throw new Error('Duplicate check is unavailable. Saving still checks beneficiary nickname uniqueness.');
        return { ok: true as const, matches: (data ?? []) as BankDuplicate[] };
    } catch (e) { return fail(e); }
}
