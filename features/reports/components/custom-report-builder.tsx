"use client";

import { useEffect, useRef, useState, useTransition, type DragEvent, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Download, ExternalLink, FileSpreadsheet, FileText, GripVertical, Plus, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { SavedCustomReports } from "./saved-custom-reports";
import { savedCustomReportUrl } from "@/lib/reports/custom/saved-custom-reports";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CUSTOM_COLUMNS, CUSTOM_CURRENCIES, type CustomColumn, type CustomReport } from "@/lib/reports/custom/custom-report";
import { FIELD_DESCRIPTIONS, FIELD_GROUPS } from "./custom-report-fields";
import "./custom-report-builder.css";

const filterKeys = ["clientId", "brandId", "campaignId", "creatorId"] as const;
type FilterKey = typeof filterKeys[number];
const labels = { clientId: "Client", brandId: "Brand", campaignId: "Campaign", creatorId: "Vendor / Creator" };
const plural = { clientId: "clients", brandId: "brands", campaignId: "campaigns", creatorId: "vendors / creators" };
const column = (key: CustomColumn) => CUSTOM_COLUMNS.find(c => c.key === key)!;

function FieldTag({ field }: { field: CustomColumn }) {
  const text = field.startsWith("accrued") ? "Acc." : field.startsWith("total") ? "Total" : field === "creator" ? "Row per creator" : field === "revenueShare" ? "Share" : "";
  return text ? <span className={`cr-tag ${field.startsWith("accrued") ? "accrued" : field.startsWith("total") ? "total" : "creator"}`}>{text}</span> : null;
}

