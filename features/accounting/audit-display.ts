export const auditDate=(value:string)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(value));
export const auditLabel=(value:string)=>value.replace(/^tw_accounting_/,'').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export function auditChanges(before:unknown,after:unknown){
 const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
 const b=record(before),a=record(after);
 return [...new Set([...Object.keys(b),...Object.keys(a)])].filter(k=>!['id','company_id','version','updated_at'].includes(k)&&JSON.stringify(b[k])!==JSON.stringify(a[k])).map(k=>({field:auditLabel(k),before:b[k],after:a[k]}));
}
export function auditValue(value:unknown){return value==null?'—':typeof value==='object'?JSON.stringify(value):typeof value==='boolean'?value?'Yes':'No':String(value);}
