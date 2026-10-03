import {normalizeRatePlatform} from "./platforms";
import {isSocialPlatform} from "@/lib/social/platforms";
import {parseProfileInput} from "@/lib/social/parse-profile-url";
export function rateImportIdentity(raw:Record<string,string>){
  const url=raw["Profile URL"]?.trim();
  if(url){
    const parsed=parseProfileInput(url);
    const selected=normalizeRatePlatform(raw.Platform??"");
    const valid=parsed&&(!selected||selected==="all"||selected===parsed.platform);
    return {id:"",platform:parsed?.platform??selected,handle:valid?parsed.normalized_username:"",key:valid?parsed.platform+":"+parsed.normalized_username:"invalid-url:"+url,profile_url:valid?parsed.profile_url:undefined};
  }
  const id=(raw["Creator ID"]??"").trim().toLowerCase(),platform=raw.Platform?.trim().toLowerCase();
  const value=(platform==="instagram"?raw["Instagram Handle"]:platform==="tiktok"?raw["TikTok Handle"]:raw["Other Platform Handle"])?.trim()??"";
  const parsed=isSocialPlatform(platform)?parseProfileInput(value,platform):null;
  const valid=!!parsed&&!/[\s<>]/.test(value)&&parsed.platform===platform&&(/^[\p{L}\p{N}._-]+$/u.test(parsed.normalized_username)||platform==="facebook"&&/^id:\d+$/.test(parsed.normalized_username));
  const handle=valid?parsed!.normalized_username:"";
  return {id,platform,handle,key:id||platform+":"+handle};
}
