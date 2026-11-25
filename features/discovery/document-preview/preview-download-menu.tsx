"use client";
import { DownloadIcon, FileCodeIcon, FileSpreadsheetIcon, FileTextIcon, PresentationIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { downloadReport } from "./download-report";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function PreviewDownloadMenu({formats}: {formats: Array<{format:string;label:string;href:string}>}) {
  const [pending, setPending] = useState(false);
  const downloading = useRef(false);
  async function download(href: string, format: string) {
    if (downloading.current) return;
    downloading.current = true;
    setPending(true);
    try { await downloadReport(href, format); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not download the report. Please try again."); }
    finally { downloading.current = false; setPending(false); }
  }
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="outline" disabled={pending} aria-busy={pending} aria-label={pending ? "Preparing download" : "Download report"} title={pending ? "Preparing download…" : "Download report"}><DownloadIcon className={pending ? "size-4 animate-pulse" : "size-4"}/></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end"><DropdownMenuLabel>Download as</DropdownMenuLabel>{formats.map(({format,label,href}) => {const Icon = format === "html" ? FileCodeIcon : format === "pptx" ? PresentationIcon : format === "excel" || format === "csv" ? FileSpreadsheetIcon : FileTextIcon; return <DropdownMenuItem key={format} disabled={pending} onSelect={() => { void download(href, format); }}><Icon className="size-4"/>{label}</DropdownMenuItem>;})}</DropdownMenuContent>
  </DropdownMenu>;
}
