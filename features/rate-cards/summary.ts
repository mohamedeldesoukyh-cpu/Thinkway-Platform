import {normalizeRatePlatform} from "./platforms";
export type SummaryLine={creator_ref:string;platform:string;package_details:{profiles:{platform:string}[]}|null};
export type RateCardSummary={creators:number;accounts:number;platforms:Record<string,number>};
export function summarizeRateCard(lines:SummaryLine[],linked:Record<string,string[]>={}):RateCardSummary{
 const creators=new Map<string,Set<string>>();
 for(const line of lines){
  const platforms=creators.get(line.creator_ref)??new Set<string>();
  const scope=line.package_details?.profiles.map(p=>p.platform)??(line.platform==="all"?linked[line.creator_ref]??[]:[line.platform]);
  for(const value of scope){const platform=normalizeRatePlatform(value);if(platform&&platform!=="all")platforms.add(platform);}
  creators.set(line.creator_ref,platforms);
 }
 const counts:Record<string,number>={};
 for(const platforms of creators.values())for(const platform of platforms)counts[platform]=(counts[platform]??0)+1;
 return {creators:creators.size,accounts:Object.values(counts).reduce((sum,n)=>sum+n,0),platforms:counts};
}
