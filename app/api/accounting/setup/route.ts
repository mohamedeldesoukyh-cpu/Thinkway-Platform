import {chartPreview,type ChartAuxiliary} from '@/features/accounting/chart-preview';
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { accountingContext, loadAccountingSetup } from "@/features/accounting/setup-server";
import { accountSchema, companySchema, companyEditSchema, moduleSchema, yearSchema } from "@/features/accounting/setup-validation";
import { CHART } from "@/features/accounting/chart";
import { assertCsrfRequest } from "@/lib/security/csrf";

export async function GET(request: Request) {
  try { const q=new URL(request.url).searchParams,setup=await loadAccountingSetup(q.get('company')??undefined);
    if(q.get('preview')==='chart'){
      if(!setup.company)throw Error('Choose a configured company');
      let auxiliaries:ChartAuxiliary[]|null=null;
      if(q.get('auxiliaries')==='true'){
        const {db}=await accountingContext();auxiliaries=[];
        for(let offset=0;;offset+=1000){const r=await db.from('tw_accounting_auxiliaries').select('account_code,number,staff_number,name,active').eq('company_id',setup.company.id).order('account_code').order('number').range(offset,offset+999);if(r.error)throw Error(r.error.message);for(const x of r.data){if(x.staff_number!==null){for(const a of setup.accounts.filter(a=>a.subledger==='Employee'))auxiliaries.push({...x,account_code:a.code,number:x.staff_number});}else if(x.account_code&&!setup.accounts.some(a=>a.code===x.account_code&&['Customer','Supplier / creator'].includes(a.directoryKind??a.subledger??'')))auxiliaries.push(x);}if(r.data.length<1000)break;}
        for(const kind of ['client','vendor']){
          const codes=setup.accounts.filter(a=>(a.directoryKind??a.subledger)===(kind==='client'?'Customer':'Supplier / creator')).map(a=>a.code);
          if(!codes.length)continue;
          for(let page=0;;page++){const r=await db.rpc('tw_accounting_party_accounts',{p_company:setup.company.id,p_kind:kind,p_page:page,p_search:''});if(r.error)throw Error(r.error.message);for(const row of r.data.rows)for(const account_code of codes)auxiliaries.push({account_code,number:row.code,name:row.name,active:true});if((page+1)*50>=r.data.count)break;}
        }
      }
      return NextResponse.json(chartPreview(setup,(q.get('codes')??'').split(','),auxiliaries),{headers:{'Cache-Control':'private, no-store'}});
    }
    return NextResponse.json(setup,{headers:{'Cache-Control':'private, no-store'}}); }
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
      const row = {company_id:v.companyId,code:v.code,name:v.name,name_ar:v.nameAr,parent_code:v.parent,account_type:v.type,normal_balance:v.normal,kind:v.kind,subledger:v.subledger,client_id:v.clientId,vendor_id:v.vendorId,has_auxiliary:v.hasAuxiliary,directory_source_code:v.directorySource,auxiliary_source_code:v.auxiliarySource,active:v.active};
      if (v.version === null && v.kind === "System") throw new Error("System accounts are reserved for the accounting engine");
      result = await db.rpc("tw_accounting_account_save",{p_value:row,p_version:v.version,p_auxiliaries:v.auxiliaries});
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
      const conflict = ["PGRST116","23505","40001"].includes(result.error.code ?? "");
      return NextResponse.json({error: conflict ? "This record changed or its code already exists. Reload and try again." : result.error.message},{status:conflict ? 409 : 400});
    }
    revalidatePath("/accounting"); revalidatePath("/modules");
    return NextResponse.json({ok:true,data:result.data});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error ? e.message : "Could not save changes"},{status:400});
  }
}
