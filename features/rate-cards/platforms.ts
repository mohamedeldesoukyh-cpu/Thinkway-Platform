import {DELIVERABLE_TYPES_BY_PLATFORM} from "@/lib/campaigns/deliverable-taxonomy";
import {SOCIAL_PLATFORM_OPTIONS} from "@/lib/master-data/constants";

export const RATE_PLATFORM_OPTIONS=[{value:"all",label:"All Platforms"},...SOCIAL_PLATFORM_OPTIONS];
export function normalizeRatePlatform(value:string){
 const key=value.trim().toLowerCase().replace(/[ _-]+/g,"_");
 return ["all","all_platform","all_platforms"].includes(key)?"all":key;
}
export const ALL_PLATFORM_TYPES=["post","reel","video","story","live"].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}));
export function rateDeliverables(platform:string){
 return platform==="all"?[...ALL_PLATFORM_TYPES,...new Map(Object.values(DELIVERABLE_TYPES_BY_PLATFORM).flat().map(t=>[t.value,t])).values()]:DELIVERABLE_TYPES_BY_PLATFORM[platform]??[];
}
export function genericRateDeliverable(type:string){
 return type.replace(/^(instagram|tiktok|facebook|youtube|snapchat)_/,"");
}
