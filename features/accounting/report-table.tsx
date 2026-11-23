import type {ReactNode} from 'react';
export function ReportTable({columns,rows}:{columns:string[];rows:ReactNode[][]}){return <div className="tw-ac-journal-table-scroll"><table className="tw-ac-journal-table"><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,n)=><td key={n}>{v}</td>)}</tr>)}</tbody></table></div>;}
