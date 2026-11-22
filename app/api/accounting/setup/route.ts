import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { accountingContext, loadAccountingSetup } from "@/features/accounting/setup-server";
import { accountSchema, companySchema, companyEditSchema, moduleSchema, yearSchema } from "@/features/accounting/setup-validation";
import { CHART } from "@/features/accounting/chart";
import { assertCsrfRequest } from "@/lib/security/csrf";

export async function GET(request: Request) {
  try { return NextResponse.json(await loadAccountingSetup(new URL(request.url).searchParams.get("company") ?? undefined), {headers:{"Cache-Control":"private, no-store"}}); }
  catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : "Could not load accounting setup"},{status:403}); }
}

export async function POST(request: Request) {
  const csrf = assertCsrfRequest(request);
  if (!csrf.ok) return NextResponse.json({error:csrf.reason},{status:403});
  try {
    const { db, access } = await accountingContext();
    if (!access.manage) return NextResponse.json({error:"Accounting management access required"},{status:403});
    const body = await request.json();
    let result;
    if (body.operation === "company-create") {
      const v = companySchema.parse(body.value);
      result = await db.rpc("tw_accounting_create_company",{p_name:v.name,p_country:v.country,p_currency:v.currency,p_start:v.start,p_chart:CHART});
    } else if (body.operation === "company-update") {
      const v = companyEditSchema.parse(body.value);
      result = await db.from("tw_accounting_companies").update({name:v.name,country_code:v.country_code,currencies:[...new Set(v.currencies)]}).eq("id",v.id).eq("version",v.version).select("id").single();
    } else if (body.operation === "account-save") {
      const v = accountSchema.parse(body.value);
      const row = {company_id:v.companyId,code:v.code,name:v.name,name_ar:v.nameAr,parent_code:v.parent,account_type:v.type,normal_balance:v.normal,kind:v.kind,subledger:v.subledger,client_id:v.clientId,vendor_id:v.vendorId,has_auxiliary:v.hasAuxiliary,auxiliary_source_code:v.auxiliarySource,active:v.active};
      if (v.version === null && v.kind === "System") throw new Error("System accounts are reserved for the accounting engine");
      result = v.version === null ? await db.from("tw_accounting_accounts").insert(row).select("code").single() : await db.from("tw_accounting_accounts").update(row).eq("company_id",v.companyId).eq("code",v.code).eq("version",v.version).select("code").single();
    } else if (body.operation === "year-create") {
      const v = yearSchema.parse(body.value);
      result = await db.rpc("tw_accounting_add_year",{p_company:v.companyId,p_start:v.start});
    } else if (body.operation === "module-save") {
      if (!access.admin) return NextResponse.json({error:"Administrator access required"},{status:403});
      const v = moduleSchema.parse(body.value);
      const row = {profile_id:v.profileId,media:v.media,accounting_role:v.accountingRole};
      result = v.version === null ? await db.from("tw_module_assignments").insert(row).select("profile_id").single() : await db.from("tw_module_assignments").update(row).eq("profile_id",v.profileId).eq("version",v.version).select("profile_id").single();
    } else return NextResponse.json({error:"Unknown operation"},{status:400});
    if (result.error) {
      const conflict = ["PGRST116","23505"].includes(result.error.code ?? "");
      return NextResponse.json({error: conflict ? "This record changed or its code already exists. Reload and try again." : result.error.message},{status:conflict ? 409 : 400});
    }
    revalidatePath("/accounting"); revalidatePath("/modules");
    return NextResponse.json({ok:true,data:result.data});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error ? e.message : "Could not save changes"},{status:400});
  }
}
