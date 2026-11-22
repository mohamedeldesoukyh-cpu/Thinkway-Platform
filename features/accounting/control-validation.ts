import {z} from 'zod';
import {isoDate} from './journal-validation';
const reason=z.string().trim().min(3).max(500);
export const controlActionSchema=z.object({company:z.string().uuid(),action:z.enum(['lock','unlock','submit','approve','reject','withdraw']),entries:z.array(z.object({id:z.string().uuid(),version:z.number().int().positive()})).min(1).max(100),reason}).superRefine((value,ctx)=>{
 if(new Set(value.entries.map(entry=>entry.id)).size!==value.entries.length)ctx.addIssue({code:'custom',message:'Duplicate journals in selection'});
 if(!['lock','unlock'].includes(value.action)&&value.entries.length!==1)ctx.addIssue({code:'custom',message:'Review approvals one journal at a time'});
});
export const approvalPolicySchema=z.object({company:z.string().uuid(),required:z.boolean(),version:z.number().int().positive(),reason});
export const controlFiltersSchema=z.object({company:z.string().uuid(),from:isoDate,to:isoDate,page:z.coerce.number().int().min(0).max(20000).default(0),approval:z.enum(['all','none','submitted','approved','rejected']).default('all'),locked:z.enum(['all','yes','no']).default('all')}).refine(v=>v.from<=v.to,'Start date must not follow end date');
