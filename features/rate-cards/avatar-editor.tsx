"use client";
import {useEffect,useState,useTransition} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {saveRateAvatar} from "./actions";
import {errorLabel} from "./labels";
import {Field,Modal,TextField,useRateLanguage} from "./ui";

export function AvatarEditor({versionId,creatorRef,name,current,hasOverride,onClose,onSaved}:{versionId:string;creatorRef:string;name:string;current?:string;hasOverride:boolean;onClose:()=>void;onSaved:()=>void}) {
  const {lang,t}=useRateLanguage();
  const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(""),[preview,setPreview]=useState(current??"");
  const [busy,start]=useTransition();
  useEffect(()=>()=>{if(preview.startsWith("blob:"))URL.revokeObjectURL(preview);},[preview]);
  function save(reset=false){start(async()=>{try{const form=new FormData();if(reset)form.set("reset","true");else if(file)form.set("file",file);else form.set("url",url);await saveRateAvatar(versionId,creatorRef,form);toast.success(t("saved"));onSaved();}catch(e){toast.error(t(errorLabel(e)));}});}
  return <Modal open size="form" onClose={()=>!busy&&onClose()} title={`${t("avatar")} · ${name}`} description={t("avatarScope")} lang={lang}>
    <div className="rc-avatar-preview">{preview?<img src={preview} alt={name}/>:<span>{name.slice(0,2)}</span>}</div>
    <Field label={t("avatarBrowse")}><Input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy} onChange={e=>{const selected=e.target.files?.[0]??null;if(selected&&selected.size>750000){toast.error(t("avatarInvalid"));e.target.value="";return;}setFile(selected);setPreview(selected?URL.createObjectURL(selected):current??"");if(selected)setUrl("");}}/></Field>
    <TextField label={t("avatarUrl")} type="url" value={url} disabled={busy} onChange={v=>{setUrl(v);setFile(null);setPreview(current??"");}}/>
    <p className="text-sm text-muted-foreground">{t("avatarHelp")}</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy||(!file&&!url.trim())} onClick={()=>save()}>{t(busy?"busy":"save")}</Button>{hasOverride&&<Button variant="outline" disabled={busy} onClick={()=>save(true)}>{t("avatarReset")}</Button>}</div>
  </Modal>;
}
