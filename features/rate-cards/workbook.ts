import {RATE_PLATFORM_OPTIONS,ALL_PLATFORM_TYPES} from "./platforms";
import ExcelJS from "exceljs";
import { DELIVERABLE_TYPES_BY_PLATFORM } from "@/lib/campaigns/deliverable-taxonomy";

export const RATE_HEADERS=["Profile URL","Creator Name","Creator ID","Instagram Handle","TikTok Handle","Other Platform Handle","Platform","Deliverable Type","Creator Cost","Creator Currency","Client Selling Price","Client Currency","GP %","Margin / Markup %","Agency Fee %","Notes","Period (Months)","Usage Rights Monthly Creator Cost","Usage Rights Monthly Client Price","Usage Rights Period (Months)","Boosting Monthly Creator Cost","Boosting Monthly Client Price","Boosting Period (Months)","Event Attendance Creator Cost","Event Attendance Client Price"];
export async function buildRateTemplate(currencies:string[]) {
  if(!currencies.length)throw new Error("currency");
  const book=new ExcelJS.Workbook(); const sheet=book.addWorksheet("Rates");
  sheet.addRow(RATE_HEADERS);
  sheet.getRow(1).font={bold:true};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE8EEF5"}};
  sheet.views=[{state:"frozen",ySplit:1}];sheet.columns.forEach(c=>c.width=24);sheet.getColumn(9).numFmt="#,##0.00";
  const lists=book.addWorksheet("Lists");const platforms=RATE_PLATFORM_OPTIONS.map(p=>p.value);const types=[...ALL_PLATFORM_TYPES.map(t=>t.value),"usage_right","boosting","event_attendance",...new Set(Object.values(DELIVERABLE_TYPES_BY_PLATFORM).flatMap(t=>t.map(x=>x.value)))];
  [platforms,types,currencies].forEach((values,i)=>values.forEach((v,j)=>lists.getCell(j+1,i+1).value=v));
  for(let row=2;row<=5001;row++)for(const [col,listCol,len] of [[7,"A",platforms.length],[8,"B",types.length],[10,"C",currencies.length],[12,"C",currencies.length]] as const)sheet.getCell(row,col).dataValidation={type:"list",allowBlank:true,formulae:[`Lists!$${listCol}$1:$${listCol}$${len}`],showErrorMessage:true,errorTitle:"Invalid value / قيمة غير صالحة",error:"Choose a listed value / اختر قيمة من القائمة"};
  for(let row=2;row<=5001;row++) {
    sheet.getCell(row,13).value={formula: 'IF(AND(ISNUMBER(I'+row+'),ISNUMBER(K'+row+'),J'+row+'=L'+row+',K'+row+'<>0),(K'+row+'-I'+row+')/K'+row+',"")'};
    sheet.getCell(row,14).value={formula: 'IF(AND(ISNUMBER(I'+row+'),ISNUMBER(K'+row+'),J'+row+'=L'+row+',I'+row+'<>0),(K'+row+'-I'+row+')/I'+row+',"")'};
    sheet.getCell(row,13).numFmt='0.00%';sheet.getCell(row,14).numFmt='0.00%';
    sheet.getCell(row,15).dataValidation={type:'decimal',operator:'between',formulae:[0,100],allowBlank:true,showErrorMessage:true};
  }
  for(let row=2;row<=5001;row++)for(const col of [17,20,23])sheet.getCell(row,col).dataValidation={type:"whole",operator:"between",formulae:[1,120],allowBlank:true,showErrorMessage:true,error:"Enter months from 1 to 120."};
  sheet.getColumn(1).width=45;
  book.calcProperties.fullCalcOnLoad=true;
  const instructions=book.addWorksheet("Instructions");instructions.getColumn(1).width=115;
  instructions.addRows([["Paste a creator profile link in Profile URL. Instagram Handle and TikTok Handle also accept profile URLs. Other Platform Handle accepts other platform URLs (separate multiple links with semicolons). Links in one row belong to the same creator: existing accounts are reused and missing accounts are linked, without merging conflicting creators. Platform, Creator Name, ID and handles may be blank. The platform is detected from the URL; existing creators are reused and enrichment is requested. Older ID/handle templates still work."],["الصق رابط حساب المبدع في Profile URL واترك الاسم والمعرّف والحسابات والمنصة فارغة. يتم تحديد المنصة تلقائياً وإعادة استخدام المبدع وطلب تحديث بياناته."],["One row per creator + platform + deliverable; use numeric rates without separators. Zero is allowed."],["صف لكل مبدع ومنصة ونوع محتوى. أدخل سعراً رقمياً دون فواصل؛ الصفر مسموح."],["Choose all in Platform for an All Platforms rate, with a generic deliverable such as reel or video. Keep Profile URL as the real social profile link. Specific platform rates take priority when applying a quotation. Choose a deliverable belonging to the selected platform. Upload previews validate every row before import."],["اختر نوع محتوى يخص المنصة المحددة. تتم مراجعة كل الصفوف قبل الاستيراد."]]);
  instructions.addRows([["Creator Cost and Client Selling Price are independent and optional; enter at least one. Use the matching currency column for each. Agency Fee % is optional (e.g. 10 means 10%)."],["تكلفة المبدع وسعر البيع للعميل مستقلان؛ أدخل أحدهما على الأقل وعملته. نسبة أتعاب الوكالة اختيارية (10 تعني 10%)."],["GP % and Margin / Markup % are calculated, never imported as price overrides. They display only when both prices use the same currency. Uploading costs never generates selling prices automatically."],["نسب الربح والهامش محسوبة ولا تستبدل الأسعار المرفوعة. تظهر عند وجود السعرين بالعملة نفسها. رفع التكلفة لا ينشئ سعر بيع تلقائياً."]]);
  instructions.addRows([["Usage Rights and Boosting amounts are MONTHLY rates. Period is in months (1–120). Reports show monthly rate × period. Quotations use their selected months. Event Attendance is a one-time rate. Extra charges use the Creator Currency / Client Currency columns, and may be uploaded without a base content price."],["حقوق الاستخدام والترويج بأسعار شهرية × عدد الشهور. حضور الفعالية بسعر مرة واحدة. تستخدم الرسوم الإضافية أعمدة عملة المبدع والعميل ويمكن رفعها دون سعر محتوى أساسي."]]);
  return book.xlsx.writeBuffer();
}
export async function readRateWorkbook(bytes:ArrayBuffer):Promise<{row:number;raw:Record<string,string>;unsupported:boolean}[]> {
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const sheet=book.getWorksheet("Rates")??book.worksheets[0];if(!sheet||sheet.rowCount>5001)throw new Error("file");
  const headers=sheet.getRow(1).values as unknown[];
  const required=headers.includes("Rate")?["Creator ID","Platform","Deliverable Type","Rate","Currency","Rate Type"]:["Creator ID","Platform","Deliverable Type","Creator Cost","Creator Currency","Client Selling Price","Client Currency"];
  if(!(headers.includes("Profile URL") ? headers.includes("Deliverable Type") && ((headers.includes("Creator Cost") && headers.includes("Creator Currency")) || (headers.includes("Client Selling Price") && headers.includes("Client Currency"))) : required.every(h=>headers.includes(h))))throw new Error("file");
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error("file");
  const result:{row:number;raw:Record<string,string>;unsupported:boolean}[]=[];
  for(let n=2;n<=sheet.rowCount;n++) {
    const row=sheet.getRow(n);if(!row.hasValues)continue;
    let unsupported=false;const raw:Record<string,string>={};
    row.eachCell((c,i)=>{if(["GP %","Margin / Markup %"].includes(String(headers[i])))return;if(headers[i]==="Profile URL"&&typeof c.value==="object"&&c.value!==null&&"hyperlink" in c.value){raw["Profile URL"]=c.value.hyperlink.trim();return;}if(typeof c.value==="object"&&c.value!==null)unsupported=true;raw[String(headers[i])]=typeof c.value==="object"&&c.value!==null?"":c.text.trim();});
    if(unsupported||Object.values(raw).some(Boolean))result.push({row:n,raw,unsupported});
  }
  if(!result.length)throw new Error("file");return result;
}
