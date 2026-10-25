import { loadQuotationProposalOptions, saveQuotationProposalOptions } from "@/features/quotations/actions";
import { parseProposalOptions, type ProposalOption } from "@/features/quotations/export/proposal-options";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, UsersIcon, XIcon, SearchIcon, LockKeyholeIcon } from "lucide-react";

import styles from "./creator-dialog.module.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { platformLabel } from "@/features/campaigns/line-assignment";
import {
  type DocumentExportSelection,
} from "@/features/discovery/document-preview/document-export-selection";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import type { DocumentSelectionSummary } from "./document-selection-summary";

export type DocumentCreatorOption = {
  /** Stable creator key used for UI selection. */
  creatorKey: string;
  /** All document item IDs belonging to this creator. */
  itemIds: string[];
  name: string;
  handle: string;
  avatarUrl?: string | null;
  meta?: string | null;
  /** Linked / deliverable platforms for this creator (export filter chips). */
  platforms?: string[];
};

type Props = {
  proposalStorageKey?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: DocumentCreatorOption[];
  /**
   * Workspace table selection (item IDs) — single source of truth.
   * Empty means “all creators” for the initial seed.
   */
  workspaceItemIds?: string[];
  /** Sync dialog selection back into workspace state on confirm. */
  onWorkspaceSelectionChange?: (itemIds: string[]) => void;
  /** Live summary derived from the current dialog selection. */
  summarizeSelection: (itemIds: string[]) => DocumentSelectionSummary;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** When true, confirm stays disabled (e.g. linked platforms still loading). */
  confirmDisabled?: boolean;
  onConfirm: (selection: DocumentExportSelection) => void;
};

