"use server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireRequestUser } from "@/lib/supabase/server";
import { requireFinancePermission, requirePermission } from "@/lib/auth/permissions-server";
import { bankDetails, calculatePayment, type PaymentRow, type PaymentDraft, type BankDetails, type PaymentBatch, type PaymentEntry } from "./model";
import { beneficiaryCells, createPaymentCsv, validateBank, type ExportSettings } from "./aaib";
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
};
async function loadRows(db: SupabaseClient, scope: Scope) {
    let query = db.from('vendor_ios').select('id,assignment_id,campaign_header_id,influencer_id,document_number,status,amount,currency_code,created_at,is_superseded').not('document_generated_at', 'is', null).order('created_at', { ascending: false });
    if (scope.campaignId)
        query = query.eq('campaign_header_id', z.string().uuid().parse(scope.campaignId));
    if (scope.creatorId)
        query = query.eq('influencer_id', z.string().uuid().parse(scope.creatorId));
    const ioResult = await allPaymentRows(query.order('id'));
    const ios = [...new Map((ioResult.data ?? []).reverse().map(io => [io.assignment_id, io])).values()];
    if (!ios.length)
        return { rows: [] as PaymentRow[], batches: [] as PaymentBatch[] };
    const assignmentIds = ios.map(io => io.assignment_id);
    const [assignments, creators, terms, entries, campaigns] = await Promise.all([
        paymentRowsByIds(assignmentIds,ids=>db.from('campaign_influencers').select('id,agreed_fee,cost_before_vat,cost_vat_percent,currency,vendor_payment_status').in('id', ids).order('id')),
        paymentRowsByIds(ios.map(io=>io.influencer_id),ids=>db.from('influencers').select('id,display_name,payment_details').in('id', ids).order('id')),
        paymentRowsByIds(assignmentIds,ids=>db.from('creator_payment_terms').select('*').in('assignment_id', ids).order('assignment_id')),
        paymentRowsByIds(assignmentIds,ids=>db.from('creator_payment_entries').select('*').in('assignment_id', ids).order('created_at', { ascending: false }).order('id')),
        paymentRowsByIds(ios.map(io=>io.campaign_header_id),ids=>db.from('campaign_headers').select('id,name,document_number').in('id', ids).order('id')),
    ]);
    const rows: PaymentRow[] = ios.map(io => {
        const a = assignments.data?.find(a => a.id === io.assignment_id);
        const creator = creators.data?.find(c => c.id === io.influencer_id);
        const term = terms.data?.find(t => t.assignment_id === io.assignment_id);
        const campaign = campaigns.data?.find(c => c.id === io.campaign_header_id);
        const ledger = (entries.data ?? []).filter(e => e.assignment_id === io.assignment_id);
        const fee = Number(term?.fee ?? a?.cost_before_vat ?? a?.agreed_fee ?? io.amount ?? 0);
        const vat = Number(term?.vat ?? a?.cost_vat_percent ?? 0);
        const paid = ledger.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.original_amount), 0);
        return { assignmentId: io.assignment_id, campaignId: io.campaign_header_id, creatorId: io.influencer_id,
            campaign: campaign?.name ?? campaign?.document_number ?? 'Campaign',
            creator: creator?.display_name ?? 'Creator', ioId: io.id, ioNumber: io.document_number ?? 'IO', ioStatus: io.is_superseded ? 'superseded' : io.status,
            payable: !io.is_superseded && !['cancelled','rejected','void','voided'].includes(io.status),
            currency: a?.currency ?? io.currency_code, fee, vat,
            paid: paid || (a?.vendor_payment_status === 'paid' ? fee + Math.round(fee * vat) / 100 : 0),
            reserved: ledger.filter(e => e.status === 'exported').reduce((s, e) => s + Number(e.original_amount), 0),
            bank: bankDetails(creator?.payment_details ?? {}) };
    });
    const batchIds = [...new Set((entries.data ?? []).map(e => e.batch_id))];
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
            const draft = z.object({ fee: z.number().finite().nonnegative(), vat: z.number().min(0).max(100), currency: z.string().regex(/^[A-Z]{3}$/), rate: z.number().finite().positive(), mode: z.enum(['full', 'percent', 'manual']), percent: z.number().min(0).max(100), amount: z.number().finite().nonnegative(), invoiceNumber: z.string().max(100).optional(), invoiceDate: z.string().optional(), invoiceAmount: z.number().finite().nonnegative().optional() }).parse(item.draft);
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
export async function saveAaibBank(creatorId: string, bank: BankDetails) {
    try {
        const ctx = await requireRequestUser();
        const db = ctx.supabase as SupabaseClient;
        const permission = await requirePermission(db, 'influencers.write');
        if ('error' in permission)
            throw new Error(permission.error);
        z.string().uuid().parse(creatorId);
        const schema = z.object({ payment_type: z.string(), currency: z.string(), nickname: z.string(), beneficiary_name: z.string(), account_number: z.string(), iban: z.string(), beneficiary_address: z.string(), email: z.string(), mobile: z.string(), country: z.string(), swift: z.string(), identifier: z.string(), clearing_code: z.string(), bank_name: z.string(), bank_address: z.string(), bank_branch: z.string(), registered: z.boolean() });
        bank = schema.parse(bank);
        const issues = validateBank(bank);
        if (issues.length)
            throw new Error(issues.join(' '));
        const old = await db.from('influencers').select('payment_details').eq('id', creatorId).single();
        if (old.error)
            throw new Error(old.error.message);
        const previous = bankDetails(old.data.payment_details ?? {});
        const changed = previous.nickname && JSON.stringify({ ...previous, registered: false }) !== JSON.stringify({ ...bank, registered: false });
        const registered = changed ? false : bank.registered;
        const details = { ...(old.data.payment_details ?? {}), beneficiary_name: bank.beneficiary_name, account_number: bank.account_number, iban: bank.iban, swift: bank.swift, bank_name: bank.bank_name, bank_branch: bank.bank_branch,
            aaib_payment_type: bank.payment_type, aaib_currency: bank.currency, aaib_nickname: bank.nickname, aaib_address: bank.beneficiary_address, aaib_email: bank.email, aaib_mobile: bank.mobile, aaib_country: bank.country, aaib_identifier: bank.identifier, aaib_clearing_code: bank.clearing_code, aaib_bank_address: bank.bank_address, aaib_registered: registered };
        const saved = await db.from('influencers').update({ payment_details: details }).eq('id', creatorId);
        if (saved.error)
            throw new Error(saved.error.message);
        revalidatePath(`/vendors/${creatorId}`);
        return { ok: true as const, bank: bankDetails(details), message: changed ? 'Bank details changed. Confirm AAIB registration again after updating the bank.' : 'Bank details saved.' };
    }
    catch (e) {
        return fail(e);
    }
}
export async function exportAaibBeneficiaries(ids: string[]) {
    try {
        const db = await access();
        z.array(z.string().uuid()).min(1).max(200).parse(ids);
        const result = await db.from('influencers').select('id,display_name,payment_details').in('id', [...new Set(ids)]);
        if (result.error)
            throw new Error(result.error.message);
        if (result.data?.length !== new Set(ids).size)
            throw new Error('Some selected creators are unavailable.');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(template('beneficiaries.xlsx'));
        const sheet = workbook.getWorksheet('Beneficiary Details');
        if (!sheet)
            throw new Error('Bank template missing.');
        const seen = new Set<string>();
        result.data.forEach((creator, index) => {
            const bank = bankDetails(creator.payment_details ?? {});
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
