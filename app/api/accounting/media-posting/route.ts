import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountingContext } from '@/features/accounting/setup-server';
import { assertCsrfRequest } from '@/lib/security/csrf';
import { requireFinancePermission } from '@/lib/auth/permissions-server';
import { isoDate } from '@/features/accounting/journal-validation';

const type = z.enum(['client_invoice','supplier_invoice','internal_cost','client_credit_note','vendor_credit_note','client_debit_note','vendor_debit_note']);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const error = (e: unknown) => reply({ error: e instanceof Error ? e.message : 'Posting request failed' }, 400);
export async function GET(request: Request) {
  try {
    const { db, access } = await accountingContext();
    const permission = await requireFinancePermission(db, 'finance.read');
    if (!access.media || 'error' in permission) return reply({ error: 'Media Finance access required' }, 403);
    const q = new URL(request.url).searchParams;
    const company = z.string().uuid().parse(q.get('company'));
    const types = q.get('type') === 'cost' ? ['supplier_invoice','internal_cost'] : [type.parse(q.get('type'))];
    const from = isoDate.parse(q.get('from')), to = isoDate.parse(q.get('to'));
    const page = z.coerce.number().int().min(0).max(2000).parse(q.get('page') ?? 0);
    const results = await Promise.all(types.map(t => db.rpc('tw_accounting_media_queue', { p_company: company, p_type: t, p_from: from, p_to: to, p_posted: q.get('posted') === 'true', p_offset: page * 50 })));
    for (const r of results) if (r.error) throw Error(r.error.message);
    return reply({ rows: results.flatMap(r => r.data.rows), count: results.reduce((n,r) => n + r.data.count, 0), more: results.some(r => r.data.count > (page + 1) * 50) });
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  const csrf = assertCsrfRequest(request);
  if (!csrf.ok) return reply({ error: csrf.reason }, 403);
  try {
    const { db, access } = await accountingContext();
    const permission = await requireFinancePermission(db, 'finance.write');
    if (!access.media || !access.manage || 'error' in permission) return reply({ error: 'Media Finance and Accounting management access required' }, 403);
    const v = z.object({ company: z.string().uuid(), type, id: z.string().uuid(), operation: z.enum(['post','unpost']), token: z.string().max(64).optional(), version: z.number().int().positive().optional(), reason: z.string().trim().min(3).max(500).optional() }).parse(await request.json());
    if (v.operation === 'post' && !v.token || v.operation === 'unpost' && (!v.version || !v.reason)) throw Error('Browse again and supply the required confirmation');
    const r = v.operation === 'post'
      ? await db.rpc('tw_accounting_media_post', { p_company: v.company, p_type: v.type, p_id: v.id, p_token: v.token })
      : await db.rpc('tw_accounting_media_unpost', { p_company: v.company, p_type: v.type, p_id: v.id, p_version: v.version, p_reason: v.reason });
    if (r.error) return reply({ error: r.error.message }, r.error.code === '42501' ? 403 : r.error.code === '40001' ? 409 : 400);
    return reply({ journal: r.data });
  } catch (e) { return error(e); }
}
