'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { loadMediaRecords } from './load-media-records';
import { filterMediaRecords, type MediaRecord, type MediaRecordKind } from '@/lib/navigation/media-records';
import { formatDocumentNumberForDisplay } from '@/lib/documents/format-document-number';
import { campaignDetailPath, quotationDetailPath, shortlistDetailPath } from '@/lib/routing/entity-paths';
import styles from './media-record-navigator.module.css';

export function MediaRecordNavigator({kind, currentId, activeTab}: {kind: MediaRecordKind; currentId?: string; activeTab?: string}) {
  const router = useRouter();
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadMediaRecords(kind).then(result => {
      if (!cancelled) { setRecords(result.rows); setError(result.error ?? ''); setLoading(false); }
    }).catch(() => { if (!cancelled) { setError('Could not load records. Please try again.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [kind, attempt]);
  const index = records.findIndex(row => row.id === currentId);
  const matches = filterMediaRecords(records, query);
  const label = kind === 'campaigns' ? 'Camp#' : kind === 'quotations' ? 'Quote#' : 'List#';
  function choose(id: string) {
    setOpen(false);
    if (id === currentId) return;
    const path = kind === 'campaigns' ? campaignDetailPath(id) : kind === 'quotations' ? quotationDetailPath(id) : shortlistDetailPath(id);
    router.push(activeTab && kind === 'campaigns' ? `${path}?tab=${encodeURIComponent(activeTab)}` : path);
  }
  function focusRow(next: number) {
    const bounded = Math.max(0, Math.min(matches.length - 1, next));
    setActive(bounded); rowRefs.current[bounded]?.focus();
  }
  const buttons = [
    {name:'First', icon:ChevronsLeft, target:0, disabled:!records.length || index === 0},
    {name:'Previous', icon:ChevronLeft, target:index-1, disabled:index <= 0},
    {name:'Next', icon:ChevronRight, target:index+1, disabled:index < 0 || index >= records.length-1},
    {name:'Last', icon:ChevronsRight, target:records.length-1, disabled:!records.length || index === records.length-1},
  ];
  return <div className={styles.bar} aria-label={`${kind} navigation`}>
    {buttons.map(({name,icon:Icon,target,disabled}) => <button key={name} type="button" className={styles.button} disabled={loading || disabled} onClick={() => choose(records[target].id)}><Icon size={14} aria-hidden="true"/>{name}</button>)}
    <input className={styles.quickSearch} aria-label={`Search ${kind} by number`} placeholder={kind === 'campaigns' ? 'Camp number' : kind === 'quotations' ? 'Quote number' : 'List number'} value={query} onChange={event => {setQuery(event.target.value);setActive(0);}} onKeyDown={event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!loading && query.trim() && matches.length === 1) choose(matches[0].id);
        else {setOpen(true);setActive(0);}
      } else if (event.key === 'ArrowDown') {event.preventDefault();setOpen(true);setActive(0);}
    }}/>
    <Popover open={open} onOpenChange={value => {setOpen(value); if(value) setActive(0);}}>
      <PopoverTrigger asChild><button type="button" className={styles.button} aria-label={`Search ${kind}`} title={`Search ${kind}`}><Search size={16}/></button></PopoverTrigger>
      <PopoverContent className={styles.dropdown} align="start" side="bottom" aria-label={`Search ${kind}`} onOpenAutoFocus={event => {event.preventDefault(); input.current?.focus();}}>
        <input ref={input} className={styles.input} aria-label="Search number, client or name" placeholder="Number, client or name…" value={query} onChange={event => {setQuery(event.target.value);setActive(0);}} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();focusRow(event.key === 'ArrowDown' ? 0 : matches.length-1);}
          if (event.key === 'Enter' && matches[0]) {event.preventDefault();choose(matches[0].id);}
        }}/>
        {loading ? <p role="status">Loading…</p> : error ? <div role="alert">{error} <button className={styles.button} onClick={() => {setLoading(true);setError('');setAttempt(value => value+1);}}>Retry</button></div> : <div className={styles.scroll}>
          <table className={styles.table}><thead><tr><th>{label}</th><th>Client</th><th>Camp Name</th></tr></thead><tbody>
            {matches.map((row,i) => <tr key={row.id} ref={node => {rowRefs.current[i]=node;}} tabIndex={i === active ? 0 : -1} className={i === active ? styles.active : undefined} onFocus={() => setActive(i)} onClick={() => choose(row.id)} onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();choose(row.id);}
              else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();focusRow(i+(event.key === 'ArrowDown' ? 1 : -1));}
              else if(event.key === 'Home' || event.key === 'End') {event.preventDefault();focusRow(event.key === 'Home' ? 0 : matches.length-1);}
            }}><td>{formatDocumentNumberForDisplay(row.number) || '—'}</td><td>{row.client || '—'}</td><td>{row.name || 'Untitled'}</td></tr>)}
          </tbody></table>{!matches.length && <p role="status">No matching records.</p>}
        </div>}
        <small>{matches.length} records · ↑ ↓ to move · Enter to select · Esc to close</small>
      </PopoverContent>
    </Popover>
    <span className={styles.count}>{loading ? '…' : `${index < 0 ? '—' : index+1} / ${records.length}`}</span>
  </div>;
}
