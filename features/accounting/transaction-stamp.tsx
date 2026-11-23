// Inherits AccountingConsole's client boundary.
import {useEffect,useState} from 'react';
type Stamp={createdBy:string|null;createdAt:string;updatedBy:string|null;updatedAt:string|null;postedBy:string|null;postedAt:string|null};
const timestamp=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(value)):'—';
export function TransactionStamp({company,journal,version}:{company:string;journal?:string|null;version?:number|null}){
 const [stamp,setStamp]=useState<Stamp|null>(null),[error,setError]=useState('');
 useEffect(()=>{setStamp(null);setError('');if(!journal)return;const a=new AbortController();void fetch('/api/accounting/journals?'+new URLSearchParams({mode:'stamp',company,id:journal}),{signal:a.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(!a.signal.aborted)setStamp(d);}).catch(e=>{if(!a.signal.aborted)setError(e.message);});return()=>a.abort();},[company,journal,version]);
 if(!journal)return null;
 return <footer aria-label="Transaction audit details" style={{display:'flex',flexWrap:'wrap',gap:'6px 24px',padding:'8px 0',borderTop:'1px solid #dce3e9',fontSize:11}}>{error?<span role="alert">Audit details unavailable: {error}</span>:stamp?<><span>Created by <strong>{stamp.createdBy||'Not recorded'}</strong> · {timestamp(stamp.createdAt)}</span><span>Last modified by <strong>{stamp.updatedBy||'Not recorded'}</strong> · {timestamp(stamp.updatedAt)}</span><span>Posted by <strong>{stamp.postedBy||'Not posted'}</strong> · {timestamp(stamp.postedAt)}</span><span>Time zone: Cairo</span></>:<span>Loading audit details…</span>}</footer>;
}
