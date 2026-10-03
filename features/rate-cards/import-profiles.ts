import {parseProfileInput} from "@/lib/social/parse-profile-url";
import {isSocialPlatform} from "@/lib/social/platforms";

/** All links in one row are the user's explicit declaration of one creator. */
export function rateImportProfiles(raw:Record<string,string>){
 const profiles=new Map<string,NonNullable<ReturnType<typeof parseProfileInput>>>();
 for(const [column,hint] of [["Profile URL",undefined],["Instagram Handle","instagram"],["TikTok Handle","tiktok"],["Other Platform Handle",undefined]] as const){
  const value=raw[column]?.trim();if(!value)continue;
  for(const part of value.split(/[\n;,]+/).map(v=>v.trim()).filter(Boolean)){
   const fallback=column==="Other Platform Handle"&&isSocialPlatform(raw.Platform)?raw.Platform:hint;
   const parsed=parseProfileInput(part,fallback);
   if(!parsed||(hint&&parsed.platform!==hint))throw new Error("invalid");
   profiles.set(parsed.platform+":"+parsed.normalized_username,parsed);
  }
 }
 return [...profiles.values()];
}