function itemIdsForCreators(
  creators: DocumentCreatorOption[],
  selectedCreatorKeys: Set<string>
): string[] {
  const ids: string[] = [];
  for (const creator of creators) {
    if (!selectedCreatorKeys.has(creator.creatorKey)) continue;
    for (const id of creator.itemIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function creatorKeysFromItemIds(
  creators: DocumentCreatorOption[],
  itemIds: string[] | null | undefined
): Set<string> {
  if (!itemIds?.length) {
    return new Set(creators.map((creator) => creator.creatorKey));
  }
  const wanted = new Set(itemIds);
  const keys = new Set<string>();
  for (const creator of creators) {
    if (creator.itemIds.some((id) => wanted.has(id))) {
      keys.add(creator.creatorKey);
    }
  }
  return keys.size > 0 ? keys : new Set(creators.map((c) => c.creatorKey));
}

function platformsForCreators(
  creators: DocumentCreatorOption[],
  selectedCreatorKeys: Set<string>
): string[] {
  const keys = new Set<string>();
  for (const creator of creators) {
    if (!selectedCreatorKeys.has(creator.creatorKey)) continue;
    for (const platform of creator.platforms ?? []) {
      const key = canonicalPlatformKey(platform);
      if (key) keys.add(key);
    }
  }
  return sortPlatformsStable([...keys].map((platform) => ({ platform }))).map(
    (entry) => entry.platform
  );
}

function initials(name: string, handle: string): string {
  const source = name.trim() || handle.replace(/^@/, "").trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function DocumentCreatorSelectionDialog({
  open,
  proposalStorageKey,
  onOpenChange,
  creators,
  workspaceItemIds,
  onWorkspaceSelectionChange,
  summarizeSelection,
  title = "Select creators for preview",
  description = "Only the creators and platforms selected here appear in the preview and the exports. Totals and numbering update as you change the selection.",
  confirmLabel = "Open preview",
  confirmDisabled = false,
  onConfirm,
}: Props) {
  const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsSaving, setOptionsSaving] = useState(false);
  const [optionsMessage, setOptionsMessage] = useState("");
  const optionsRevision = useRef<string | null>(null);
  const savedOptions = useRef("[]");
  const [activeOption, setActiveOption] = useState(0);
  const [selectionError, setSelectionError] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    () => new Set()
  );
  const platformsTouchedRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(() => new Set());

  const workspaceSelectionKey = JSON.stringify(workspaceItemIds ?? []);
  useEffect(() => {
    if (!open) {
      platformsTouchedRef.current = false;
      return;
    }
    setQuery("");
    setSelectionError("");
    setOptionsMessage("");
    setOptionsSaving(false);
    optionsRevision.current = null;
    let cancelled = false;
    function applyOptions(saved: ProposalOption[]) {
      const allowed = new Set(creators.flatMap(creator => creator.itemIds));
      const available = saved.map(option => ({...option,itemIds:option.itemIds.filter(id=>allowed.has(id))})).filter(option=>option.itemIds.length);
      setProposalOptions(available);
      setActiveOption(0);
      const nextKeys = creatorKeysFromItemIds(creators, available[0]?.itemIds ?? workspaceItemIds);
      setSelectedKeys(nextKeys);
      setSelectedPlatforms(new Set(platformsForCreators(creators,nextKeys)));
      platformsTouchedRef.current = false;
    }
    applyOptions([]);
    setOptionsLoading(Boolean(proposalStorageKey));
    if (proposalStorageKey) {
      loadQuotationProposalOptions(proposalStorageKey).then(result => {
        if (cancelled) return;
        if (!result.ok) {setSelectionError(result.message); return;}
        optionsRevision.current = result.revision;
        savedOptions.current = JSON.stringify(result.options ?? []);
        let saved = result.options;
        if (saved === null) {
          try {saved = parseProposalOptions(localStorage.getItem(`quotation-proposals:${proposalStorageKey}`));} catch {saved=[];}
        }
        applyOptions(saved ?? []);
      }).catch(()=>{if(!cancelled) setSelectionError("Could not load saved options. Close and reopen the selector to retry.");})
        .finally(()=>{if(!cancelled) setOptionsLoading(false);});
    }
    return () => {cancelled=true;};
  }, [open, workspaceSelectionKey, proposalStorageKey]);

  const selectedCount = selectedKeys.size;
  const allSelected = creators.length > 0 && selectedCount === creators.length;
  const noneSelected = selectedCount === 0;

  const selectedItemIds = useMemo(
    () => itemIdsForCreators(creators, selectedKeys),
    [creators, selectedKeys]
  );

  const currentOptions = proposalOptions.map((option, index) => index === activeOption ? { ...option, itemIds: selectedItemIds } : option);
  const invalidOptions = currentOptions.some(option => !option.itemIds.length);
  function switchOption(index: number) {
    setProposalOptions(currentOptions);
    setActiveOption(index);
    const ids = currentOptions[index]?.itemIds ?? [];
    setSelectedKeys(ids.length ? creatorKeysFromItemIds(creators, ids) : new Set());
    setQuery("");
  }
  function addOption() {
    if (!currentOptions.length) {
      setProposalOptions([{ itemIds: selectedItemIds, recommended: false }]);
      setActiveOption(0);
    } else {
      setProposalOptions([...currentOptions, { itemIds: [], recommended: false }]);
      setActiveOption(currentOptions.length);
      setSelectedKeys(new Set());
    }
    setQuery("");
  }
  function removeOption(index: number) {
    const next = currentOptions.filter((_, i) => i !== index);
    setProposalOptions(next);
    setActiveOption(0);
    setSelectedKeys(next.length ? (next[0]!.itemIds.length ? creatorKeysFromItemIds(creators, next[0]!.itemIds) : new Set()) : creatorKeysFromItemIds(creators, workspaceItemIds));
  }

  const availablePlatforms = useMemo(
    () => platformsForCreators(creators, proposalOptions.length ? new Set(creators.filter(creator => currentOptions.some(option => creator.itemIds.some(id => option.itemIds.includes(id)))).map(creator => creator.creatorKey)) : selectedKeys),
    [creators, selectedKeys, proposalOptions]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedPlatforms((prev) => {
      if (!platformsTouchedRef.current) {
        // Default: keep every available platform selected (incl. late-loaded links).
        return new Set(availablePlatforms);
      }
      const next = new Set(
        availablePlatforms.filter((platform) => prev.has(platform))
      );
      if (next.size === 0 && availablePlatforms.length > 0) {
        return new Set(availablePlatforms);
      }
      return next;
    });
  }, [availablePlatforms, open]);

  const summary = useMemo(
    () => summarizeSelection(selectedItemIds),
    [summarizeSelection, selectedItemIds]
  );

  const allPlatformsSelected =
    availablePlatforms.length > 0 &&
    selectedPlatforms.size === availablePlatforms.length;
  const noPlatformsSelected =
    availablePlatforms.length > 0 && selectedPlatforms.size === 0;

  function toggleCreator(creatorKey: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(creatorKey)) next.delete(creatorKey);
      else next.add(creatorKey);
      return next;
    });
  }

  function togglePlatform(platform: string) {
    platformsTouchedRef.current = true;
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  function selectAll() {
    setSelectedKeys(new Set(creators.map((creator) => creator.creatorKey)));
  }

  function selectNone() {
    setSelectedKeys(new Set());
  }

  function selectAllPlatforms() {
    platformsTouchedRef.current = true;
    setSelectedPlatforms(new Set(availablePlatforms));
  }

  async function persistOptions(proposals: ProposalOption[], force = false) {
    if (!proposalStorageKey) return true;
    if (optionsLoading || optionsSaving || !optionsRevision.current) return false;
    if (!force && JSON.stringify(proposals) === savedOptions.current) return true;
    setOptionsSaving(true);
    setSelectionError("");
    setOptionsMessage("");
    try {
      const result = await saveQuotationProposalOptions(proposalStorageKey, proposals, optionsRevision.current);
      if (!result.ok) {setSelectionError(result.message);return false;}
      optionsRevision.current = result.revision;
      savedOptions.current = JSON.stringify(proposals);
      try {localStorage.removeItem(`quotation-proposals:${proposalStorageKey}`);} catch { /* Server is authoritative. */ }
      setOptionsMessage(proposals.length ? "Options saved to this quotation." : "Saved options cleared.");
      return true;
    } catch {setSelectionError("Could not save options. Please try again.");return false;}
    finally {setOptionsSaving(false);}
  }
  async function clearOptions() {
    if (!await persistOptions([], true)) return;
    setProposalOptions([]);
    setActiveOption(0);
    setSelectedKeys(creatorKeysFromItemIds(creators, workspaceItemIds));
  }
  async function handleConfirm() {
    if (confirmDisabled || noneSelected || noPlatformsSelected || invalidOptions || optionsLoading || optionsSaving) return;
    const proposals = proposalStorageKey ? currentOptions : [];
    const confirmedIds = proposals.length ? [...new Set(proposals.flatMap(option => option.itemIds))] : selectedItemIds;
    if (!await persistOptions(proposals)) return;
    onWorkspaceSelectionChange?.(confirmedIds);
    const platforms =
      allPlatformsSelected || availablePlatforms.length === 0
        ? null
        : [...selectedPlatforms];
    onConfirm({ itemIds: confirmedIds, platforms, proposalOptions: proposals.length ? proposals : undefined });
    onOpenChange(false);
  }

  const creatorSummaries = useMemo(() => new Map(creators.map(creator => [creator.creatorKey, summarizeSelection(creator.itemIds)])), [creators, summarizeSelection]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCreators = creators.filter(creator => `${creator.name} ${creator.handle} ${creator.meta ?? ""}`.toLocaleLowerCase().includes(normalizedQuery));
  const clientMetrics = summary.metrics.filter(metric => metric.scope === "client");
  const internalMetrics = summary.metrics.filter(metric => metric.scope === "internal");
  const audienceMetrics = summary.metrics.filter(metric => !metric.scope);
  const figure = (value: string) => { const match = /^([A-Z]{3})\s+(.+)$/.exec(value); return match ? <><span className={styles.currency}>{match[1]}</span>{match[2]}</> : value; };
  const metricList = (metrics: DocumentSelectionSummary["metrics"]) => <dl className={styles.figures}>{metrics.map(metric => <div key={metric.label} className={metric.label === "Total incl. AF" ? styles.totalFigure : undefined}><dt>{metric.label}</dt><dd>{figure(metric.value)}</dd></div>)}</dl>;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`${styles.dialog} ${styles.selectionDialog}`} overlayClassName={styles.overlay} showCloseButton={false}
      onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
      <header className={styles.header}>
        <div className={styles.heading}><div>
          <DialogTitle className={styles.title}><UsersIcon size={18} aria-hidden="true" />{title}</DialogTitle>
          <DialogDescription className={styles.subtitle} title={description}>Choose creators and platforms for your preview and exports.</DialogDescription>
        </div><button type="button" className={styles.close} aria-label="Close creator selection" onClick={() => onOpenChange(false)}><XIcon size={16} aria-hidden="true" /></button></div>
      </header>
      <fieldset className={styles.selectionBody} disabled={optionsLoading || optionsSaving} style={{border:0,padding:0,margin:0,minWidth:0}}>
        {proposalStorageKey && <section className={styles.proposalOptions} aria-label="Proposal options">
          <div className={styles.proposalHeading}><strong>Proposal options</strong><span className={styles.optionsHint}>Creators can appear in multiple options.</span><button type="button" className={styles.button} disabled={proposalOptions.length >= 12} onClick={addOption}>+ Add Options</button></div>
          {optionsLoading && <p role="status">Loading saved options…</p>}
          {optionsMessage && <p role="status">{optionsMessage}</p>}
          {proposalOptions.length > 0 && <>
            <div className={styles.optionTabs} role="tablist" aria-label="Choose proposal option">{currentOptions.map((option, index) => <button type="button" role="tab" key={index} aria-selected={activeOption === index} className={`${styles.button} ${activeOption === index ? styles.primary : ""}`} onClick={() => switchOption(index)}>Option {index + 1}{option.recommended ? " ★" : ""}</button>)}</div>
            <div className={styles.optionActions}><strong>{selectedCount} creators</strong><button type="button" className={styles.button} aria-pressed={currentOptions[activeOption]?.recommended ?? false} onClick={() => setProposalOptions(currentOptions.map((option, index) => index === activeOption ? { ...option, recommended: !option.recommended } : option))}>{currentOptions[activeOption]?.recommended ? "★ Recommended" : "☆ Mark recommended"}</button><button type="button" className={styles.button} onClick={() => removeOption(activeOption)}>Remove option</button></div>
            {invalidOptions && <p className={styles.selectionWarning}>Select at least one creator in every option before continuing.</p>}

            <div className={styles.optionSaveActions}><button type="button" className={styles.button} disabled={invalidOptions || !optionsRevision.current} onClick={()=>void persistOptions(currentOptions)}>Save options</button><button type="button" className={styles.button} disabled={!optionsRevision.current} onClick={()=>void clearOptions()}>Clear options</button></div>
          </>}
        </section>}
        {selectionError && <p role="alert">{selectionError}</p>}
        {clientMetrics.length || internalMetrics.length ? <div className={styles.zones}>
          {clientMetrics.length ? <section className={`${styles.zone} ${styles.clientZone}`} aria-label="Client-facing totals"><h3>Client-facing &middot; quotation prices</h3>{metricList(clientMetrics)}</section> : null}
          {internalMetrics.length ? <section className={`${styles.zone} ${styles.internalZone}`} aria-label="Internal totals"><h3><LockKeyholeIcon size={12} aria-hidden="true" />Internal &middot; never in client exports</h3>{metricList(internalMetrics)}</section> : null}
        </div> : null}
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount} aria-live="polite">{selectedCount} <span>of {creators.length} creators selected</span></span>
          <div className={styles.search}><SearchIcon size={14} aria-hidden="true" /><input type="search" aria-label="Search creators" placeholder="Search creators" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <button type="button" className={`${styles.button} ${styles.small}`} onClick={selectAll} disabled={allSelected || creators.length === 0}>Select all</button>
          <button type="button" className={`${styles.button} ${styles.small} ${styles.ghost}`} onClick={selectNone} disabled={noneSelected}>Select none</button>
          {audienceMetrics.length ? <p className={styles.audienceSummary}>{audienceMetrics.map(metric => `${metric.value} ${metric.label.toLowerCase()}`).join(" · ")}</p> : null}
        </div>
        {availablePlatforms.length > 0 ? <div className={styles.selectionBar}>
          <span className={styles.platformLabel} title="Filters displayed accounts and metrics; selected lines and prices remain included.">Platforms</span>
          <div className={styles.platforms}>{availablePlatforms.map(platform => <button key={platform} type="button" className={styles.platformToggle} aria-pressed={selectedPlatforms.has(platform)} onClick={() => togglePlatform(platform)}>
            <CheckIcon size={12} aria-hidden="true" className={styles.platformTick} /><PlatformIcon platform={platform} size="xs" variant="logo" />{platformLabel(platform)}<span>{creators.filter(creator => selectedKeys.has(creator.creatorKey) && creator.platforms?.some(value => canonicalPlatformKey(value) === platform)).length}</span>
          </button>)}<button type="button" className={`${styles.button} ${styles.small} ${styles.ghost}`} disabled={allPlatformsSelected} onClick={selectAllPlatforms}>All platforms</button></div>

        </div> : null}
        <div className={styles.selectionList}>
        {noPlatformsSelected ? <p role="status" className={styles.selectionWarning}>No platform is included. Select at least one platform to continue.</p> : null}
        <ul className={styles.selectionRows} aria-label="Creators to include">
          {visibleCreators.map(creator => {
            const checked = selectedKeys.has(creator.creatorKey);
            const metrics = creatorSummaries.get(creator.creatorKey)?.metrics ?? [];
            const rowMetrics = metrics.filter(metric => metric.label === "Client cost" || metric.label === "Est. reach");
            return <li key={creator.creatorKey}><label className={`${styles.selectionRow} ${checked ? styles.selectedRow : ""}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleCreator(creator.creatorKey)} aria-label={`Include ${creator.name}`} />
              <span className={styles.avatar}>{creator.avatarUrl && !failedAvatars.has(creator.avatarUrl) ? <img src={creator.avatarUrl} alt="" onError={() => setFailedAvatars(current => new Set(current).add(creator.avatarUrl!))} /> : initials(creator.name, creator.handle)}</span>
              <span className={styles.selectionIdentity}><strong dir="auto">{creator.name}</strong>
                {creator.handle !== "—" && creator.name.replace(/^@/, "") !== creator.handle.replace(/^@/, "") ? <small>{creator.handle}</small> : null}
                <span className={styles.rowPlatforms}>{(creator.platforms ?? []).map(platform => <span key={platform} data-included={selectedPlatforms.has(canonicalPlatformKey(platform))}>{platformLabel(platform)}</span>)}{!creator.platforms?.length && creator.meta ? creator.meta : null}</span>
              </span>
              {rowMetrics.map(metric => <span key={metric.label} className={styles.rowFigure}><small>{metric.label}</small><b>{figure(metric.value)}</b></span>)}
            </label></li>;
          })}
        </ul>
        {visibleCreators.length === 0 ? <p className={styles.empty}>{creators.length === 0 ? "No creators available for this document." : `No creator matches “${query}”. Clear the search to see all ${creators.length}.`}</p> : null}
        </div>
      </fieldset>
      <footer className={`${styles.footer} ${styles.selectionFooter}`}>
        <small>One selection drives the preview, PDF, PowerPoint, Excel and Word.</small>
        <button type="button" className={styles.button} onClick={() => onOpenChange(false)}>Cancel</button>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={handleConfirm} disabled={confirmDisabled || noneSelected || noPlatformsSelected || invalidOptions || optionsLoading || optionsSaving || Boolean(proposalStorageKey && !optionsRevision.current)}>{optionsSaving ? "Saving options…" : optionsLoading ? "Loading options…" : confirmDisabled ? "Loading platforms…" : confirmLabel}{!confirmDisabled && selectedCount > 0 ? ` (${selectedCount})` : ""}</button>
      </footer>
    </DialogContent>
  </Dialog>;
}
