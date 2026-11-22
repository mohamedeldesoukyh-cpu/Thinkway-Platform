import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, FilePlus2, Save, Printer, Search, RefreshCw, Undo2, Redo2, Pencil } from 'lucide-react';
const icons={edit:Pencil,first:ChevronsLeft,previous:ChevronLeft,next:ChevronRight,last:ChevronsRight,new:FilePlus2,save:Save,preview:Printer,search:Search,refresh:RefreshCw,undo:Undo2,redo:Redo2};
export type RecordAction={id:keyof typeof icons;label:string;hint:string;disabled?:boolean;primary?:boolean;run:()=>void};
export function RecordToolbar({label,actions,position,children}:{label:string;actions:RecordAction[];position?:string;children?:React.ReactNode}){
 return <div className="tw-ac-command-bar" role="toolbar" aria-label={label}>{actions.map(action=>{const Icon=icons[action.id];return <button key={action.id} type="button" className={'tw-ac-button'+(action.primary?' tw-ac-primary':'')} aria-label={action.label} title={action.hint} disabled={action.disabled} onClick={action.run}><Icon size={14}/>{action.label}</button>;})}{children}{position&&<span>{position}</span>}</div>;
}
