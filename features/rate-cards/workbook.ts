import {RATE_PLATFORM_OPTIONS,ALL_PLATFORM_TYPES} from "./platforms";
import ExcelJS from "exceljs";
import { DELIVERABLE_TYPES_BY_PLATFORM } from "@/lib/campaigns/deliverable-taxonomy";

export const RATE_HEADERS=["Profile URL 1","Profile URL 2","Profile URL 3","Creator Name","Creator ID","Platform","Deliverable Type","Creator Cost","Creator Currency","Client Selling Price","Client Currency","GP %","Margin / Markup %","Agency Fee %","Notes","Period (Months)","Usage Rights Monthly Creator Cost","Usage Rights Monthly Client Price","Usage Rights Period (Months)","Boosting Monthly Creator Cost","Boosting Monthly Client Price","Boosting Period (Months)","Event Attendance Creator Cost","Event Attendance Client Price","Event Days"];
export const PACKAGE_HEADERS=["Profile URL 1","Profile URL 2","Profile URL 3","Creator Name","Creator ID","Package Code","Package Name","Reels","Stories","Package Creator Cost","Creator Currency","Package Client Price","Client Currency","Usage Rights Monthly Creator Cost","Usage Rights Monthly Client Price","Usage Rights Period (Months)","Boosting Monthly Creator Cost","Boosting Monthly Client Price","Boosting Period (Months)","Agency Fee %","Notes","Event Attendance Creator Cost","Event Attendance Client Price","Event Days"];
export async function buildPackageTemplate(currencies:string[]){
 if(!currencies.length)throw new Error("currency");
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Packages"),lists=book.addWorksheet("Lists");
 sheet.addRow(PACKAGE_HEADERS);sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1248D8"}};
 sheet.views=[{state:"frozen",ySplit:1}];sheet.columns.forEach(c=>c.width=26);for(const col of [1,2,3])sheet.getColumn(col).width=45;
 currencies.forEach((c,i)=>lists.getCell(i+1,1).value=c);
 for(let row=2;row<=5001;row++)sheet.getCell(row,24).dataValidation={type:"whole",operator:"between",formulae:[1,365],allowBlank:true,showErrorMessage:true,error:"Enter event days from 1 to 365."};
 for(let row=2;row<=5001;row++){
  for(const col of [11,13])sheet.getCell(row,col).dataValidation={type:"list",allowBlank:true,formulae:[`Lists!$A$1:$A$${currencies.length}`],showErrorMessage:true,error:"Choose a listed currency."};
  for(const col of [8,9,16,19])sheet.getCell(row,col).dataValidation={type:"whole",operator:"between",formulae:[col<10?0:1,col<10?1000:120],allowBlank:true,showErrorMessage:true,error:col<10?"Enter a whole quantity from 0 to 1000.":"Enter months from 1 to 120."};
 }
 const instructions=book.addWorksheet("Instructions");instructions.getColumn(1).width=125;
 instructions.addRows([
  ["Creator Packages: one row per creator + package. Use Package Code (letters, numbers, - or _) to identify an offer; a different code creates another package. Keep the code unchanged to update its prices."],
  ["Paste one to three profile URLs for the SAME creator, in any order. These links define the platforms INCLUDED in this package, even if other accounts exist in the system."],
  ["Reels is the number of original reels shared/mirrored to every linked platform. Stories is the number of stories on linked Instagram and Facebook accounts only; TikTok is excluded from story delivery. At least one quantity is required."],
  ["Enter the total Package Creator Cost and/or Package Client Price once. Do not multiply the package price by the number of platforms or deliverables. Choose the matching currencies."],
  ["Prices and Agency Fee % are automatically rounded to the nearest 4 decimal places during import. Review the original and rounded values in the Warnings tab; these warnings do not block import. Quantities, event days and months must remain whole numbers."],
  ["تُقرّب الأسعار ونسبة أتعاب الوكالة تلقائياً إلى أقرب ٤ منازل عشرية أثناء الاستيراد. راجع القيم الأصلية والمقرّبة في تبويب التحذيرات؛ لا تمنع هذه التحذيرات الاستيراد. يجب أن تظل الكميات والأيام والشهور أعداداً صحيحة."],
  ["Usage Rights and Boosting are separate monthly rates: monthly amount × months. Agency Fee is not included in client reports. Notes and creator costs are internal."],
  ["Event Attendance Creator Cost and Event Attendance Client Price are daily rates. Event Days multiplies both rates (1–365; blank defaults to 1). Travel uplift percentages are entered manually in the rate card, not this template."],
  ["Examples is a reference sheet only and will not be imported. Replace sample profile links with actual creator URLs when entering your Packages rows. Individual Rates and older Rate Card templates are also accepted by the same upload button."],
  ["صف واحد لكل مبدع وباقة. الروابط تحدد منصات الباقة. الريل يُنشر على كل المنصات المرفقة والستوري على إنستغرام وفيسبوك فقط. سعر الباقة يُحتسب مرة واحدة وحقوق الاستخدام والترويج مبالغ شهرية منفصلة."],
 ]);
 const examples=book.addWorksheet("Examples");examples.addRow(PACKAGE_HEADERS);examples.columns.forEach(c=>c.width=26);
 for(const [name,platforms,price,ur,boost] of [["Ahmed",["instagram","tiktok","facebook"],100000,20000,10000],["Mostafa",["instagram","tiktok"],400000,30000,20000],["Sara",["facebook"],700000,90000,40000]] as const){
  const links=platforms.map(p=>`https://${p}.com/${p==="tiktok"?"@":""}${name.toLowerCase()}-example`);
  examples.addRow([links[0],links[1]??"",links[2]??"",name,"","reel-story","Reel + Story Package",1,1,"","EGP",price,"EGP","",ur,1,"",boost,1,"",""]);
 }
 return book.xlsx.writeBuffer();
}
export async function buildRateTemplate(currencies:string[]) {
  if(!currencies.length)throw new Error("currency");
  const book=new ExcelJS.Workbook(); const sheet=book.addWorksheet("Rates");
  sheet.addRow(RATE_HEADERS);
  sheet.getRow(1).font={bold:true};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE8EEF5"}};
  sheet.views=[{state:"frozen",ySplit:1}];sheet.columns.forEach(c=>c.width=24);sheet.getColumn(8).numFmt="#,##0.00";
  const lists=book.addWorksheet("Lists");const platforms=RATE_PLATFORM_OPTIONS.map(p=>p.value);const types=[...ALL_PLATFORM_TYPES.map(t=>t.value),"usage_right","boosting","event_attendance",...new Set(Object.values(DELIVERABLE_TYPES_BY_PLATFORM).flatMap(t=>t.map(x=>x.value)))];
  [platforms,types,currencies].forEach((values,i)=>values.forEach((v,j)=>lists.getCell(j+1,i+1).value=v));
  for(let row=2;row<=5001;row++)for(const [col,listCol,len] of [[6,"A",platforms.length],[7,"B",types.length],[9,"C",currencies.length],[11,"C",currencies.length]] as const)sheet.getCell(row,col).dataValidation={type:"list",allowBlank:true,formulae:[`Lists!$${listCol}$1:$${listCol}$${len}`],showErrorMessage:true,errorTitle:"Invalid value / قيمة غير صالحة",error:"Choose a listed value / اختر قيمة من القائمة"};
  for(let row=2;row<=5001;row++) {
    sheet.getCell(row,12).value={formula: 'IF(AND(ISNUMBER(H'+row+'),ISNUMBER(J'+row+'),I'+row+'=K'+row+',J'+row+'<>0),(J'+row+'-H'+row+')/J'+row+',"")'};
    sheet.getCell(row,13).value={formula: 'IF(AND(ISNUMBER(H'+row+'),ISNUMBER(J'+row+'),I'+row+'=K'+row+',H'+row+'<>0),(J'+row+'-H'+row+')/H'+row+',"")'};
    sheet.getCell(row,12).numFmt='0.00%';sheet.getCell(row,13).numFmt='0.00%';
    sheet.getCell(row,14).dataValidation={type:'decimal',operator:'between',formulae:[0,100],allowBlank:true,showErrorMessage:true};
  }
  for(let row=2;row<=5001;row++)for(const col of [16,19,22])sheet.getCell(row,col).dataValidation={type:"whole",operator:"between",formulae:[1,120],allowBlank:true,showErrorMessage:true,error:"Enter months from 1 to 120."};
  for (const col of [1,2,3]) sheet.getColumn(col).width=45;
  for(let row=2;row<=5001;row++)sheet.getCell(row,25).dataValidation={type:"whole",operator:"between",formulae:[1,365],allowBlank:true,showErrorMessage:true,error:"Enter event days from 1 to 365."};
  book.calcProperties.fullCalcOnLoad=true;
  const instructions=book.addWorksheet("Instructions");instructions.getColumn(1).width=115;
  instructions.addRows([["Prices and Agency Fee % are automatically rounded to the nearest 4 decimal places. The Warnings tab shows original and rounded values without blocking import. Quantities, days and months must be whole numbers."],["تُقرّب الأسعار ونسبة أتعاب الوكالة تلقائياً إلى أقرب ٤ منازل عشرية. يعرض تبويب التحذيرات القيم الأصلية والمقرّبة دون منع الاستيراد. الكميات والأيام والشهور يجب أن تكون أعداداً صحيحة."]]);
  instructions.addRows([["Paste up to three profile links for the SAME creator in Profile URL 1, Profile URL 2 and Profile URL 3, in any platform order. One link is enough; the other two are optional. Each platform is detected automatically. Links in one row belong to the same creator: existing accounts are reused and missing accounts are linked, without merging conflicting creators. Platform, Creator Name and Creator ID may be blank. The platform is detected from the URL; existing creators are reused and enrichment is requested. Older ID/handle templates still work."],["أدخل حتى ثلاثة روابط للمبدع نفسه في Profile URL 1 و Profile URL 2 و Profile URL 3 بأي ترتيب للمنصات. يكفي رابط واحد ويمكن ترك الاسم والمعرّف والمنصة فارغة. يتم تحديد المنصة تلقائياً وإعادة استخدام المبدع وطلب تحديث بياناته."],["One row per creator + platform + deliverable; use numeric rates without separators. Zero is allowed."],["صف لكل مبدع ومنصة ونوع محتوى. أدخل سعراً رقمياً دون فواصل؛ الصفر مسموح."],["Choose all in Platform for an All Platforms rate, with a generic deliverable such as reel or video. Use real social profile links in the Profile URL columns. Specific platform rates take priority when applying a quotation. Choose a deliverable belonging to the selected platform. Upload previews validate every row before import."],["اختر نوع محتوى يخص المنصة المحددة. تتم مراجعة كل الصفوف قبل الاستيراد."]]);
  instructions.addRows([["Creator Cost and Client Selling Price are independent and optional; enter at least one. Use the matching currency column for each. Agency Fee % is optional (e.g. 10 means 10%)."],["تكلفة المبدع وسعر البيع للعميل مستقلان؛ أدخل أحدهما على الأقل وعملته. نسبة أتعاب الوكالة اختيارية (10 تعني 10%)."],["GP % and Margin / Markup % are calculated, never imported as price overrides. They display only when both prices use the same currency. Uploading costs never generates selling prices automatically."],["نسب الربح والهامش محسوبة ولا تستبدل الأسعار المرفوعة. تظهر عند وجود السعرين بالعملة نفسها. رفع التكلفة لا ينشئ سعر بيع تلقائياً."]]);
  instructions.addRows([["Usage Rights and Boosting amounts are MONTHLY rates. Period is in months (1–120). Reports show monthly rate × period. Quotations use their selected months. Event Attendance is a daily rate × Event Days (1–365; blank defaults to 1). Extra charges use the Creator Currency / Client Currency columns, and may be uploaded without a base content price."],["حقوق الاستخدام والترويج بأسعار شهرية × عدد الشهور. حضور الفعالية بسعر يومي × عدد أيام الفعالية (اليوم الواحد هو الافتراضي). تستخدم الرسوم الإضافية أعمدة عملة المبدع والعميل ويمكن رفعها دون سعر محتوى أساسي."]]);
  return book.xlsx.writeBuffer();
}
export type RateWorkbookRow={row:number;raw:Record<string,string>;unsupported:boolean;cells:Record<string,string>;unsupportedCells:{column:string;cell:string;value:string;kind:string}[]};
export async function readRateWorkbook(bytes:ArrayBuffer):Promise<RateWorkbookRow[]> {
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const sheet=book.getWorksheet("Packages")??book.getWorksheet("Rates")??book.worksheets[0];if(!sheet||sheet.rowCount>5001)throw new Error("file");
  const headers=sheet.getRow(1).values as unknown[];
  const required=headers.includes("Rate")?["Creator ID","Platform","Deliverable Type","Rate","Currency","Rate Type"]:["Creator ID","Platform","Deliverable Type","Creator Cost","Creator Currency","Client Selling Price","Client Currency"];
  const packageFile=headers.includes("Package Code");
  if(packageFile ? !["Profile URL 1","Package Name","Reels","Stories","Package Creator Cost","Creator Currency","Package Client Price","Client Currency"].every(h=>headers.includes(h)) : !(["Profile URL","Profile URL 1","Profile URL 2","Profile URL 3"].some(h=>headers.includes(h)) ? headers.includes("Deliverable Type") && ((headers.includes("Creator Cost") && headers.includes("Creator Currency")) || (headers.includes("Client Selling Price") && headers.includes("Client Currency"))) : required.every(h=>headers.includes(h))))throw new Error("file");
  if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error("file");
  const result:RateWorkbookRow[]=[];
  for(let n=2;n<=sheet.rowCount;n++) {
    const row=sheet.getRow(n);if(!row.hasValues)continue;
    let unsupported=false;const raw:Record<string,string>={},cells:Record<string,string>={};
    const unsupportedCells:RateWorkbookRow["unsupportedCells"]=[];
    headers.forEach((header,i)=>{if(header&&i)cells[String(header)]=sheet.getColumn(i).letter+n;});
    row.eachCell((c,i)=>{
      const column=String(headers[i]);
      if(["GP %","Margin / Markup %"].includes(column))return;
      if(["Profile URL","Profile URL 1","Profile URL 2","Profile URL 3","Instagram Handle","TikTok Handle","Other Platform Handle"].includes(column)&&typeof c.value==="object"&&c.value!==null&&"hyperlink" in c.value){raw[column]=c.value.hyperlink.trim();return;}
      if(typeof c.value==="object"&&c.value!==null){
        unsupported=true;
        const formula="formula" in c.value?c.value.formula:"sharedFormula" in c.value?c.value.sharedFormula:undefined;
        unsupportedCells.push({column,cell:c.address,value:formula?"="+formula:c.text,kind:formula?"formula":c.value instanceof Date?"date":"error" in c.value?"Excel error":"formatted value"});
        raw[column]="";
      }else raw[column]=c.text.trim();
    });
    if(unsupported||Object.values(raw).some(Boolean)){if(packageFile)raw["Package Code"]??="";result.push({row:n,raw,unsupported,cells,unsupportedCells});}
  }
  if(!result.length)throw new Error("file");return result;
}
