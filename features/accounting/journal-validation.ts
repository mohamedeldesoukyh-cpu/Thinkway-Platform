import { z } from 'zod';
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s,'Invalid date');
export const amount = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/,'Use a positive amount with up to two decimal places');
export const journalLineSchema = z.object({account:z.string().regex(/^\d{6}$/),description:z.string().trim().max(500),debit:amount,credit:amount}).refine(l=>amount.safeParse(l.debit).success && amount.safeParse(l.credit).success && ((cents(l.debit)>BigInt(0) && cents(l.credit)===BigInt(0))||(cents(l.credit)>BigInt(0) && cents(l.debit)===BigInt(0))),'Each line needs either a debit or a credit');
export const journalSchema = z.object({id:z.string().uuid(),company:z.string().uuid(),date:isoDate,reference:z.string().trim().max(120),memo:z.string().trim().min(3).max(1000),version:z.number().int().positive().nullable(),lines:z.array(journalLineSchema).min(2).max(200)});
export const journalActionSchema = z.object({id:z.string().uuid(),company:z.string().uuid(),version:z.number().int().positive()});
export const reversalSchema = z.object({id:z.string().uuid(),company:z.string().uuid(),reversal:z.string().uuid(),date:isoDate,reason:z.string().trim().min(3).max(500)});
export const periodSchema = z.object({company:z.string().uuid(),period:z.string().uuid(),closed:z.boolean(),reason:z.string().trim().min(3).max(500),version:z.number().int().positive()});

import { cents } from "./journal-model";
