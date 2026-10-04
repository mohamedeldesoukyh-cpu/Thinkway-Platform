import {z} from "zod";
import {rateImportProfiles} from "./import-profiles";
import {parseProfileInput} from "@/lib/social/parse-profile-url";

export const packageDetailsSchema=z.object({
 name:z.string().trim().min(1).max(200),
 reels:z.number().int().min(0).max(1000),
 stories:z.number().int().min(0).max(1000),
 profiles:z.array(z.object({platform:z.string().min(1),profile_url:z.string().url()})).min(1).max(3),
}).refine(p=>p.reels+p.stories>0 && (p.stories===0||p.profiles.some(x=>["instagram","facebook"].includes(x.platform)))
 && new Set(p.profiles.map(x=>x.platform)).size===p.profiles.length
 && p.profiles.every(x=>parseProfileInput(x.profile_url)?.platform===x.platform));
export type PackageDetails=z.infer<typeof packageDetailsSchema>;
export function parsePackageRow(raw:Record<string,string>){
 const key=raw["Package Code"]?.trim().toLowerCase();
 if(!key||!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(key))throw new Error("invalid");
 const count=(value:string|undefined)=>!value?.trim()?0:/^\d+$/.test(value.trim())?Number(value):NaN;
 const profiles=rateImportProfiles(raw).map(({platform,profile_url})=>({platform,profile_url}));
 if(new Set(profiles.map(p=>p.platform)).size!==profiles.length)throw new Error("invalid");
 const details=packageDetailsSchema.parse({name:raw["Package Name"],reels:count(raw.Reels),stories:count(raw.Stories),profiles});
 return {key,details};
}
export function packageDescription(p:PackageDetails,lang="en"){
 const ar=lang==="ar",parts:string[]=[];
 if(p.reels)parts.push(ar?`${p.reels} ريل${p.profiles.length>1?" · يُنشر على جميع المنصات المرفقة":""}`:`${p.reels} reel${p.reels===1?"":"s"}${p.profiles.length>1?" · mirrored to all linked platforms":""}`);
 if(p.stories)parts.push(ar?`${p.stories} ستوري`:`${p.stories} ${p.stories===1?"story":"stories"}`);
 return parts.join(" + ");
}
export function packageStoryPlatforms(p:PackageDetails){return p.profiles.filter(x=>["instagram","facebook"].includes(x.platform)).map(x=>x.platform);}
