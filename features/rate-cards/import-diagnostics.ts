import {parseProfileInput} from "@/lib/social/parse-profile-url";
import {isSocialPlatform} from "@/lib/social/platforms";
import {rateImportProfiles} from "./import-profiles";

export type ImportDiagnostic={column:string;value:string;message:string;message_ar:string;cell?:string;severity?:"warning"};
export function importDiagnostic(column:string,value:string|undefined,message:string,message_ar:string):ImportDiagnostic {
 return {column,value:value??"",message,message_ar};
}
/** Decimal arithmetic avoids binary rounding errors such as 1.00005 -> 1.0000. */
export function normalizeImportDecimal(column:string,value:string|undefined){
 const raw=value?.trim()??"";
 let decimal=raw;
 const scientific=/^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(raw);
 if(scientific&&Number.isFinite(Number(raw))&&Number(raw)<=999999999999){
  if(Number(raw)<0.00005)decimal="0.00000";
  else {const digits=scientific[1]+(scientific[2]??""),point=scientific[1].length+Number(scientific[3]);
   decimal=point<=0?"0."+"0".repeat(-point)+digits:point>=digits.length?digits+"0".repeat(point-digits.length):digits.slice(0,point)+"."+digits.slice(point);
   if(!decimal.includes("."))decimal+=".00000";else decimal=decimal.slice(0,decimal.indexOf(".")+1)+decimal.slice(decimal.indexOf(".")+1).padEnd(5,"0");
  }
 }
 const match=/^(\d+)\.(\d{5,})$/.exec(decimal);
 if(!match||!Number.isFinite(Number(raw))||Number(raw)>999999999999)return {value:raw};
 const scale=BigInt(10000);
 const scaled=BigInt(match[1])*scale+BigInt(match[2].slice(0,4))+BigInt(match[2][4]>="5"?1:0);
 const fraction=(scaled%scale).toString().padStart(4,"0").replace(/0+$/,"");
 const rounded=(scaled/scale).toString()+(fraction?"."+fraction:"");
 return {value:rounded,diagnostic:{...importDiagnostic(column,raw,
  `Automatically rounded to ${rounded} (nearest 4 decimal places). This value will be imported; no correction is needed.`,
  `تم التقريب تلقائياً إلى ${rounded} (أقرب ٤ منازل عشرية). ستُستورد هذه القيمة ولا يلزم تصحيحها.`),severity:"warning" as const}};
}
export function numericImportDiagnostic(column:string,value:string|undefined,max:number):ImportDiagnostic {
 const raw=value?.trim()??"",number=Number(raw);
 if(!raw)return importDiagnostic(column,raw,"A value is required. Enter a number (zero is allowed).","القيمة مطلوبة. أدخل رقماً (الصفر مسموح).");
 if(Number.isFinite(number)&&number<0)return importDiagnostic(column,raw,"Negative values are not allowed. Enter zero or a positive number.","القيم السالبة غير مسموحة. أدخل صفراً أو رقماً موجباً.");
 if(Number.isFinite(number)&&number>max)return importDiagnostic(column,raw,`The value exceeds the maximum ${max}. Enter a smaller value.`,`القيمة تتجاوز الحد الأقصى ${max}. أدخل قيمة أصغر.`);
 if(/^\d+\.\d{5,}$/.test(raw)){
  const suggested=String(Number(number.toFixed(4)));
  return importDiagnostic(column,raw,`Too many decimal places. Use at most 4 decimal places; for example, ${suggested}.`,`عدد المنازل العشرية أكبر من المسموح. استخدم ٤ منازل كحد أقصى، مثلاً ${suggested}.`);
 }
 return importDiagnostic(column,raw,"Enter a number with at most 4 decimal places, without commas, currency symbols, percent signs or formulas.","أدخل رقماً بحد أقصى ٤ منازل عشرية، دون فواصل آلاف أو رموز عملة أو علامة نسبة مئوية أو صيغ.");
}
export function profileImportDiagnostics(raw:Record<string,string>):ImportDiagnostic[]{
 const result:ImportDiagnostic[]=[];
 for(const [column,hint] of [["Profile URL 1",undefined],["Profile URL 2",undefined],["Profile URL 3",undefined],["Profile URL",undefined],["Instagram Handle","instagram"],["TikTok Handle","tiktok"],["Other Platform Handle",undefined]] as const){
  for(const value of (raw[column]??"").split(/[\n;,]+/).map(v=>v.trim()).filter(Boolean)){
   const fallback=column==="Other Platform Handle"&&isSocialPlatform(raw.Platform)?raw.Platform:hint;
   const parsed=parseProfileInput(value,fallback);
   if(!parsed||(hint&&parsed.platform!==hint))result.push(importDiagnostic(column,value,
    hint?`Enter a valid ${hint} profile link or handle.`:"This is not a supported creator profile link. Paste the full social profile URL.",
    hint?`أدخل رابط حساب أو اسم مستخدم صالحاً لمنصة ${hint}.`:"هذا ليس رابط حساب مبدع مدعوماً. الصق الرابط الكامل للحساب الاجتماعي."));
  }
 }
 return result;
}
export function packageImportDiagnostics(raw:Record<string,string>):ImportDiagnostic[]{
 const result=profileImportDiagnostics(raw),code=raw["Package Code"]?.trim().toLowerCase(),name=raw["Package Name"]?.trim();
 if(!code||!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(code))result.push(importDiagnostic("Package Code",raw["Package Code"],"Enter 1–50 letters or digits, with only hyphens or underscores; start with a letter or digit.","أدخل من ١ إلى ٥٠ حرفاً إنجليزياً أو رقماً، مع شرطة أو شرطة سفلية فقط، وابدأ بحرف أو رقم."));
 if(!name||name.length>200)result.push(importDiagnostic("Package Name",raw["Package Name"],"Enter a package name between 1 and 200 characters.","أدخل اسم باقة من حرف واحد إلى ٢٠٠ حرف."));
 for(const column of ["Reels","Stories"]){const value=raw[column]?.trim()??"";
  if(value&&(!/^\d+$/.test(value)||Number(value)>1000))result.push(importDiagnostic(column,value,"Enter a whole number from 0 to 1000; fractions and negative quantities are not allowed.","أدخل عدداً صحيحاً من ٠ إلى ١٠٠٠؛ الكسور والكميات السالبة غير مسموحة."));
 }
 if(Number(raw.Reels||0)===0&&Number(raw.Stories||0)===0)result.push(importDiagnostic("Reels / Stories",`${raw.Reels||0} / ${raw.Stories||0}`,"Both quantities are zero. Enter at least one Reel or Story.","الكميتان صفر. أدخل ريل أو ستوري واحداً على الأقل."));
 try{
  const profiles=rateImportProfiles(raw);
  if(!profiles.length)result.push(importDiagnostic("Profile URL 1",raw["Profile URL 1"],"Add at least one creator profile link to define the package platforms.","أضف رابط حساب مبدع واحداً على الأقل لتحديد منصات الباقة."));
  if(profiles.length>3||new Set(profiles.map(p=>p.platform)).size!==profiles.length)result.push(importDiagnostic("Profile URL 1 / 2 / 3",profiles.map(p=>p.profile_url).join("; "),"Use at most three profiles, with only one account per platform in a package.","استخدم ثلاثة حسابات كحد أقصى، وحساباً واحداً فقط لكل منصة في الباقة."));
  if(Number(raw.Stories)>0&&!profiles.some(p=>["instagram","facebook"].includes(p.platform)))result.push(importDiagnostic("Stories",raw.Stories,"Stories require an Instagram or Facebook profile. Add that link or set Stories to 0.","الستوري يتطلب حساب إنستغرام أو فيسبوك. أضف الرابط أو اجعل كمية الستوري ٠."));
 }catch{/* Invalid links already identify their source columns above. */}
 return result;
}
export function uniqueImportDiagnostics(items:ImportDiagnostic[]):ImportDiagnostic[]{
 return [...new Map(items.map(d=>[JSON.stringify([d.column,d.value,d.message]),d])).values()];
}
