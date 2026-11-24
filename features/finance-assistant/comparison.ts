import { cents, decimal } from "@/features/accounting/journal-model";
import type { FinanceEvidence } from "./contracts";

/** Currency and account identity, never row position, determine comparisons. */
export function compareProfitReports(current: FinanceEvidence, previous: FinanceEvidence) {
  const currencies = new Set([...(current.tables ?? []).map(t=>t.heading), ...(previous.tables ?? []).map(t=>t.heading)]);
  return [...currencies].map(heading=>{
    const a=current.tables?.find(t=>t.heading===heading)?.rows??[];
    const b=previous.tables?.find(t=>t.heading===heading)?.rows??[];
    const key=(r:string[])=>JSON.stringify(r.slice(0,3));
    const entries=new Map([...b,...a].map(r=>[key(r),r]));
    return {heading,columns:["Code","Name","Classification","Current","Comparison","Change","Change %"],rows:[...entries].map(([id,row])=>{
      const value=(rows:string[][])=>cents((rows.find(r=>key(r)===id)?.[3]??"0").replaceAll(",",""));
      const now=value(a),before=value(b),change=now-before;
      // Negative and zero bases make the ordinary growth percentage misleading.
      const percent=before>BigInt(0)?decimal((change*BigInt(10000))/before)+"%":"N/A";
      return [...row.slice(0,3),decimal(now),decimal(before),decimal(change),percent];
    })};
  });
}
