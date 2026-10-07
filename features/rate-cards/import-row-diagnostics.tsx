import type {ImportDiagnostic} from "./import-diagnostics";
import * as React from "react";

export function ImportRowDiagnostics({diagnostics,lang}:{diagnostics:ImportDiagnostic[];lang:string}){
 return <ul className="min-w-64 max-w-md space-y-2 break-words text-sm">
  {diagnostics.map((d,i)=><li key={i}>
   <strong>{d.cell?`${d.cell} · `:""}{d.column}</strong>
   <span className="block">{d.value?`“${d.value}”`:lang==="ar"?"(فارغ)":"(blank)"} — {lang==="ar"?d.message_ar:d.message}</span>
  </li>)}
 </ul>;
}
