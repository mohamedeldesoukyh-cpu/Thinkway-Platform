import { useState, type InputHTMLAttributes } from 'react';
import { money } from './journal-model';
export function formatAmount(value:string){try{return money(value||'0');}catch{return value;}}
export function AmountValue({value}:{value:string}){const formatted=formatAmount(value);return <span style={{display:'inline-block',minWidth:Math.max(14,formatted.length+2)+'ch',whiteSpace:'nowrap',textAlign:'right',fontVariantNumeric:'tabular-nums',...(value.startsWith('-')?{color:'#b42318'}:{})}}>{formatted}</span>;}
export function AmountInput({value,onChange,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:string;onChange:(value:string)=>void}){
 const [focused,setFocused]=useState(false);
 return <input {...props} inputMode="decimal" value={focused?value:formatAmount(value)} style={{minWidth:Math.max(14,formatAmount(value).length+3)+'ch',textAlign:'right',fontVariantNumeric:'tabular-nums',...props.style,...(value.startsWith('-')?{color:'#b42318'}:{})}} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onBlur={e=>{setFocused(false);props.onBlur?.(e);}} onChange={e=>onChange(e.target.value.replaceAll(',',''))}/>;
}
