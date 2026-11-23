import { loadQuotationProposalOptions, saveQuotationProposalOptions } from "@/features/quotations/actions";
import { parseProposalOptions, type ProposalOption } from "@/features/quotations/export/proposal-options";

import { useEffect, useMemo, useRef, useState } from "react";
import { UsersIcon, XIcon, SearchIcon, LockKeyholeIcon } from "lucide-react";
import { normalizeCreatorItemSelection, seedCreatorItemSelection, toggleCreatorItems } from "./creator-item-selection";

import "./creator-selection-design.css";
import { SelectionCreatorRow, selectionMetric } from "./selection-creator-row";
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
import { QuotationConvertedTotal, type QuotationTotalSource } from "./quotation-converted-total";

export type DocumentCreatorOption = {
  /** Stable creator key used for UI selection. */
  creatorKey: string;
  /** All document item IDs belonging to this creator. */
  itemIds: string[];
  lineOptions?: Array<{ key: string; label: string; description: string; itemIds: string[]; packageLabel?: string }>;
  name: string;
  handle: string;
  avatarUrl?: string | null;
  meta?: string | null;
  /** Linked / deliverable platforms for this creator (export filter chips). */
  platforms?: string[];
  platformFollowers?: Array<{platform: string; followers: number | null}>;
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
  quotationTotalSource?: QuotationTotalSource;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** When true, confirm stays disabled (e.g. linked platforms still loading). */
  confirmDisabled?: boolean;
  onConfirm: (selection: DocumentExportSelection) => void;
};

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


