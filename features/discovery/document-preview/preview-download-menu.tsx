"use client";
import { DownloadIcon, FileCodeIcon, FileSpreadsheetIcon, FileTextIcon, PresentationIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function PreviewDownloadMenu({formats}: {formats: Array<{format:string;label:string;href:string}>}) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="outline" aria-label="Download report" title="Download report"><DownloadIcon className="size-4"/></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end"><DropdownMenuLabel>Download as</DropdownMenuLabel>{formats.map(({format,label,href}) => {const Icon = format === "html" ? FileCodeIcon : format === "pptx" ? PresentationIcon : format === "excel" || format === "csv" ? FileSpreadsheetIcon : FileTextIcon; return <DropdownMenuItem key={format} asChild><a href={href} download><Icon className="size-4"/>{label}</a></DropdownMenuItem>;})}</DropdownMenuContent>
  </DropdownMenu>;
}
