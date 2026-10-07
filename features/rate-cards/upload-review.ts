import type {ImportRow} from './model';

export function uploadReview(rows:ImportRow[]) {
  const creators=new Set<string>(), matched=new Set<string>(), pending=new Set<string>();
  const counts={ready:0,warning:0,error:0,unmatched:0};
  let lines=0;
  for(const row of rows){
    counts[row.status]++;
    if(row.rate){
      creators.add(row.rate.creator_ref);
      (row.pending_creator?pending:matched).add(row.rate.creator_ref);
    }
    if(row.status==='ready'||row.status==='warning')lines+=(row.rates??(row.rate?[row.rate]:[])).length;
  }
  return {rows:rows.length,creators:creators.size,matched:matched.size,pending:pending.size,lines,counts};
}

export function uploadBlocker(input:{busy:boolean;step:number;hasFile:boolean;hasRows:boolean;errors:number;unmatched:number;conflicts:boolean;stale:boolean;mode:'new'|'update';name:string}) {
  if(input.busy)return 'whyRun';
  if(input.step===1)return input.hasFile?null:'whyFile';
  if(input.stale)return 'staleT';
  if(!input.hasRows)return 'whyFile';
  if(input.conflicts||input.unmatched)return 'whyUnm';
  if(input.errors)return 'whyErr';
  if(input.step===3&&input.mode==='new'&&!input.name.trim())return 'whyName';
  return null;
}
