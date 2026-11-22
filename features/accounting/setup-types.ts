import type { SystemMapping } from './mapping-model';
import type { Account } from "./chart";
import type { ModuleAccess } from "@/lib/auth/module-access";

export type Company = { id: string; name: string; country_code: string; base_currency: string; currencies: string[]; fiscal_start_month: number; journal_approval_required?: boolean; version: number };
export type SavedAccount = Account & { hasAuxiliary?:boolean;auxiliarySource?:string|null;auxiliaryMode?:'none'|'own'|'shared';clientId?:string|null;vendorId?:string|null;nameAr: string; active: boolean; version: number };
export type FiscalYear = { id: string; start_date: string; end_date: string };
export type FiscalPeriod = { id: string; year_id: string; period_number: number; start_date: string; end_date: string; is_closed:boolean; lock_reason:string|null; version:number };
export type ModuleUser = { id: string; full_name: string | null; email: string; role: string; media: boolean; accounting_role: string; version: number | null; locked: boolean };
export type AccountingSetup = { mappings?:SystemMapping[]; access: ModuleAccess; companies: Company[]; company: Company | null; accounts: SavedAccount[]; years: FiscalYear[]; periods: FiscalPeriod[]; users: ModuleUser[] };
