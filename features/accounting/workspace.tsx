"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ModuleSignOut } from "@/components/layout/module-sign-out";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AccountingHelp } from './help';
import { BookOpen, FileText, Upload, History, ChevronDown, ChevronRight, Download, FolderTree, Search, ShieldCheck, X, Layers3, ArrowLeftRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { accountingGroups, visibleAccountingNavigation, type AccountingView, type NavigationLanguage } from "./navigation";
import { chartCsv, isWithin, type Account } from "./chart";

export function AccountingWorkspace({accounts, companyName, controls, showChart, canMedia, onEdit, sectionTitle, onNavigate, activeView, canAdmin}: {accounts: (Account & {active?:boolean})[]; companyName:string; controls:React.ReactNode; showChart:boolean; canMedia:boolean; onEdit?:(account:Account)=>void;sectionTitle:string;activeView:AccountingView;canAdmin:boolean;onNavigate:(view:string)=>void}) {
  const [language, setLanguage] = useState<NavigationLanguage>('en');
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const navigationItems = visibleAccountingNavigation({accounting:true,admin:canAdmin});
  const activeItem = navigationItems.find(item=>item.view===activeView);
  const activeGroup = accountingGroups.find(group=>group.id===activeItem?.parent);
  const [groupState, setGroupState] = useState<{view:AccountingView; open:string[]}>({view:activeView,open:activeGroup?[activeGroup.id]:[]});
  // Expand only after a successful view change; preserve the existing dirty-journal guard.
  if(groupState.view!==activeView) setGroupState({view:activeView,open:[...new Set([...groupState.open,...(activeGroup?[activeGroup.id]:[])])]});
  const arabic = language==='ar';
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("all");
  const [kind, setKind] = useState("all");
  const [selectedCode, setSelectedCode] = useState<string | null>("121001");
  const selected = accounts.find(a => a.code === selectedCode);
  const [expanded, setExpanded] = useState<string[]>(["100000", "600000", "630000"]);
  const [treeOpen, setTreeOpen] = useState(true);
  const roots = accounts.filter(a => !a.parent);
  const groups = accounts.filter(a => a.kind === "Group");
  const leaves = accounts.filter(a => a.kind !== "Group");
  const visible = accounts.filter(a => (branch === "all" || isWithin(a, branch, accounts)) && (kind === "all" || a.kind === kind) && `${a.code} ${a.name} ${a.subledger ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const activeBranch = accounts.find(a => a.code === branch);
  const toggle = (code: string) => setExpanded(previous => previous.includes(code) ? previous.filter(c => c !== code) : [...previous, code]);
  function exportChart() {
    const url = URL.createObjectURL(new Blob([chartCsv(visible)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "tw-accounting-chart-of-accounts.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function treeNode(account: Account, level = 0): React.ReactNode {
    const children = groups.filter(a => a.parent === account.code);
    const open = expanded.includes(account.code);
    return <li key={account.code}><div className={`tw-ac-tree-row ${branch === account.code ? "is-active" : ""}`} style={{ paddingLeft: `${8 + level * 14}px` }}>
      {children.length ? <button className="tw-ac-chevron" onClick={() => toggle(account.code)} aria-label={`${open ? "Collapse" : "Expand"} ${account.name}`} aria-expanded={open}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button> : <span className="tw-ac-tree-spacer" />}
      <button className="tw-ac-tree-label" onClick={() => setBranch(account.code)} aria-pressed={branch === account.code}><span className="tw-ac-code">{account.code}</span><span>{account.name}</span></button>
    </div>{open && children.length > 0 && <ul>{children.map(a => treeNode(a, level + 1))}</ul>}</li>;
  }
  return <div className={'tw-accounting '+(['journals','expenses','opening','transfers','receipts','payments','payment-preparation','statements'].includes(activeView)?'tw-ac-work-page':'')}>
    <header className="tw-ac-topbar"><Link href="/accounting" className="tw-ac-brand"><span className="tw-ac-monogram">tw<span>.</span></span><span>Accounting<small>THINKWAY WORKSPACE</small></span></Link><div className="tw-ac-topbar-right"><span className="tw-ac-review">{companyName}</span>{canMedia && <Link className="tw-ac-switch" href="/modules"><ArrowLeftRight size={16} /> Switch module</Link>}<AccountingHelp /><ModuleSignOut /></div></header>
    <nav className="tw-ac-menu-bar" aria-label="Accounting menus">{accountingGroups.filter(g=>g.id!=='administration'||canAdmin).map(group=><DropdownMenu key={group.id}><DropdownMenuTrigger className="tw-ac-menu-trigger" aria-current={group.id===activeGroup?.id?'true':undefined}>{group[language]} <ChevronDown size={12}/></DropdownMenuTrigger><DropdownMenuContent>{navigationItems.filter(item=>item.parent===group.id).map(item=><DropdownMenuItem key={item.id} onSelect={()=>onNavigate(item.view!)}>{item[language]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>)}</nav>
    <div className="tw-ac-command-bar" role="toolbar" aria-label="Accounting shortcuts"><button className="tw-ac-button" title="Open general journal vouchers" aria-label="General JV" onClick={()=>onNavigate('journals')}><BookOpen size={16} aria-hidden="true"/>General JV</button><button className="tw-ac-button" title="Record and allocate client receipts" aria-label="Receipts" onClick={()=>onNavigate('receipts')}><Download size={16} aria-hidden="true"/>Receipts</button><button className="tw-ac-button" title="Record and allocate vendor payments" aria-label="Payments" onClick={()=>onNavigate('payments')}><Upload size={16} aria-hidden="true"/>Payments</button><button className="tw-ac-button" title="View account and Third Party statements" aria-label="Statements" onClick={()=>onNavigate('statements')}><FileText size={16} aria-hidden="true"/>Statements</button><span/><button className="tw-ac-button" title="Review transaction approvals, locks and history" aria-label="Approval & lock history" onClick={()=>onNavigate('transaction-locks')}><History size={16} aria-hidden="true"/>Approval & lock history</button>{canAdmin&&<button className="tw-ac-button" title="View accounting activity and audit history" aria-label="Audit log" onClick={()=>onNavigate('audit-viewer')}><ShieldCheck size={16} aria-hidden="true"/>Audit log</button>}</div>
    <div className="tw-ac-navigation-bar" dir={arabic?'rtl':'ltr'}>
      <button ref={navigationToggle} className="tw-ac-button tw-ac-mobile-navigation" aria-expanded={mobileNavigation} aria-controls="accounting-navigation" onClick={()=>setMobileNavigation(!mobileNavigation)}><PanelLeftOpen size={18}/>{arabic?'القائمة':'Menu'}</button>
      <div className="tw-ac-language" aria-label="Navigation language"><button lang="en" aria-pressed={!arabic} onClick={()=>setLanguage('en')}>English</button><button lang="ar" aria-pressed={arabic} onClick={()=>setLanguage('ar')}>العربية</button></div>
    </div>
    <div className="tw-ac-body" dir={arabic?'rtl':'ltr'}><aside id="accounting-navigation" className={'tw-ac-sidebar tw-ac-grouped-sidebar '+(mobileNavigation?'is-open':'')} lang={language} aria-label={arabic?'التنقل المحاسبي':'Accounting navigation'} onKeyDown={e=>{if(e.key==='Escape'){setMobileNavigation(false);navigationToggle.current?.focus();}}}>
      <nav className="tw-ac-grouped-navigation">{accountingGroups.map(group=>{
        const items=navigationItems.filter(item=>item.parent===group.id);
        if(group.id==='administration'&&!canAdmin)return null;
        const open=groupState.open.includes(group.id);
        return <section key={group.id} className={activeGroup?.id===group.id?'is-current-group':''}>
          {items.length?<><button className="tw-ac-group-heading" aria-expanded={open} aria-controls={'accounting-group-'+group.id} onClick={()=>setGroupState({view:activeView,open:open?groupState.open.filter(id=>id!==group.id):[...groupState.open,group.id]})}><FolderTree size={16}/><span>{group[language]}</span>{open?<ChevronDown size={16}/>:<ChevronRight size={16} className="tw-ac-direction-chevron"/>}</button><ul id={'accounting-group-'+group.id} hidden={!open}>{items.map(item=><li key={item.id}><button aria-current={activeView===item.view?'page':undefined} onClick={()=>{onNavigate(item.view!);setMobileNavigation(false);}}>{item[language]}</button></li>)}</ul></>:<div className="tw-ac-planned-group"><FolderTree size={16}/><span>{group[language]}</span><small>{arabic?'مخطط':'Planned'}</small></div>}
        </section>;
      })}</nav>
      <div className="tw-ac-sidebar-note"><ShieldCheck size={20}/><strong>{arabic?'مساحة المالية':'Finance workspace'}</strong><p>{arabic?'يخضع الوصول للصلاحيات المحاسبية المخصصة لك.':'Access follows your assigned accounting permissions.'}</p></div>
    </aside>
    <main className="tw-ac-main" dir="ltr"><div className="tw-ac-breadcrumb" dir={arabic?'rtl':'ltr'} lang={language}>{arabic?'المحاسبة':'Accounting'} <ChevronRight size={13}/> {activeGroup?.[language]} <ChevronRight size={13}/> <span>{activeItem?.[language]??sectionTitle}</span></div>
    <div className="tw-ac-title-row"><div><div className="tw-ac-eyebrow">THE FOUNDATION OF YOUR BOOKS</div><h1>{sectionTitle}</h1><p>Clear accounts, balanced journals and traceable transactions.</p></div>{showChart && <button className="tw-ac-button" onClick={exportChart}><Download size={16} /> Export CSV</button>}</div>
    {controls}
    {showChart && <><div className="tw-ac-summary"><div><Layers3 size={18} /><span><strong>{roots.length}</strong> account classes</span></div><div><FolderTree size={18} /><span><strong>{groups.length}</strong> summary groups</span></div><div><BookOpen size={18} /><span><strong>{leaves.length}</strong> detail accounts</span></div><span className="tw-ac-summary-note">Six-digit account codes</span></div>
    <div className="tw-ac-notice"><span className="tw-ac-notice-label">SETUP REVIEW</span><p>Your chart is saved. Use Journal vouchers for manual entries and General ledger to review posted balances.</p></div>
    <section className="tw-ac-register" aria-label="Chart of accounts register"><div className="tw-ac-toolbar"><button className="tw-ac-icon-button" aria-label={treeOpen ? "Hide account hierarchy" : "Show account hierarchy"} aria-expanded={treeOpen} onClick={() => setTreeOpen(!treeOpen)}>{treeOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}</button><label className="tw-ac-search"><Search size={17} /><input aria-label="Search accounts" placeholder="Search by account code or name…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label><label className="tw-ac-filter">Account use<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">All accounts</option><option>Group</option><option>Posting</option><option>Control</option><option>System</option></select></label></div>
    <div className={`tw-ac-register-body ${treeOpen ? "" : "tree-hidden"}`}>
      {treeOpen && <nav className="tw-ac-tree" aria-label="Account hierarchy"><div className="tw-ac-tree-heading">ACCOUNT HIERARCHY<button onClick={() => setExpanded(expanded.length ? [] : groups.map(a => a.code))}>{expanded.length ? "Collapse" : "Expand"}</button></div><button className={`tw-ac-all ${branch === "all" ? "is-active" : ""}`} onClick={() => setBranch("all")} aria-pressed={branch === "all"}><FolderTree size={16} /> All accounts <span>{accounts.length}</span></button><ul>{roots.map(a => treeNode(a))}</ul></nav>}
      <div className="tw-ac-table-pane"><div className="tw-ac-table-heading"><strong>{activeBranch?.name ?? "All accounts"}</strong><span aria-live="polite">{visible.length} accounts</span>{(query || kind !== "all" || branch !== "all") && <button onClick={() => { setQuery(""); setKind("all"); setBranch("all"); }}>Reset filters</button>}</div><div className="tw-ac-table-scroll"><table><thead><tr><th>Code</th><th>Account name</th><th>Use</th><th>Normal balance</th></tr></thead><tbody>{visible.map(a => <tr key={a.code} className={`${a.kind === "Group" ? "tw-ac-group-row" : ""} ${selected?.code === a.code ? "is-selected" : ""}`}><td className="tw-ac-code">{a.code}</td><td><button className="tw-ac-account-link" onClick={() => {setSelectedCode(a.code);onEdit?.(a);}} aria-label={`View ${a.code} ${a.name}`} aria-pressed={selected?.code === a.code}>{a.kind === "Group" && <FolderTree size={14} />} {a.name}</button>{a.active === false && <small>Inactive</small>}{a.subledger && <small>{a.subledger} subledger</small>}</td><td><span className={`tw-ac-kind tw-ac-kind-${a.kind.toLowerCase()}`}>{a.kind}</span></td><td><span className={`tw-ac-side ${a.normal.toLowerCase()}`}>{a.normal}</span></td></tr>)}</tbody></table>{!visible.length && <div className="tw-ac-empty"><Search size={26} /><h2>No matching accounts</h2><p>Try another name, code, or account filter.</p></div>}</div><footer className="tw-ac-register-footer">Select an account to review its structure and posting rules.<span>Balances in General ledger</span></footer></div>
    </div></section>
    {selected && <section className="tw-ac-detail" aria-label="Selected account details"><div className="tw-ac-detail-title"><span className="tw-ac-detail-icon"><BookOpen size={22} /></span><div><span className="tw-ac-eyebrow">ACCOUNT DETAILS · {selected.code}</span><h2>{selected.name}</h2></div><button className="tw-ac-icon-button" onClick={() => setSelectedCode(null)} aria-label="Close account details"><X size={18} /></button></div>{onEdit && <button className="tw-ac-button" onClick={() => onEdit(selected)}>Edit account</button>}<dl><div><dt>Account type</dt><dd>{selected.type}</dd></div><div><dt>Parent account</dt><dd>{selected.parent ? `${selected.parent} · ${accounts.find(a => a.code === selected.parent)?.name}` : "Top-level class"}</dd></div><div><dt>Normal balance</dt><dd>{selected.normal}</dd></div><div><dt>Account use</dt><dd>{selected.kind === "Group" ? "Summary only" : selected.kind === "System" ? "Year-end closing only" : selected.kind === "Control" ? "Linked subledger required" : "Detail posting account"}</dd></div></dl><p className="tw-ac-detail-note">{selected.subledger ? selected.subledger === "Employee" ? "Employee balances are tracked through this control account." : "Third-party tracking links this account to a client or vendor using its shared Thinkway code. Review the third party’s balances, invoices and settlements in Statements." : selected.kind === "Group" ? "This group summarizes its child accounts. Journals cannot post directly to a summary group." : selected.code.startsWith("633") ? `Monthly depreciation debits this expense account and credits the corresponding accumulated depreciation account ${selected.code.replace("633", "159")}.` : selected.kind === "System" ? "Reserved for the closing workflow. Ordinary manual journals must not post to this account." : "This account is saved in your company chart. View its posted transactions and balance in General ledger."}</p></section>}
    </>}
    <footer className="tw-ac-page-footer"><span>TW Accounting</span><span>Structured accounts. Traceable transactions.</span></footer>
    </main></div>
  </div>;
}
