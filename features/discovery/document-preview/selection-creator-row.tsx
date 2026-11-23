import { memo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { DocumentCreatorOption } from "./document-creator-selection-dialog";
import type { DocumentSelectionSummary } from "./document-selection-summary";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";

export function selectionMetric(summary: DocumentSelectionSummary | undefined, label: string) {
  return summary?.metrics.find(metric => metric.label === label)?.value ?? "—";
}

export const SelectionCreatorRow = memo(function SelectionCreatorRow({creator, selected, platforms, summary, summarize, hideMoney, readOnlyOptions, onToggle, onToggleItems}: {
  creator: DocumentCreatorOption;
  selected: Set<string>;
  platforms: Set<string>;
  summary?: DocumentSelectionSummary;
  summarize: (ids: string[]) => DocumentSelectionSummary;
  hideMoney: boolean;
  readOnlyOptions: boolean;
  onToggle: (creator: DocumentCreatorOption) => void;
  onToggleItems: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const checked = creator.itemIds.every(id => selected.has(id));
  const included = creator.itemIds.some(id => selected.has(id));
  const partial = included && !checked;
  const options = creator.lineOptions ?? [];
  const expandable = options.length > 1 || Boolean(options[0]?.packageLabel);
  const metric = (label: string) => included ? selectionMetric(summary, label) : "—";
  const initials = (creator.name || creator.handle).trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
  const shownPlatforms = (creator.platforms ?? []).filter(platform => platforms.has(canonicalPlatformKey(platform)));
  return <div className={`cs-row${included ? " is-sel" : ""}${expanded ? " is-open" : ""}`}>
    <div className="cs-row__main">
      <label className="cs-check"><input type="checkbox" checked={checked} ref={el => {if(el) el.indeterminate = partial;}} aria-checked={partial ? "mixed" : checked} onChange={() => onToggle(creator)} aria-label={`Select ${creator.name}`} /><span aria-hidden="true"><Check /></span></label>
      <span className="cs-av" aria-hidden="true">{creator.avatarUrl && failedAvatar !== creator.avatarUrl ? <img src={creator.avatarUrl} alt="" loading="lazy" onError={() => setFailedAvatar(creator.avatarUrl!)} /> : <span>{initials}</span>}</span>
      <span className="cs-id"><b dir="auto" title={creator.name}>{creator.name}</b><span className="cs-sub"><span className="cs-sub__t">{creator.handle}{creator.meta ? ` · ${creator.meta}` : ""}</span><em className="cs-reach" title="Estimated reach from the existing forecast">{metric("Est. reach")} reach</em></span></span>
      <span className="cs-plats">{shownPlatforms.length ? shownPlatforms.map(platform => <span key={platform} className="cs-plat" title={`${platformLabel(platform)} followers`}><PlatformIcon platform={platform} size="xs" variant="logo" /><i>{formatCreatorCount(creator.platformFollowers?.find(account => canonicalPlatformKey(account.platform) === canonicalPlatformKey(platform))?.followers)}</i></span>) : <span className="cs-muted">{creator.platforms?.length ? "Accounts hidden" : "No linked accounts"}</span>}</span>
      <span className="cs-num cs-num--cost">{!hideMoney && <><u>Client cost</u><b>{metric("Client cost")}</b></>}</span>
      <span className="cs-num cs-num--int">{!hideMoney && <><u>Internal cost</u><b>{metric("Creator cost")}<em title="Margin: gross profit divided by total including fees">{metric("Margin")}</em></b></>}</span>
      <span className="cs-num cs-num--gp">{!hideMoney && <><u>Gross profit</u><b>{metric("Gross profit")}<em title="Markup: gross profit divided by creator cost">{metric("Markup on cost")}</em></b></>}</span>
      {expandable ? <button type="button" className="cs-disc" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} aria-label={`${expanded ? "Hide" : "Choose"} options for ${creator.name}`}>{readOnlyOptions ? "View options" : "Choose options"} · {options.filter(option => option.itemIds.every(id => selected.has(id))).length}/{options.length}<ChevronDown size={14} /></button> : <span className="cs-disc cs-disc--gap" aria-hidden="true" />}
    </div>
    {expanded && <div className="cs-opts" role="group" aria-label={`Service options for ${creator.name}`}>
      {readOnlyOptions && <p className="cs-opts__ro">All service options of an included creator appear in the rate card. Prices are alternatives, not a combined package.</p>}
      {options.map(option => {const isSelected = option.itemIds.every(id => selected.has(id)); const details = summarize(option.itemIds); return <label key={option.key} className={`cs-opt${isSelected ? " is-sel" : ""}`}>
        <input type="checkbox" checked={isSelected} disabled={readOnlyOptions} onChange={() => onToggleItems(option.itemIds)} aria-label={`${option.label} for ${creator.name}`} />
        <span className="cs-opt__t"><b>{option.label}{option.packageLabel && <em className="cs-tag">{option.packageLabel} · selected together</em>}</b><span>{option.description || "No deliverables specified"}</span></span>
        {!hideMoney && <span className="cs-opt__p"><b>{selectionMetric(details,"Client cost")}</b><em>Cost {selectionMetric(details,"Creator cost")} · GP {selectionMetric(details,"Gross profit")} · {selectionMetric(details,"Margin")}</em></span>}
      </label>;})}
    </div>}
  </div>;
});
