import { writeFile,mkdir } from "node:fs/promises";
import { financeReportPdf } from "../features/finance-assistant/report-pdf";
async function main(){
 const destination="C:/thinkway-platform/.tmp/finance-assistant-release";
 await mkdir(destination,{recursive:true});
 const buffer=await financeReportPdf({title:"Statement of Account / كشف حساب",href:"/accounting",scope:"Development fixture · 2026-11-01 to 2026-11-30 · USD only · Posted entries · Not a real client report.",facts:{company:"Thinkway — Development fixture"},tables:[{heading:"USD · Entries / القيود",columns:["Date","JV","Reference","Account","Description","Debit","Credit","Account balance"],rows:Array.from({length:65},(_,i)=>["2026-11-01",`FIXTURE-${i+1}`,"PDF layout verification","121001",i%2?"Invoice and payment allocation":"فاتورة خدمات وتسوية دفعة العميل","1234.56","0.00","1234.56"])}]},"2026-11-24T00:00:00Z");
 await writeFile(destination+"/amgad-pdf-fixture.pdf",buffer);console.log("Saved PDF fixture",buffer.length);
 const summary=await financeReportPdf({title:"Accounting Profit & Loss",href:"/accounting",scope:"Development fixture · 2026-11-01 to 2026-11-30 · Journal dates · Posted transactions including unlocked entries · Company base currency: EGP. Closing entries excluded. Ledger-based income and expenses; completeness depends on recorded entries, not certified IFRS financial statements. Report link opens the accounting screen; use the dates and display shown here.",facts:{company:"Development fixture"},tables:[{heading:"EGP · Summary",columns:["Code","Name","Classification","Income / (expense)"],rows:[...Array.from({length:10},(_,i)=>[String(410000+i),"Summary account",i?"Expense":"Revenue","0.00"]),["","Net profit / (loss)","Total","0.00"]]}]},"2026-11-24T00:00:00Z");
 await writeFile(destination+"/amgad-pnl-layout-fixture.pdf",summary);
}
void main();
