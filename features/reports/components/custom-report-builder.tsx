"use client";

import { useState, useTransition, type DragEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import { ReportExportActions } from "@/features/reports/components/report-export-actions";
import { Button } from "@/components/ui/button";
import { CUSTOM_COLUMNS, CUSTOM_CURRENCIES, type CustomColumn, type CustomReport } from "@/lib/reports/custom/custom-report";

export function CustomReportBuilder({ report }: { report: CustomReport }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<CustomColumn[]>([]);
  const [includeVat, setIncludeVat] = useState(false);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<CustomColumn | null>(null);
  const columns = [...selected, ...(includeVat ? ["vat" as const] : [])].map(key => CUSTOM_COLUMNS.find(c => c.key === key)!);
  const available = CUSTOM_COLUMNS.filter(c => c.key !== "vat" && !selected.includes(c.key) && c.label.toLowerCase().includes(search.toLowerCase()));
  const change = (next: CustomColumn[]) => { setSelected(next); };
  const move = (key: CustomColumn, target?: CustomColumn) => {
    const next = selected.filter(c => c !== key);
    const index = target ? next.indexOf(target) : next.length;
    next.splice(index < 0 ? next.length : index, 0, key);
    change(next);
  };
  const drop = (event: DragEvent, target?: CustomColumn, remove = false) => {
    event.preventDefault(); event.stopPropagation();
    if (dragging && dragging !== target) {
      if (remove) change(selected.filter(c => c !== dragging)); else move(dragging, target);
    }
    setDragging(null);
  };
  const control = "min-h-11 rounded-lg border border-input bg-background px-3 text-sm";
  return <div className="space-y-5" aria-busy={pending}>
    <div className="flex flex-wrap items-end gap-6 rounded-xl border bg-card p-5">
      <label className="grid gap-2 text-sm font-medium">Report currency
        <select className={control} value={report.currency} disabled={pending} onChange={e => {
          const next = new URLSearchParams(params.toString()); next.set("currency", e.target.value);
          startTransition(() => router.replace(`${pathname}?${next}`));
        }}>{CUSTOM_CURRENCIES.map(c => <option key={c} value={c}>{c === "Foreign" ? "Foreign (original currencies)" : c}</option>)}</select>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-primary" checked={includeVat} onChange={e => { setIncludeVat(e.target.checked); }} />Include VAT</label>
      <p className="max-w-xl text-sm text-muted-foreground">Amounts exclude VAT. Include VAT adds a separate column showing total client VAT, including accrued activity.</p>
    </div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <section aria-label="Available columns" className="min-w-0 rounded-xl border bg-card p-5" onDragOver={e => e.preventDefault()} onDrop={e => drop(e, undefined, true)}>
        <h2 className="font-semibold">Available data</h2><p className="mt-1 text-sm text-muted-foreground">Drag a field to your report or use the add button.</p>
        <label className="mt-4 grid gap-2 text-sm">Find a field<input className={control} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search columns" /></label>
        <ul className="mt-4 space-y-2">{available.map(c => <li key={c.key} draggable onDragStart={e => { setDragging(c.key); e.dataTransfer.setData("text/plain", c.key); }} onDragEnd={() => setDragging(null)} className="flex min-h-12 items-center gap-2 rounded-lg border bg-background px-3">
          <GripVertical aria-hidden className="size-4 shrink-0 text-muted-foreground" /><span className="flex-1 text-sm">{c.label}</span><Button variant="ghost" className="size-11 p-0" aria-label={`Add ${c.label}`} onClick={() => move(c.key)}><Plus aria-hidden /></Button>
        </li>)}</ul>
        {!available.length && <p className="py-6 text-sm text-muted-foreground">{search ? "No matching fields." : "All fields have been added."}</p>}
      </section>
      <section aria-label="Selected columns" className={`min-w-0 rounded-xl border-2 border-dashed bg-card p-5 ${dragging ? "border-primary" : "border-border"}`} onDragOver={e => e.preventDefault()} onDrop={e => drop(e)}>
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Your report <span className="text-muted-foreground">· {columns.length}</span></h2><Button variant="ghost" className="min-h-11" onClick={() => { change([]); setIncludeVat(false); }}>Clear all</Button></div>
        <p className="text-sm text-muted-foreground">Columns appear left to right in this order.</p>
        {!columns.length && <div className="flex min-h-52 items-center justify-center p-6 text-center text-sm text-muted-foreground">Drop fields here to start building your report.</div>}
        <ol className="mt-4 space-y-2">{selected.map((key, index) => {
          const c = CUSTOM_COLUMNS.find(c => c.key === key)!;
          return <li key={key} draggable onDragStart={e => { setDragging(key); e.dataTransfer.setData("text/plain", key); }} onDragEnd={() => setDragging(null)} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, key)} className="flex flex-wrap items-center gap-1 rounded-lg border bg-background pl-3 pr-1">
            <GripVertical aria-hidden className="size-4 text-muted-foreground" /><span className="min-w-24 flex-1 text-sm">{index + 1}. {c.label}</span>
            <div className="flex"><Button className="size-11 p-0" variant="ghost" disabled={index === 0} aria-label={`Move ${c.label} up`} onClick={() => move(key, selected[index - 1])}><ArrowUp aria-hidden /></Button>
            <Button className="size-11 p-0" variant="ghost" disabled={index === selected.length - 1} aria-label={`Move ${c.label} down`} onClick={() => { const next = [...selected]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; change(next); }}><ArrowDown aria-hidden /></Button>
            <Button className="size-11 p-0" variant="ghost" aria-label={`Remove ${c.label}`} onClick={() => change(selected.filter(c => c !== key))}><X aria-hidden /></Button></div>
          </li>;
        })}</ol>
        {includeVat && <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">{columns.length}. VAT <span className="text-muted-foreground">· Included by checkbox</span></div>}
      </section>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
      <div><p className="text-sm font-medium">Your formatted report</p><p role="status" className="text-sm text-muted-foreground">{columns.length ? `${columns.length} columns selected · Preview opens in a new tab` : "Choose at least one column to preview or export."}</p></div>
      <ReportExportActions apiPath="/api/reports/custom/document" statementActions disabled={!columns.length || pending} fixedParams={{ columns: columns.map(c => c.key).join(","), currency: report.currency, asOf: report.asOf, includeVat: includeVat ? "1" : "0" }} />
    </div>
  </div>;
}
