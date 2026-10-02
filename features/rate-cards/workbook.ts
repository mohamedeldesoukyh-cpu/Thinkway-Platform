import ExcelJS from "exceljs";
import { DELIVERABLE_TYPES_BY_PLATFORM } from "@/lib/campaigns/deliverable-taxonomy";

export const RATE_HEADERS=["Creator Name","Creator ID","Instagram Handle","TikTok Handle","Other Platform Handle","Platform","Deliverable Type","Creator Cost","Creator Currency","Client Selling Price","Client Currency","GP %","Margin / Markup %","Agency Fee %","Notes"];
export async function buildRateTemplate(currencies:string[]) {
  if(!currencies.length)throw new Error("currency");
  const book=new ExcelJS.Workbook(); const sheet=book.addWorksheet("Rates");
  sheet.addRow(RATE_HEADERS);
  sheet.getRow(1).font={bold:true};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE8EEF5"}};
  sheet.views=[{state:"frozen",ySplit:1}];sheet.columns.forEach(c=>c.width=24);sheet.getColumn(8).numFmt="#,##0.00";
  const lists=book.addWorksheet("Lists");const platforms=Object.keys(DELIVERABLE_TYPES_BY_PLATFORM);const types=[...new Set(Object.values(DELIVERABLE_TYPES_BY_PLATFORM).flatMap(t=>t.map(x=>x.value)))];
  [platforms,types,currencies].forEach((values,i)=>values.forEach((v,j)=>lists.getCell(j+1,i+1).value=v));
  for(let row=2;row<=5001;row++)for(const [col,listCol,len] of [[6,"A",platforms.length],[7,"B",types.length],[9,"C",currencies.length],[11,"C",currencies.length]] as const)sheet.getCell(row,col).dataValidation={type:"list",allowBlank:false,formulae:[`Lists!$${listCol}$1:$${listCol}$${len}`],showErrorMessage:true,errorTitle:"Invalid value / قيمة غير صالحة",error:"Choose a listed value / اختر قيمة من القائمة"};
  for(let row=2;row<=5001;row++) {
    sheet.getCell(row,12).value={formula: 'IF(AND(ISNUMBER(H'+row+'),ISNUMBER(J'+row+'),I'+row+'=K'+row+',J'+row+'<>0),(J'+row+'-H'+row+')/J'+row+',"")'};
    sheet.getCell(row,13).value={formula: 'IF(AND(ISNUMBER(H'+row+'),ISNUMBER(J'+row+'),I'+row+'=K'+row+',H'+row+'<>0),(J'+row+'-H'+row+')/H'+row+',"")'};
    sheet.getCell(row,12).numFmt='0.00%';sheet.getCell(row,13).numFmt='0.00%';
    sheet.getCell(row,14).dataValidation={type:'decimal',operator:'between',formulae:[0,100],allowBlank:true,showErrorMessage:true};
  }
  book.calcProperties.fullCalcOnLoad=true;
  const instructions=book.addWorksheet("Instructions");instructions.getColumn(1).width=115;
  instructions.addRows([["Use Creator ID (inf:UUID / dis:UUID), or an exact platform handle. Names are never used for matching."],["استخدم معرّف المبدع أو حساب المنصة المطابق تماماً. لا تتم المطابقة بالاسم."],["One row per creator + platform + deliverable; use numeric rates without separators. Zero is allowed."],["صف لكل مبدع ومنصة ونوع محتوى. أدخل سعراً رقمياً دون فواصل؛ الصفر مسموح."],["Choose a deliverable belonging to the selected platform. Upload previews validate every row before import."],["اختر نوع محتوى يخص المنصة المحددة. تتم مراجعة كل الصفوف قبل الاستيراد."]]);
  instructions.addRows([["Creator Cost and Client Selling Price are independent and optional; enter at least one. Use the matching currency column for each. Agency Fee % is optional (e.g. 10 means 10%)."],["تكلفة المبدع وسعر البيع للعميل مستقلان؛ أدخل أحدهما على الأقل وعملته. نسبة أتعاب الوكالة اختيارية (10 تعني 10%)."],["GP % and Margin / Markup % are calculated, never imported as price overrides. They display only when both prices use the same currency. Uploading costs never generates selling prices automatically."],["نسب الربح والهامش محسوبة ولا تستبدل الأسعار المرفوعة. تظهر عند وجود السعرين بالعملة نفسها. رفع التكلفة لا ينشئ سعر بيع تلقائياً."]]);
  return book.xlsx.writeBuffer();
}
export async function readRateWorkbook(bytes:ArrayBuffer):Promise<{row:number;raw:Record<string,string>;unsupported:boolean}[]> {
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const sheet=book.getWorksheet("Rates")??book.worksheets[0];if(!sheet||sheet.rowCount>5001)throw new Error("file");
  const headers=sheet.getRow(1).values as unknown[];
  const required=headers.includes("Rate")?["Creator ID","Platform","Deliverable Type","Rate","Currency","Rate Type"]:["Creator ID","Platform","Deliverable Type","Creator Cost","Creator Currency","Client Selling Price","Client Currency"];
  if(!required.every(h=>headers.includes(h)))throw new Error("file");
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error("file");
  const result:{row:number;raw:Record<string,string>;unsupported:boolean}[]=[];
  for(let n=2;n<=sheet.rowCount;n++) {
    const row=sheet.getRow(n);if(!row.hasValues)continue;
    let unsupported=false;const raw:Record<string,string>={};
    row.eachCell((c,i)=>{if(["GP %","Margin / Markup %"].includes(String(headers[i])))return;if(typeof c.value==="object"&&c.value!==null)unsupported=true;raw[String(headers[i])]=typeof c.value==="object"&&c.value!==null?"":c.text.trim();});
    if(unsupported||Object.values(raw).some(Boolean))result.push({row:n,raw,unsupported});
  }
  if(!result.length)throw new Error("file");return result;
}