export function DocumentCreatorSelectionDialog({
  open,
  proposalStorageKey,
  onOpenChange,
  creators,
  workspaceItemIds,
  onWorkspaceSelectionChange,
  summarizeSelection,
  quotationTotalSource,
  title = "Select creators for preview",
  description = "Choose creators, service options and platforms for your preview and exports.",
  confirmLabel = "Open preview",
  confirmDisabled = false,
  onConfirm,
}: Props) {
  const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsSaving, setOptionsSaving] = useState(false);
  const [optionsMessage, setOptionsMessage] = useState("");
  const [optionsRevision, setOptionsRevision] = useState<string | null>(null);
  const [savedOptions, setSavedOptions] = useState("[]");
  const [activeOption, setActiveOption] = useState(0);
  const [selectionError, setSelectionError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    () => new Set()
  );
  const platformsTouchedRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);


  const workspaceSelectionKey = JSON.stringify(workspaceItemIds ?? []);
  useEffect(() => {
    if (!open) {
      platformsTouchedRef.current = false;
      return;
    }
    // Seed the transient dialog draft only when opening or changing document.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setRailOpen(false); setClearConfirm(false);
    setSelectionError("");
    setOptionsMessage("");
    setOptionsSaving(false);
    setOptionsRevision(null);
    let cancelled = false;
    function applyOptions(saved: ProposalOption[]) {
      const allowed = new Set(creators.flatMap(creator => creator.itemIds));
      const available = saved.map(option => ({...option,itemIds: option.kind === "rate_card"
        ? creators.filter(creator => creator.itemIds.some(id => option.itemIds.includes(id))).flatMap(creator => creator.itemIds)
        : option.itemIds.filter(id=>allowed.has(id))})).filter(option=>option.itemIds.length);
      setProposalOptions(available);
      setActiveOption(0);
      const nextIds = seedCreatorItemSelection(creators, available[0]?.itemIds ?? workspaceItemIds);
      const nextKeys = new Set(creators.filter(creator => creator.itemIds.some(id => nextIds.has(id))).map(creator => creator.creatorKey));
      setSelectedIds(nextIds);
      setSelectedPlatforms(new Set(platformsForCreators(creators,nextKeys)));
      platformsTouchedRef.current = false;
    }
    applyOptions([]);
    setOptionsLoading(Boolean(proposalStorageKey));
    if (proposalStorageKey) {
      loadQuotationProposalOptions(proposalStorageKey).then(result => {
        if (cancelled) return;
        if (!result.ok) {setSelectionError(result.message); return;}
        setOptionsRevision(result.revision);
        setSavedOptions(JSON.stringify(result.options ?? []));
        let saved = result.options;
        if (saved === null) {
          try {saved = parseProposalOptions(localStorage.getItem(`quotation-proposals:${proposalStorageKey}`));} catch {saved=[];}
        }
        applyOptions(saved ?? []);
      }).catch(()=>{if(!cancelled) setSelectionError("Could not load saved options. Close and reopen the selector to retry.");})
        .finally(()=>{if(!cancelled) setOptionsLoading(false);});
    }
    return () => {cancelled=true;};
  // Linked-account enrichment must not reset edits in an already-open selector.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceSelectionKey, proposalStorageKey]);

  const selectedKeys = useMemo(() => new Set(creators.filter(creator => creator.itemIds.some(id => selectedIds.has(id))).map(creator => creator.creatorKey)), [creators, selectedIds]);
  const selectedCount = selectedKeys.size;
  const allSelected = creators.length > 0 && creators.every(creator => creator.itemIds.every(id => selectedIds.has(id)));
  const noneSelected = selectedCount === 0;

  const selectedItemIds = useMemo(
    () => [...new Set(creators.flatMap(creator => creator.itemIds))].filter(id => selectedIds.has(id)),
    [creators, selectedIds]
  );

  const currentOptions = useMemo(() => proposalOptions.map((option, index) => index === activeOption ? { ...option, itemIds: selectedItemIds } : option), [proposalOptions, activeOption, selectedItemIds]);
  const showDeliverables = currentOptions.every(option => option.showDeliverables !== false);
  const rateCardActive = currentOptions[activeOption]?.kind === "rate_card";
  const optionLabel = (index: number) => currentOptions[index]?.kind === "rate_card" ? "Rate card" : `Option ${currentOptions.slice(0, index + 1).filter(option => option.kind !== "rate_card").length}`;
  function addRateCard() {
    const next: ProposalOption[] = [...currentOptions, {kind: "rate_card", itemIds: creators.flatMap(creator => creator.itemIds), recommended: false, ...(showDeliverables ? {} : {showDeliverables:false})}];
    setProposalOptions(next);
    setActiveOption(next.length - 1);
    setSelectedIds(seedCreatorItemSelection(creators));
    setQuery("");
  }
  const invalidOptions = currentOptions.some(option => !option.itemIds.length);
  function switchOption(index: number) {
    setProposalOptions(currentOptions);
    setActiveOption(index);
    const ids = currentOptions[index]?.itemIds ?? [];
    setSelectedIds(normalizeCreatorItemSelection(creators, ids));
    setQuery("");
  }
  function addOption() {
    if (!currentOptions.length) {
      setProposalOptions([{ itemIds: selectedItemIds, recommended: false }]);
      setActiveOption(0);
    } else {
      setProposalOptions([...currentOptions, { itemIds: [], recommended: false, ...(showDeliverables ? {} : {showDeliverables:false}) }]);
      setActiveOption(currentOptions.length);
      setSelectedIds(new Set());
    }
    setQuery("");
  }
  function removeOption(index: number) {
    const next = currentOptions.filter((_, i) => i !== index);
    setProposalOptions(next);
    const nextActive = index < activeOption ? activeOption - 1 : index === activeOption ? Math.min(index, next.length - 1) : activeOption;
    setActiveOption(Math.max(0, nextActive));
    setSelectedIds(next.length ? normalizeCreatorItemSelection(creators, next[nextActive]!.itemIds) : seedCreatorItemSelection(creators, workspaceItemIds));
  }

  const availablePlatforms = useMemo(
    () => platformsForCreators(creators, proposalOptions.length ? new Set(creators.filter(creator => currentOptions.some(option => creator.itemIds.some(id => option.itemIds.includes(id)))).map(creator => creator.creatorKey)) : selectedKeys),
    [creators, selectedKeys, proposalOptions, currentOptions]
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

  function toggleItems(ids: string[]) {
    setSelectedIds(prev => toggleCreatorItems(prev, ids));
  }

  function toggleCreator(creator: DocumentCreatorOption) {
    toggleItems([...new Set(creator.lineOptions?.flatMap(option => option.itemIds) ?? creator.itemIds)]);
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
    setSelectedIds(seedCreatorItemSelection(creators));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function selectAllPlatforms() {
    platformsTouchedRef.current = true;
    setSelectedPlatforms(new Set(availablePlatforms));
  }

  async function persistOptions(proposals: ProposalOption[], force = false) {
    if (!proposalStorageKey) return true;
    if (optionsLoading || optionsSaving || !optionsRevision) return false;
    if (!force && JSON.stringify(proposals) === savedOptions) return true;
    setOptionsSaving(true);
    setSelectionError("");
    setOptionsMessage("");
    try {
      const result = await saveQuotationProposalOptions(proposalStorageKey, proposals, optionsRevision);
      if (!result.ok) {setSelectionError(result.message);return false;}
      setOptionsRevision(result.revision);
      setSavedOptions(JSON.stringify(proposals));
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
    setSelectedIds(seedCreatorItemSelection(creators, workspaceItemIds));
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

  const creatorSummaries = useMemo(() => new Map(creators.map(creator => [creator.creatorKey, summarizeSelection(creator.itemIds.some(id => selectedIds.has(id)) ? creator.itemIds.filter(id => selectedIds.has(id)) : creator.itemIds)])), [creators, summarizeSelection, selectedIds]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCreators = creators.filter(creator => `${creator.name} ${creator.handle} ${creator.meta ?? ""}`.toLocaleLowerCase().includes(normalizedQuery));
  const clientMetrics = summary.metrics.filter(metric => metric.scope === "client");
  const internalMetrics = summary.metrics.filter(metric => metric.scope === "internal");
  const audienceMetrics = summary.metrics.filter(metric => !metric.scope && metric.label !== "Followers");
  const railButton = useRef<HTMLButtonElement>(null);
  const railClose = useRef<HTMLButtonElement>(null);
  const closeRail = () => {setRailOpen(false); railButton.current?.focus();};
  const busy = optionsLoading || optionsSaving;
  const money = clientMetrics.length > 0;
  const blocked = confirmDisabled || noneSelected || noPlatformsSelected || invalidOptions || busy || Boolean(proposalStorageKey && !optionsRevision);
  const metricsList = (metrics: DocumentSelectionSummary["metrics"]) => <dl className="cs-kv">{metrics.map(metric => <div key={metric.label} className={metric.label === "Total incl. AF" || metric.label === "Margin" ? "is-total" : undefined}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>;
  const scope = currentOptions.length ? optionLabel(activeOption) : "Current selection";
  const optionDirty = JSON.stringify(currentOptions) !== savedOptions;
  return <Dialog open={open} onOpenChange={next => {if (!optionsSaving) onOpenChange(next);}}>
    <DialogContent className="cs cs-panel" showCloseButton={false}
      onOpenAutoFocus={() => {returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;}}
      onCloseAutoFocus={event => {if(returnFocus.current?.isConnected) {event.preventDefault(); returnFocus.current.focus();}}}
      onEscapeKeyDown={event => {if(railOpen) {event.preventDefault(); closeRail();} else if(optionsSaving) event.preventDefault();}}>
      <header className="cs-head"><div><DialogTitle className="cs-title"><UsersIcon size={18}/>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></div>
        {money && <span className="cs-head__int"><LockKeyholeIcon size={12}/> Internal figures stay private</span>}
        <button type="button" className="cs-icon" aria-label="Close creator selection" disabled={optionsSaving} onClick={() => onOpenChange(false)}><XIcon size={16}/></button>
      </header>
      <fieldset className="cs-body" disabled={busy} aria-busy={busy}>
        <div className={`cs-list-pane${money ? "" : " cs-shortlist"}`}>
          {currentOptions.length > 0 && <div className="cs-tabs" role="tablist" aria-label="Proposal options">{currentOptions.map((option,index) => <button key={index} type="button" role="tab" tabIndex={activeOption === index ? 0 : -1} aria-selected={activeOption === index} className={`cs-tab${index === activeOption ? " is-on" : ""}${!option.itemIds.length ? " is-empty" : ""}`} onClick={() => switchOption(index)} onKeyDown={event => {const target = event.key === "ArrowRight" ? (index+1)%currentOptions.length : event.key === "ArrowLeft" ? (index-1+currentOptions.length)%currentOptions.length : event.key === "Home" ? 0 : event.key === "End" ? currentOptions.length-1 : null; if(target !== null) {event.preventDefault(); switchOption(target); (event.currentTarget.parentElement?.children[target] as HTMLElement)?.focus();}}}>{optionLabel(index)}{option.recommended && " ★"}<i>{option.itemIds.length}</i></button>)}</div>}
          <div className="cs-tools"><label className="cs-search"><SearchIcon size={16}/><input type="search" value={query} placeholder="Search name, handle or category" aria-label="Search creators" onChange={event => setQuery(event.target.value)} />{query && <button type="button" className="cs-icon" aria-label="Clear search" onClick={() => setQuery("")}><XIcon size={14}/></button>}</label>
            <span className="cs-count" aria-live="polite"><b>{selectedCount}</b> of {creators.length} creators · <b>{selectedItemIds.length}</b> service lines</span>
            <span className="cs-tool-acts"><button type="button" className="cs-link" onClick={selectAll} disabled={allSelected || !creators.length}>Select all {creators.length}</button>{query && visibleCreators.length > 0 && <button type="button" className="cs-link" onClick={() => setSelectedIds(previous => normalizeCreatorItemSelection(creators,[...previous,...visibleCreators.flatMap(creator => creator.itemIds)]))}>Add {visibleCreators.length} search results</button>}<button type="button" className="cs-link" onClick={selectNone} disabled={noneSelected}>Select none</button></span>
          </div>
          {optionsLoading && <p className="cs-note cs-note--bar" role="status">Loading saved proposal options…</p>}
          {invalidOptions && <p className="cs-note cs-note--warn cs-note--bar" role="status">Select at least one creator in every proposal option before continuing.</p>}
          <div className="cs-scroll"><div className="cs-rows">
            <div className="cs-colhead" aria-hidden="true"><span/><span/><span>Creator</span><span className="cs-colhead__plats">Platforms &amp; followers</span><span className="cs-num">{!rateCardActive && "Client cost"}</span><span className="cs-num cs-colhead__int">{!rateCardActive && "Internal cost"}</span><span className="cs-num cs-colhead__int">{!rateCardActive && "Gross profit"}</span><span/></div>
            {visibleCreators.map(creator => <SelectionCreatorRow key={creator.creatorKey} creator={creator} selected={selectedIds} platforms={selectedPlatforms} summary={creatorSummaries.get(creator.creatorKey)} summarize={summarizeSelection} hideMoney={Boolean(rateCardActive) || !money} readOnlyOptions={Boolean(rateCardActive)} onToggle={toggleCreator} onToggleItems={toggleItems} />)}
          </div>{!visibleCreators.length && <div className="cs-empty"><h4>{creators.length ? `No creator matches “${query}”` : "No creators in this document yet"}</h4><p>{creators.length ? "Your selection has not changed." : "Add creators in the workspace, then reopen this dialog."}</p>{query && <button type="button" className="cs-btn" onClick={() => setQuery("")}>Clear search</button>}</div>}</div>
        </div>
        <div className={`cs-rail-wrap${railOpen ? " is-open" : ""}`}>
          <button ref={railClose} type="button" className="cs-rail-x" aria-label="Back to creator list" onClick={closeRail}><XIcon size={18}/></button>
          <aside className="cs-rail" aria-label="Selection context">
            {money && <section className="cs-card"><h3 className="cs-card__h">Totals<em className="cs-scope">{scope}</em></h3>{rateCardActive ? <p className="cs-fine">Rate-card prices are alternatives. A combined total would be misleading, so totals are hidden here.</p> : <><div className="cs-sides"><div className="cs-side cs-side--client"><h4>Client-facing · quotation prices</h4>{metricsList(clientMetrics)}</div><div className="cs-side cs-side--int"><h4><LockKeyholeIcon size={12}/> Internal · never in client exports</h4>{metricsList(internalMetrics)}</div></div><p className="cs-fine">Fees are taken per line. Margin is gross profit ÷ client total; markup is gross profit ÷ creator cost.</p>{quotationTotalSource && <QuotationConvertedTotal source={quotationTotalSource} itemIds={selectedItemIds} compact />}</>}</section>}
            <section className="cs-card"><h3 className="cs-card__h">Audience<em>{scope}</em></h3>{metricsList(audienceMetrics)}<p className="cs-fine">From the existing forecast for the selected lines.</p></section>
            <section className="cs-card"><h3 className="cs-card__h">Platforms shown</h3><div className="cs-plat-list" role="group" aria-label="Platforms shown">{availablePlatforms.map(platform => <button key={platform} type="button" className={`cs-plat-btn${selectedPlatforms.has(platform) ? " is-on" : ""}`} aria-pressed={selectedPlatforms.has(platform)} onClick={() => togglePlatform(platform)}><PlatformIcon platform={platform} size="xs" variant="logo"/><span>{platformLabel(platform)}</span><i>{creators.filter(creator => (currentOptions.length ? currentOptions.some(option => creator.itemIds.some(id => option.itemIds.includes(id))) : selectedKeys.has(creator.creatorKey)) && creator.platforms?.some(value => canonicalPlatformKey(value) === platform)).length}</i></button>)}</div>
              {availablePlatforms.length ? <button type="button" className="cs-link" disabled={allPlatformsSelected} onClick={selectAllPlatforms}>All platforms</button> : <p className="cs-fine">No linked accounts. Selected creators still appear in the output.</p>}
              {confirmDisabled && <p className="cs-fine" role="status">Loading linked platforms…</p>}
              <p className="cs-fine cs-platform-help">Platforms control displayed accounts and metrics. Selected services and prices stay included.</p>
              {noPlatformsSelected && <p className="cs-note cs-note--bad" role="alert">Choose at least one platform or use All platforms.</p>}
            </section>
            {proposalStorageKey && <section className="cs-card"><h3 className="cs-card__h">Proposal options<em>{currentOptions.filter(option => option.kind !== "rate_card").length}/12</em></h3><p className="cs-fine">Alternative selections for the presentation. A creator can appear in more than one option.</p>
              <ul className="cs-opt-list">{currentOptions.map((option,index) => {const details = summarizeSelection(option.itemIds);return <li key={index} className={`cs-opt-item${activeOption === index ? " is-active" : ""}${!option.itemIds.length ? " is-empty" : ""}`}><button type="button" className="cs-opt-item__go" aria-current={activeOption === index} onClick={() => switchOption(index)}><b>{optionLabel(index)}{option.recommended && <em className="cs-tag cs-tag--rec">★ Recommended</em>}</b><span className="cs-opt-item__m"><u>{option.itemIds.length} service lines</u>{!option.itemIds.length ? <em>Empty — select creators</em> : option.kind !== "rate_card" && <><b>{selectionMetric(details,"Total incl. AF")}</b><em>GP {selectionMetric(details,"Gross profit")} · {selectionMetric(details,"Margin")}</em></>}</span></button><span className="cs-opt-item__acts">{option.kind !== "rate_card" && <button type="button" className="cs-icon" aria-label={`Mark ${optionLabel(index)} recommended`} aria-pressed={option.recommended} onClick={() => setProposalOptions(currentOptions.map((entry,i) => i === index ? {...entry,recommended:!entry.recommended} : entry))}>☆</button>}<button type="button" className="cs-icon cs-icon--danger" aria-label={`Remove ${optionLabel(index)}`} onClick={() => removeOption(index)}><XIcon size={14}/></button></span></li>;})}</ul>
              <div className="cs-opt-add"><button type="button" className="cs-btn" disabled={currentOptions.filter(option => option.kind !== "rate_card").length >= 12} onClick={addOption}>+ Add option</button><button type="button" className="cs-btn" disabled={currentOptions.some(option => option.kind === "rate_card")} onClick={addRateCard}>+ Add rate card</button></div>
              {currentOptions.length > 0 && <><label className="cs-switch"><input type="checkbox" checked={showDeliverables} onChange={event => setProposalOptions(currentOptions.map(option => ({...option,showDeliverables:event.target.checked})))}/><span>Show deliverables in comparison</span></label><div className="cs-opt-save"><button type="button" className="cs-btn cs-btn--pri" disabled={invalidOptions || !optionsRevision} onClick={() => void persistOptions(currentOptions)}>Save options</button><button type="button" className="cs-btn cs-btn--danger" disabled={!optionsRevision} onClick={() => setClearConfirm(true)}>Clear options</button></div>{optionDirty && <p className="cs-fine cs-dirty">Unsaved options are saved before opening the preview.</p>}</>}
              {clearConfirm && <div className="cs-confirm" role="group" aria-label="Confirm clearing saved options"><p>Clear saved proposal options for this quotation? Creator and service records will stay in the quotation.</p><div className="cs-confirm__a"><button type="button" className="cs-btn" onClick={() => setClearConfirm(false)}>Keep options</button><button type="button" className="cs-btn cs-btn--danger" onClick={async () => {await clearOptions(); setClearConfirm(false);}}>Clear saved options</button></div></div>}
              {optionsMessage && <p className="cs-fine cs-ok" role="status">{optionsMessage}</p>}
            </section>}
          </aside>
        </div>
      </fieldset>
      {selectionError && <p className="cs-note cs-note--bad cs-note--bar" role="alert">{selectionError}</p>}
      <footer className="cs-foot"><button ref={railButton} type="button" className="cs-rail-open" aria-expanded={railOpen} onClick={() => {if(railOpen) closeRail(); else {setRailOpen(true); requestAnimationFrame(() => railClose.current?.focus());}}}>Totals &amp; tools</button><span className="cs-foot__sum"><b>{selectedCount}</b> creators · {selectedItemIds.length} lines<small>One selection for preview and all exports.</small></span><span className="cs-sp"/><span className="cs-foot__acts"><button type="button" className="cs-btn" disabled={optionsSaving} onClick={() => onOpenChange(false)}>Cancel</button><button type="button" className="cs-btn cs-btn--pri" disabled={blocked} onClick={handleConfirm}>{optionsSaving ? "Saving options…" : optionsLoading ? "Loading options…" : confirmDisabled ? "Loading platforms…" : `${confirmLabel} (${selectedCount})`}</button></span></footer>
    </DialogContent>
  </Dialog>;
}
