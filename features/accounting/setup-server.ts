import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import { loadModuleAccess } from "@/lib/auth/module-access";
import { ensurePrivilegedAal2 } from "@/lib/auth/mfa";
import type { AccountingSetup, Company, FiscalPeriod, FiscalYear, ModuleUser, SavedAccount } from "./setup-types";

export async function accountingContext() {
  const { user, roleSlug } = await getRequestAuth();
  if (!user) throw new Error("Please sign in.");
  const db = await createSupabaseServerClient() as SupabaseClient;
  const access = await loadModuleAccess(db);
  if (!access.accounting) throw new Error("TW Accounting access is not assigned to your user.");
  const mfa = await ensurePrivilegedAal2(db, access.manage ? "finance" : roleSlug);
  if (!mfa.ok) throw new Error(mfa.error);
  return { db, access, user };
}

export async function loadAccountingSetup(companyId?: string): Promise<AccountingSetup> {
  const { db, access } = await accountingContext();
  const { data, error } = await db.from("tw_accounting_companies").select("id,name,country_code,base_currency,currencies,fiscal_start_month,version").order("name");
  if (error) throw new Error("Could not load accounting companies.");
  const companies = (data ?? []) as Company[];
  const company = (companyId ? companies.find(c => c.id === companyId) : companies[0]) ?? null;
  if (companyId && !company) throw new Error("Accounting company not found.");
  let mappings: import('./mapping-model').SystemMapping[] = [];
  let accounts: SavedAccount[] = [], years: FiscalYear[] = [], periods: FiscalPeriod[] = [];
  if (company) {
    const [a, m, y] = await Promise.all([
      db.from("tw_accounting_accounts").select("code,name,name_ar,parent_code,account_type,normal_balance,kind,subledger,has_auxiliary,auxiliary_source_code,client_id,vendor_id,active,version").eq("company_id", company.id).order("code"),
      db.rpc('tw_accounting_mappings_read',{p_company:company.id}),
      db.from("tw_accounting_years").select("id,start_date,end_date").eq("company_id", company.id).order("start_date"),
    ]);
    if (a.error || y.error || m.error) throw new Error("Could not load saved chart or financial years.");
    accounts = (a.data ?? []).map(row => ({ code: row.code, name: row.name, nameAr: row.name_ar, parent: row.parent_code, type: row.account_type, normal: row.normal_balance, kind: row.kind, subledger: row.subledger ?? undefined, hasAuxiliary:row.has_auxiliary,auxiliarySource:row.auxiliary_source_code,clientId:row.client_id,vendorId:row.vendor_id, active: row.active, version: row.version }));
    mappings = m.data ?? [];
    years = (y.data ?? []) as FiscalYear[];
    if (years.length) {
      const result = await db.from("tw_accounting_periods").select("id,year_id,period_number,start_date,end_date,is_closed,lock_reason,version").in("year_id",years.map(y => y.id)).order("start_date");
      if (result.error) throw new Error("Could not load fiscal periods.");
      periods = (result.data ?? []) as FiscalPeriod[];
    }
  }
  let users: ModuleUser[] = [];
  if (access.admin) {
    const [p, m, c, i] = await Promise.all([
      db.from("profiles").select("id,full_name,email,role:roles(slug)").eq("is_active",true).order("full_name"),
      db.from("tw_module_assignments").select("profile_id,media,accounting_role,version"),
      db.from("client_users").select("profile_id"), db.from("influencers").select("profile_id").not("profile_id","is",null),
    ]);
    if (p.error || m.error || c.error || i.error) throw new Error("Could not load module assignments.");
    const portalIds = new Set([...(c.data ?? []),...(i.data ?? [])].map(r => r.profile_id));
    users = (p.data ?? []).filter(r => !portalIds.has(r.id)).map(r => {
      const role = (r.role as unknown as { slug: string } | null)?.slug ?? "";
      const assignment = m.data?.find(a => a.profile_id === r.id);
      const locked = ["admin","super_admin"].includes(role);
      return { id:r.id, full_name:r.full_name, email:r.email, role, media: locked || (assignment?.media ?? true), accounting_role: locked ? "manage" : assignment?.accounting_role ?? (role === "finance" ? "manage" : "none"), version: assignment?.version ?? null, locked };
    }).filter(u => !["client_user","influencer"].includes(u.role));
  }
  return { access, companies, company, accounts, years, periods, users, mappings };
}
