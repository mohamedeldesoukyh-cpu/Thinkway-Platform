import type {RateLine} from "./model";
export function rateServiceRows(lines:RateLine[]) {
  const groups=new Map<string,{key:string;line:RateLine;cost?:RateLine;client?:RateLine;ids:string[]}>();
  for(const line of lines){
    const key=JSON.stringify([line.creator_ref,line.platform,line.deliverable]);
    let group=groups.get(key);
    if(!group){group={key,line,ids:[]};groups.set(key,group);}
    group.ids.push(line.id);
    if(line.price_type==="creator_cost")group.cost=line;else group.client=line;
  }
  return [...groups.values()];
}
