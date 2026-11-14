"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { ExternalLink, List, Pencil, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CUSTOM_COLUMNS } from "@/lib/reports/custom/custom-report";
import { savedCustomReportUrl, type SavedCustomReport } from "@/lib/reports/custom/saved-custom-reports";

type Props = {
  reports: SavedCustomReport[]; busy: boolean; pending: boolean; error: boolean; loaded: boolean;
  close: () => void; retry: () => void; customize: (report: SavedCustomReport) => void;
  configure: (report: SavedCustomReport) => void; toggleFavorite: (report: SavedCustomReport) => void;
  activeId?: string | null; previewHref?: string;
  filterOptions?: Record<string, {value:string;label:string}[]>;
};
export function SavedReportPicker(props: Props) {
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const rows = useRef(new Map<string, HTMLLIElement>());
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const filterLabels = (report: SavedCustomReport) => Object.entries(report.filters).flatMap(([key,value]) => {
    if (!value) return [];
    if (key.endsWith("Id")) return value.split(",").map(id => props.filterOptions?.[key]?.find(option=>option.value===id)?.label).filter(Boolean) as string[];
    return [value];
  });
  const labels = (report: SavedCustomReport) => [...report.columns, ...(report.includeVat ? ["vat"] : [])].map(key => CUSTOM_COLUMNS.find(column=>column.key===key)?.label ?? key);
  const sorted = [...props.reports].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name));
  const matches = sorted.filter(report => (!favorites || report.favorite) && [report.name,report.currency,...labels(report),...filterLabels(report)].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = matches.find(report=>report.id===selectedId) ?? matches[0];
  const favoriteCount = props.reports.filter(report=>report.favorite).length;
  const highlight = (text:string) => {
    const needle=query.trim(); const index=text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
    return !needle || index<0 ? text : <>{text.slice(0,index)}<mark>{text.slice(index,index+needle.length)}</mark>{text.slice(index+needle.length)}</>;
  };
  const keyboard = (event:KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !selected) return;
    const target=event.target as HTMLElement;
    if (target.closest('[data-picker-tabs]')) return;
    if (event.key==="ArrowDown" || event.key==="ArrowUp") {
      event.preventDefault(); const index=matches.indexOf(selected);
      const next=matches[Math.max(0,Math.min(matches.length-1,index+(event.key==="ArrowDown"?1:-1)))];
      setSelectedId(next.id); rows.current.get(next.id)?.scrollIntoView({block:"nearest"});
    } else if (event.key==="Enter" && !target.closest('button,a')) {
      event.preventDefault(); if(event.shiftKey) {if(!props.pending)props.customize(selected);} else links.current.get(selected.id)?.click();
    }
  };
  return <Dialog open onOpenChange={open=>{if(!open)props.close();}}><DialogContent className="cr-dialog cr-report-picker" onKeyDown={keyboard}>
    <DialogHeader className="cr-picker-header"><span className="cr-picker-tile"><List/></span><div><DialogTitle>Open a saved report</DialogTitle><DialogDescription>Open with current data in a new tab, or customize its settings in the builder.</DialogDescription></div></DialogHeader>
    <div className="cr-picker-tools"><label className="cr-search"><Search/><input autoFocus aria-label="Search saved reports" aria-describedby="cr-picker-results" placeholder="Search by report, column or client…" value={query} onChange={event=>{setQuery(event.target.value);setSelectedId("");}}/>{query && <button className="cr-icon" aria-label="Clear search" onClick={()=>{setQuery("");setSelectedId("");}}><X/></button>}</label>
      <div className="cr-picker-tabs" data-picker-tabs role="group" aria-label="Report filter"><button aria-pressed={!favorites} onClick={()=>{setFavorites(false);setSelectedId("");}}>All <span>{props.reports.length}</span></button><button aria-pressed={favorites} onClick={()=>{setFavorites(true);setSelectedId("");}}><Star/>Favorites <span>{favoriteCount}</span></button></div>
    </div>
    <div className="cr-picker-body">
      <span id="cr-picker-results" className="sr-only" role="status">{matches.length} matching reports{selected ? `, selected ${selected.name}` : ""}</span>
      {!props.loaded ? <p role="status" className="cr-picker-empty">Loading saved reports…</p> : props.error ? <div role="alert" className="cr-picker-empty">Could not load saved reports.<button className="cr-button" onClick={props.retry}>Retry</button></div> : !matches.length ? <div className="cr-picker-empty"><List/><strong>{!props.reports.length ? "No saved reports yet" : favorites && !query ? "No favorites yet" : "No matching reports"}</strong><p>{!props.reports.length ? "Save a report in the builder to open it here." : "Try another search or view all reports."}</p>{!!props.reports.length && <button className="cr-button" onClick={()=>{setQuery("");setFavorites(false);}}>Show all reports</button>}</div> : <ul className="cr-picker-list">{matches.map((report,index)=>{
        const columns=labels(report); const details=[`${columns.length} columns`,report.currency==="Foreign"?"Original currencies":report.currency,report.includeVat?"VAT":null,...filterLabels(report)].filter(Boolean).join(" · ");
        const heading=query.trim() ? index===0 ? `${matches.length} results` : null : index===0 || report.favorite!==matches[index-1].favorite ? report.favorite ? `Favorites ${favoriteCount}` : `Other reports ${props.reports.length-favoriteCount}` : null;
        return <li key={report.id} ref={element=>{if(element)rows.current.set(report.id,element);else rows.current.delete(report.id);}}>
          {heading && <h3 className="cr-picker-group">{heading}</h3>}
          <article className={`cr-picker-card ${selected?.id===report.id ? "is-selected" : ""}`} onFocus={()=>setSelectedId(report.id)} onClick={()=>setSelectedId(report.id)}>
            <button className="cr-icon cr-picker-star" disabled={props.busy} aria-pressed={report.favorite} aria-label={`${report.favorite?"Remove":"Add"} ${report.name} ${report.favorite?"from":"to"} favorites`} onClick={()=>props.toggleFavorite(report)}><Star className={report.favorite?"cr-starred fill-current":""}/></button>
            <div className="cr-picker-info"><strong title={report.name} dir="auto">{highlight(report.name)}</strong><small title={details}>{details}</small><div className="cr-picker-columns">{columns.slice(0,4).map(label=><span key={label}>{highlight(label)}</span>)}{columns.length>4 && <small>+{columns.length-4} more</small>}</div></div>
            <div className="cr-picker-actions">{report.canEdit && <button className="cr-icon" disabled={props.busy} aria-label={`Rename or manage ${report.name}`} onClick={()=>props.configure(report)}><Pencil/></button>}<button className="cr-button" disabled={props.pending} onClick={()=>props.customize(report)}><SlidersHorizontal/>{report.canEdit?"Customize":"Customize a copy"}</button><a ref={element=>{if(element)links.current.set(report.id,element);else links.current.delete(report.id);}} className={`cr-button ${selected?.id===report.id?"primary":""}`} href={report.id===props.activeId && props.previewHref?props.previewHref:savedCustomReportUrl(report,true)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${report.name}`} onClick={props.close}>Open<ExternalLink/></a></div>
          </article>
        </li>;
      })}</ul>}
    </div>
    <footer className="cr-picker-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Move <kbd>Enter</kbd> Open <kbd>Shift + Enter</kbd> Customize <kbd>Esc</kbd> Close</span><span>{props.reports.length} saved</span></footer>
  </DialogContent></Dialog>;
}