export function CustomReportBuilder({ report }: { report: CustomReport }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [browse, setBrowse] = useState<FilterKey | null>(null), [browseSearch, setBrowseSearch] = useState("");
  const [activeOption, setActiveOption] = useState(0);
  const [filterDrafts, setFilterDrafts] = useState<Partial<Record<FilterKey, string>>>({});
  const [selected, setSelected] = useState<CustomColumn[]>(() => {
    const saved = params.get("columns")?.split(",").filter((key): key is CustomColumn => key !== "vat" && CUSTOM_COLUMNS.some(c => c.key === key));
    return saved?.length ? [...new Set(saved)] : ["campaignNumber"];
  });
  const [includeVat, setIncludeVat] = useState(params.get("includeVat") === "1");
  const [search, setSearch] = useState("");
  const [viewZoom, setViewZoom] = useState(85);
  const [dragging, setDragging] = useState<CustomColumn | null>(null), [dropTarget, setDropTarget] = useState<CustomColumn | null>(null);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{ selected: CustomColumn[]; vat: boolean } | null>(null);
  const clientTrigger = useRef<HTMLButtonElement>(null), selectedList = useRef<HTMLOListElement>(null), availableList = useRef<HTMLDivElement>(null), downloadMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "F2" && !pending && !document.querySelector('[role="dialog"]')) { event.preventDefault(); const focused = document.activeElement?.closest<HTMLButtonElement>("button[data-record-browser]"); (focused || clientTrigger.current)?.click(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [pending]);
  useEffect(() => {
    const close = (event: Event) => { if (downloadMenu.current && !downloadMenu.current.contains(event.target as Node)) downloadMenu.current.open = false; };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, []);
  const navigate = (next: URLSearchParams) => startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key === "clientId") { next.delete("brandId"); next.delete("campaignId"); }
    if (key === "brandId") next.delete("campaignId");
    navigate(next);
  };
  const clearFilters = () => { const next = new URLSearchParams(params.toString()); [...filterKeys, "recordCurrency"].forEach(key => next.delete(key)); navigate(next); };
  const columns = [...selected, ...(includeVat ? ["vat" as const] : [])];
  const available = CUSTOM_COLUMNS.filter(c => c.key !== "vat" && !selected.includes(c.key) && `${c.label} ${FIELD_DESCRIPTIONS[c.key]}`.toLowerCase().includes(search.toLowerCase()));
  const move = (key: CustomColumn, target?: CustomColumn) => {
    const next = selected.filter(c => c !== key), index = target ? next.indexOf(target) : next.length;
    next.splice(index < 0 ? next.length : index, 0, key); setSelected(next);
    setNotice(`${column(key).label} moved to position ${next.indexOf(key) + 1} of ${next.length}.`);
  };
  const add = (key: CustomColumn) => { move(key); requestAnimationFrame(() => availableList.current?.querySelector<HTMLButtonElement>("button")?.focus()); };
  const reorder = (key: CustomColumn, delta: number) => {
    const index = selected.indexOf(key), target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected]; [next[index], next[target]] = [next[target], next[index]]; setSelected(next);
    setNotice(`${column(key).label} moved to position ${target + 1} of ${next.length}.`);
    requestAnimationFrame(() => selectedList.current?.querySelector<HTMLButtonElement>(`[data-field="${key}"] button:not(:disabled)`)?.focus());
  };
  const remove = (key: CustomColumn) => { const index = selected.indexOf(key); setSelected(selected.filter(c => c !== key)); setNotice(`${column(key).label} removed.`); requestAnimationFrame(() => { const rows = selectedList.current?.querySelectorAll<HTMLLIElement>("li"); rows?.[Math.min(index, rows.length - 1)]?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); }); };
  const drop = (event: DragEvent, target?: CustomColumn, removeField = false) => {
    event.preventDefault(); event.stopPropagation();
    if (dragging && dragging !== target) { if (removeField) remove(dragging); else move(dragging, target); }
    setDragging(null); setDropTarget(null);
  };
  const dragStart = (event: DragEvent, key: CustomColumn) => { setDragging(key); event.dataTransfer.setData("text/plain", key); event.dataTransfer.effectAllowed = "move"; };
  const finishDrag = () => { setDragging(null); setDropTarget(null); };
  const exportUrl = (format: "html" | "pdf" | "xlsx") => {
    const next = new URLSearchParams(params.toString());
    Object.entries({ columns: columns.join(","), currency: report.currency, asOf: report.asOf, includeVat: includeVat ? "1" : "0", format }).forEach(([key, value]) => next.set(key, value));
    if (format !== "html") next.set("download", "1"); else next.delete("download");
    return `/api/reports/custom/document?${next}`;
  };
  const disabled = !columns.length || pending;
  const previewHref = exportUrl("html");
  useEffect(() => {
    const preview = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (!disabled && !document.querySelector('[role="dialog"]')) window.open(previewHref, "_blank", "noopener,noreferrer");
      }
    };
    window.addEventListener("keydown", preview);
    return () => window.removeEventListener("keydown", preview);
  }, [disabled, previewHref]);
  const exportLink = (format: "html" | "pdf" | "xlsx", mobile = false) => {
    const title = format === "html" ? "Preview report" : format === "pdf" ? "Download PDF" : "Excel";
    const icon = format === "html" ? <ExternalLink /> : format === "pdf" ? <FileText /> : <FileSpreadsheet />;
    const cls = `cr-button ${format === "html" ? "primary" : ""} ${mobile ? "" : format !== "html" ? "cr-desktop-export" : ""}`;
    return disabled ? <button className={cls} disabled title={pending ? "Updating report options…" : "Choose at least one column."}>{icon}{title}</button> : <a className={cls} title={format === "html" ? "Preview report (Ctrl+P)" : title} aria-keyshortcuts={format === "html" ? "Control+P Meta+P" : undefined} href={exportUrl(format)} target="_blank" rel="noopener noreferrer" onClick={() => { if (downloadMenu.current) downloadMenu.current.open = false; }}>{icon}{title}</a>;
  };
  const hasFilters = [...filterKeys, "recordCurrency"].some(key => params.get(key));
  return <div className="cr-builder" aria-busy={pending} style={{ "--cr-scale": viewZoom / 100 } as CSSProperties}>
    <SavedCustomReports compact viewControls={<label className="cr-view-zoom">View <select aria-label="Builder zoom" value={viewZoom} onChange={e => setViewZoom(Number(e.target.value))}>{[75, 85, 100].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>} pending={pending} selection={{ columns: selected, currency: report.currency, includeVat, filters: Object.fromEntries([...filterKeys, "recordCurrency"].flatMap(key => params.get(key) ? [[key, params.get(key)!]] : [])) }} onLoad={saved => { setSelected(saved.columns as CustomColumn[]); setIncludeVat(saved.includeVat); setSearch(""); startTransition(() => router.replace(savedCustomReportUrl(saved), { scroll: false })); }} renderActions={saveButton => <footer className="cr-actionbar" aria-label="Report actions">
      <div className="cr-action-summary"><strong>Your formatted report</strong><span>{pending ? "Updating options…" : columns.length ? `${columns.length} ${columns.length === 1 ? "column" : "columns"} · ${report.currency} · VAT ${includeVat ? "included" : "off"} · ${report.filterLabels.join(" · ") || "All records"}` : "Add at least one column to preview or export."}</span></div>
      <div className="cr-actions">{saveButton}{exportLink("xlsx")}{exportLink("pdf")}<details ref={downloadMenu} className="cr-mobile-download" onKeyDown={e => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); } }}><summary aria-label="Download report"><Download /><ArrowDown /></summary><div>{exportLink("pdf", true)}{exportLink("xlsx", true)}</div></details>{exportLink("html")}</div>
    </footer>} />
    {params.get("savedReport") && <div className="cr-customizing"><SlidersHorizontal /><span>Customizing <strong>{params.get("reportName") || "saved report"}</strong> · changes apply to this session. Save creates a new report.</span><button className="cr-button" onClick={() => { const next = new URLSearchParams(params.toString()); next.delete("savedReport"); next.delete("reportName"); navigate(next); }}>Start new report</button></div>}
    <section className="cr-scope" aria-label="Report filters and display"><div className="cr-filters"><div className="cr-section-heading"><h2>Filter records</h2><span>{pending ? "Updating options…" : "All default to All"}</span>{hasFilters && <button className="cr-text-button" disabled={pending} onClick={clearFilters}>Clear filters</button>}</div>
      <div className="cr-filter-grid">{filterKeys.map(key => {
        const value = params.get(key) || "", valueLabel = report.options[key].find(o => o.value === value)?.label || "All";
        const query = browseSearch.trim().toLocaleLowerCase();
        const matches = report.options[key].filter(o => !query || o.label.toLocaleLowerCase().startsWith(query) || o.code?.toLocaleLowerCase().startsWith(query)).sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }) || a.label.localeCompare(b.label));
        const options = query ? matches : [{ value: "", label: "All", code: "" }, ...matches];
        const choose = (value: string) => { setFilter(key, value); setFilterDrafts({}); setBrowse(null); };
        return <div className="cr-filter" key={key}><span id={`${key}-label`}>{labels[key]}</span><div className={`cr-picker ${value ? "is-set" : ""}`}><input aria-label={`${labels[key]} code or name`} placeholder={valueLabel} value={filterDrafts[key] ?? ""} disabled={pending} onChange={e => setFilterDrafts(previous => ({ ...previous, [key]: e.target.value }))} onKeyDown={e => { if (e.key === "F2") { e.preventDefault(); e.stopPropagation(); setBrowse(key); setBrowseSearch(filterDrafts[key] ?? ""); setActiveOption(0); } }} /><Dialog open={browse === key} onOpenChange={open => { setBrowse(open ? key : null); setBrowseSearch(filterDrafts[key] ?? ""); setActiveOption(0); }}><DialogTrigger asChild><button data-record-browser={key} ref={key === "clientId" ? clientTrigger : undefined} disabled={pending} aria-label={`Browse ${plural[key]}`} title="Browse (F2)"><Search /></button></DialogTrigger>
          <DialogContent className="cr-dialog cr-browse-dialog"><DialogHeader><DialogTitle>Browse {plural[key]}</DialogTitle><DialogDescription>Search by the beginning of a code or name. Use arrow keys and Enter to select.</DialogDescription></DialogHeader><div className="cr-search"><Search /><input autoFocus role="combobox" aria-label="Search records" aria-expanded="true" aria-controls={`browse-${key}`} aria-activedescendant={`browse-${key}-${activeOption}`} value={browseSearch} onChange={e => { setBrowseSearch(e.target.value); setActiveOption(0); }} placeholder="Type to search…" onKeyDown={e => {
            if (options.length && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) { e.preventDefault(); const index = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, activeOption + (e.key === "ArrowDown" ? 1 : -1))); setActiveOption(index); document.getElementById(`browse-${key}-${index}`)?.scrollIntoView({ block: "nearest" }); }
            if (e.key === "F2") { e.preventDefault(); e.stopPropagation(); setActiveOption(0); }
            if (e.key === "Enter" && options[activeOption]) { e.preventDefault(); choose(options[activeOption].value); }
          }} /></div><div className="cr-browse-heading" aria-hidden="true"><span>Code</span><span>Name</span></div><div className="cr-options" id={`browse-${key}`} role="listbox" aria-label={labels[key]}>{options.map((option, index) => <div key={option.value} id={`browse-${key}-${index}`} role="option" aria-selected={option.value === value} className={index === activeOption ? "active" : ""} onMouseDown={e => e.preventDefault()} onClick={() => choose(option.value)}><span className="cr-record-code">{option.code || "—"}</span><span dir="auto">{option.label}</span>{option.value === value && <Check />}</div>)}{!options.length && browseSearch && <p>No matching records. <button className="cr-text-button" onClick={() => setBrowseSearch("")}>Clear search</button></p>}</div><div className="cr-dialog-footer">{value && <button className="cr-button" onClick={() => choose("")}>Clear selection</button>}<button className="cr-button" onClick={() => setBrowse(null)}>Cancel</button></div></DialogContent>
        </Dialog>{value && <button className="cr-clear-filter" aria-label={`Clear ${labels[key]} filter`} disabled={pending} onClick={() => setFilter(key, "")}><X /></button>}</div><small>{key === "clientId" ? "Press F2 to browse" : key === "creatorId" ? "Choose a vendor / creator" : key === "brandId" && params.get("clientId") ? "Within selected client" : key === "campaignId" && params.get("brandId") ? "Within selected brand" : "Browse available records"}</small></div>;
      })}<label className="cr-filter">Record currency<select value={report.recordCurrency} disabled={pending} onChange={e => setFilter("recordCurrency", e.target.value)}><option value="">All</option>{report.options.currency.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><small>Original billing currency</small></label></div>
    </div><div className="cr-display"><div className="cr-section-heading"><h2>Display</h2></div><div className="cr-display-controls"><fieldset><legend>Report currency</legend><div className="cr-currencies">{CUSTOM_CURRENCIES.map(c => <label key={c}><input ref={input => { if (input) input.checked = report.currency === c; }} type="radio" name="reportCurrency" value={c} checked={report.currency === c} disabled={pending} onChange={() => setFilter("currency", c)} /><span>{c}</span></label>)}</div><small>Converts amounts · Foreign keeps originals</small></fieldset><div><label className={`cr-vat ${includeVat ? "is-set" : ""}`}><input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} />Include VAT</label><small>Adds one VAT column</small></div></div></div></section>
    <div className="cr-panels"><section className={`cr-panel ${dragging && selected.includes(dragging) ? "cr-remove-target" : ""}`} aria-label="Available columns" onDragOver={e => e.preventDefault()} onDrop={e => drop(e, undefined, true)}><header><h2>Available data <span>{18 - selected.length} of 18</span></h2><p>Drag a field into your report, or use +.</p></header><div className="cr-field-search"><label className="cr-search"><Search /><input aria-label="Find a field" placeholder="Find a field" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setSearch(""); }} />{search && <button aria-label="Clear field search" onClick={() => setSearch("")}><X /></button>}</label></div>
      <div ref={availableList} className="cr-field-scroll">{FIELD_GROUPS.map(group => { const fields = group.keys.filter(key => available.some(c => c.key === key)); return fields.length ? <section key={group.label} className="cr-field-group"><h3>{group.label} <span>{fields.length}</span></h3>{fields.map(key => <div className="cr-field-row" key={key} draggable onDragStart={e => dragStart(e, key)} onDragEnd={finishDrag}><GripVertical className="cr-grip" /><div className="cr-field-copy"><strong>{column(key).label}</strong><small>{FIELD_DESCRIPTIONS[key]}</small></div><FieldTag field={key} /><button className="cr-icon" aria-label={`Add ${column(key).label}`} onClick={() => add(key)}><Plus /></button></div>)}</section> : null; })}{!available.length && <div className="cr-empty"><strong>{search ? "No matching fields" : "All fields have been added"}</strong><p>{search ? "Try a different name or clear your search." : "Arrange the columns in Your report."}</p>{search && <button className="cr-button" onClick={() => setSearch("")}>Clear search</button>}</div>}</div></section>
      <section className={`cr-panel ${dragging ? "cr-drop-target" : ""}`} aria-label="Selected columns" onDragOver={e => e.preventDefault()} onDrop={e => drop(e)}><header><div className="cr-panel-title"><h2>Your report <span>· {columns.length} {columns.length === 1 ? "column" : "columns"}</span></h2><button className="cr-text-button" disabled={!columns.length} onClick={() => { setUndo({ selected, vat: includeVat }); setSelected([]); setIncludeVat(false); setNotice("All columns cleared."); }}>Clear all</button></div><p>Columns appear left to right in this order. Use the arrows or Alt + ↑ / ↓ to reorder.</p></header>
        {!!columns.length && <div className="cr-order" aria-hidden="true"><span>Order</span>{columns.map(key => <span key={key} title={column(key).label}>{column(key).label}</span>)}</div>}
        <div className="cr-field-scroll">{selected.includes("creator") && <div className="cr-creator-notice"><Users /><p><strong>Creator detail is on.</strong> One row per creator within each campaign, with campaign details repeated and creator-specific amounts. Revenue share is allocated, never repeated.</p></div>}{!columns.length && <div className="cr-empty"><strong>No columns yet</strong><p>Drop fields here or add them from Available data.</p><button className="cr-button" onClick={() => add("campaignNumber")}>Add Campaign Number</button></div>}
          <ol ref={selectedList} className="cr-selected-list">{selected.map((key, index) => <li data-field={key} key={key} className={`cr-selected-row ${dropTarget === key ? "cr-insert" : ""}`} draggable onDragStart={e => dragStart(e, key)} onDragEnd={finishDrag} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropTarget(key); }} onDrop={e => drop(e, key)} onKeyDown={e => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); reorder(key, e.key === "ArrowUp" ? -1 : 1); } }}><span className="cr-position">{index + 1}</span><GripVertical className="cr-grip" /><div className="cr-field-copy"><strong>{column(key).label}</strong><small>{FIELD_DESCRIPTIONS[key]}</small></div><FieldTag field={key} /><div className="cr-row-actions"><button className="cr-icon" disabled={index === 0} aria-label={`Move ${column(key).label} up`} onClick={() => reorder(key, -1)}><ArrowUp /></button><button className="cr-icon" disabled={index === selected.length - 1} aria-label={`Move ${column(key).label} down`} onClick={() => reorder(key, 1)}><ArrowDown /></button><button className="cr-icon" aria-label={`Remove ${column(key).label}`} onClick={() => remove(key)}><X /></button></div></li>)}</ol>
          {includeVat && <div className="cr-selected-row cr-vat-row"><span className="cr-position">{columns.length}</span><div className="cr-field-copy"><strong>VAT</strong><small>{FIELD_DESCRIPTIONS.vat}</small></div><button className="cr-text-button" onClick={() => setIncludeVat(false)}>Turn off VAT</button></div>}
        </div></section></div>
    <div className="cr-feedback" role="status">{notice}{undo && <button className="cr-text-button" onClick={() => { setSelected(undo.selected); setIncludeVat(undo.vat); setUndo(null); setNotice("Columns restored."); }}>Undo clear</button>}</div>
  </div>;
}
