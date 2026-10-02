"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Choice,useRateLanguage} from "./ui";
export function ReportControls({versionId}:{versionId:string}){
  const {lang,t}=useRateLanguage();const [template,setTemplate]=useState("creator-list");
  const url=(format:string,download=false)=>`/api/rate-cards/${versionId}/export?template=${template}&lang=${lang}&format=${format}&download=${download?1:0}`;
  return <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{t("reports")}</h3><p className="text-sm text-muted-foreground">{t("reportHelp")}</p><Choice label={t("reportTemplate")} value={template} empty={false} options={[{value:"creator-list",label:t("creatorList")},{value:"creator-list-details",label:t("creatorListDetails")}]} onChange={setTemplate}/><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href={url("html")} target="_blank" rel="noopener noreferrer">{t("preview")}</a></Button>{["html","pdf","pptx"].map(format=><Button variant="outline" key={format} asChild><a href={url(format,true)} target="_blank" rel="noopener noreferrer">{t("download")} {format.toUpperCase()}</a></Button>)}</div></section>;
}
