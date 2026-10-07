import {z} from "zod";
import {packageDetailsSchema} from "./packages";
import {rateDeliverables} from "./platforms";
import type {RateLine} from "./model";
import {rateTemplateRows} from "./template-rows";

export const offerEditSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("creator"),creatorRef:z.string().regex(/^(inf|dis):[0-9a-f-]{36}$/i)}),
 z.object({kind:z.literal("package"),details:packageDetailsSchema}),
 z.object({kind:z.literal("deliverable"),deliverable:z.string().min(1)}),
]);
export type OfferEditInput=z.infer<typeof offerEditSchema>;
export function offerScope(lines:RateLine[],anchorId:string){
 const row=rateTemplateRows(lines).find(row=>row.ids.includes(anchorId));
 if(!row)throw new Error("stale");
 return row;
}
export function deliverableEdit(lines:RateLine[],anchorId:string,deliverable:string){
 const row=offerScope(lines,anchorId);
 if(row.line.package_key||!row.type||!rateDeliverables(row.line.platform).some(d=>d.value===deliverable))throw new Error("invalid");
 return {ids:[row.base.cost?.id,row.base.client?.id].filter((id):id is string=>!!id),patch:{deliverable}};
}
