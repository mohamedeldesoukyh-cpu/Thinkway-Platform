"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import { recordCollectionPaymentFromWorkspaceAction } from "@/features/collections/actions";
import { saveCollectionFollowUp } from "@/features/collections/redesign-actions";
import { BUCKETS, COLLECTION_TABS, bucketIndex, statementClientList, collectionTab, dateLabel, daysOverdue, groupCurrency, money, summarizeInvoices, type CollectionsPageData, type CollectionsTab } from "@/features/collections/redesign-data";

export const COLLECTION_COLS = {
  aging: "28px minmax(186px,1.3fr) 108px 108px 108px 108px 108px 126px 86px",
  overdue: "148px minmax(148px,1.2fr) 96px 96px 78px 106px 128px 112px 166px",
  statement: "148px 96px 96px minmax(150px,1fr) 66px 132px 132px",
  client: "minmax(0,1fr) 104px",
};
function Grid({ type, variant, cells }: { type: keyof typeof COLLECTION_COLS; variant: string; cells: ReactNode[] }) {
  const trackCount = COLLECTION_COLS[type].match(/(?:[^\s(]+\([^)]*\)|[^\s]+)/g)?.length ?? 0;
  if (cells.length !== trackCount) throw new Error(`Collections ${type} grid: ${cells.length} cells for ${trackCount} tracks`);
  return <div className={`tw-g ${variant}`} style={{ "--cols": COLLECTION_COLS[type] } as CSSProperties}>{cells.map((cell, i) => <span key={i}>{cell}</span>)}</div>;
}
function Value({ amount, empty = false }: { amount: number; empty?: boolean }) { return <span className={`tw-v${empty || amount === 0 ? " z" : ""}`} style={{ display: "block", textAlign: "left" }}>{empty ? "—" : money(amount)}</span>; }
function Empty() { return <span />; }
function Scroll({ width, children }: { width: number; children: ReactNode }) { return <div className="tw-sc"><div style={{ minWidth: width }}>{children}</div></div>; }
function Head({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) { return <div className="tw-ch"><span className="tw-ct">{title}</span>{subtitle && <span className="tw-cs">{subtitle}</span>}<span className="tw-sp" />{children}</div>; }
function csv(name: string, rows: (string | number | null | undefined)[][]) {
  const content = rows.map(row => row.map(v => `"${String(v ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function invoiceCsv(rows: CollectionInvoiceRow[]) { csv("collections-invoices.csv", [["Invoice", "Client", "Currency", "Issued", "Due", "Total", "Received", "Open"], ...rows.map(r => [r.document_number, r.client_name, r.currency, r.issue_date, r.due_date, r.total, r.amount_paid, r.outstanding])]); }

export function AgingTree({ invoices, clients, asOf, code }: { invoices: CollectionInvoiceRow[]; clients: CollectionsPageData["clients"]; asOf: string; code: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const summary = summarizeInvoices(invoices, asOf);
  const bucketCells = (s: ReturnType<typeof summarizeInvoices>) => s.buckets.map(b => <Value key={b.count + ":" + b.amount} amount={b.amount} empty={b.count === 0} />);
  return <Scroll width={1000}>
    <Grid type="aging" variant="tw-hr" cells={[<Empty />, "Client", ...BUCKETS.map(b => <span key={b} className="tw-rr" style={{ display: "block" }}>{b}</span>), "Total A/R", "% overdue"]} />
    {clients.map(client => {
      const rows = invoices.filter(r => r.client_id === client.id && r.outstanding > 0);
      const sums = summarizeInvoices(rows, asOf);
      const isOpen = expanded[client.id] ?? false;
      return <div key={client.id}>
        <Grid type="aging" variant="tw-r" cells={[
          <button className="tw-b sm" aria-label={`${isOpen ? "Collapse" : "Expand"} ${client.name} invoices`} aria-expanded={isOpen} onClick={() => setExpanded(s => ({ ...s, [client.id]: !isOpen }))}>{isOpen ? "−" : "+"}</button>,
          <span className="tw-t"><b>{client.name}</b></span>, ...bucketCells(sums), <Value amount={sums.total} empty={rows.length === 0} />, <span className="tw-v" style={{ display: "block" }}>{sums.percent === null ? "—" : `${sums.percent.toFixed(0)}%`}</span>,
        ]} />
        {<div hidden={!isOpen} className="tw-ad" style={{ borderLeftWidth: 0, boxShadow: "inset 3px 0 0 var(--tw-blue)" }}>
          {rows.length ? <>
            <Grid type="aging" variant="tw-adh" cells={[<Empty />, "Invoice · issued · due", ...BUCKETS, "Open", "Days"]} />
            {rows.map(row => <Grid key={row.id} type="aging" variant="tw-adr" cells={[
              <Empty />, <span className="tw-t"><Link className="tw-code" href={`/billing/invoices/${row.id}`}>{row.document_number}</Link><br />{dateLabel(row.issue_date)} → due {dateLabel(row.due_date)}</span>,
              ...BUCKETS.map((_, i) => <Value key={i} amount={row.outstanding} empty={bucketIndex(row.due_date, asOf) !== i} />),
              <Value amount={row.outstanding} />, <span className={row.due_date ? "tw-v" : "tw-miss"}>{daysOverdue(row.due_date, asOf) ?? "not set"}</span>,
            ]} />)}
            <Grid type="aging" variant="tw-adf" cells={[<Empty />, `${rows.length} invoice${rows.length === 1 ? "" : "s"}`, ...bucketCells(sums), <Value amount={sums.total} />, <Empty />]} />
            {sums.undated > 0 && <div className="tw-note wrn">{sums.undated} invoices have no due date. Their balances are included in total A/R but cannot be assigned to an aging bucket.</div>}
          </> : <div className="tw-note">No open {code} invoice for this client. Issue an invoice or choose another currency to see balances.</div>}
        </div>}
      </div>;
    })}
    <Grid type="aging" variant="tw-ft" cells={[<Empty />, `${clients.length} clients · ${code}`, ...bucketCells(summary), <Value amount={summary.total} empty={summary.count === 0} />, summary.percent === null ? "—" : `${summary.percent.toFixed(0)}%`]} />
  </Scroll>;
}

function ReceiptForm({ invoices, preferred, asOf }: { invoices: CollectionInvoiceRow[]; preferred: string; asOf: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [id, setId] = useState(preferred || (invoices.length === 1 ? invoices[0].id : ""));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [date, setDate] = useState(asOf.slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { setId(current => invoices.some(r => r.id === preferred) ? preferred : invoices.some(r => r.id === current) ? current : invoices.length === 1 ? invoices[0].id : ""); }, [preferred, invoices]);
  const row = invoices.find(r => r.id === id);
  const value = Number(amount);
  function restore() {
    try {
      const raw = sessionStorage.getItem("collections-receipt-draft");
      if (!raw) { toast.info("No saved draft in this browser session."); return; }
      const draft = JSON.parse(raw); setId(draft.id ?? ""); setAmount(draft.amount ?? ""); setMethod(draft.method ?? "bank_transfer"); setDate(draft.date ?? asOf.slice(0, 10)); setReference(draft.reference ?? ""); setNotes(draft.notes ?? "");
    } catch { toast.error("The saved draft could not be restored."); }
  }
  function submit() {
    if (!row || !Number.isFinite(value) || value <= 0) return;
    const fd = new FormData();
    for (const [key, v] of Object.entries({ invoice_id: id, amount, payment_method: method, reference_number: reference, notes, paid_at: date })) fd.set(key, v);
    start(async () => {
      const result = await recordCollectionPaymentFromWorkspaceAction(fd);
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); setAmount(""); setReference(""); setNotes(""); sessionStorage.removeItem("collections-receipt-draft"); router.refresh(); }
    });
  }
  return <div className="tw-c"><Head title="Record client payment" subtitle="Record money received · partial receipts update the invoice balance" />
    {!invoices.length && <div className="tw-note">No open invoice is available. Issue an invoice or change the client filter before recording a receipt.</div>}
    <div className="tw-form">
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-invoice">Invoice</label><select className="tw-in" id="cr-invoice" value={id} onChange={e => setId(e.target.value)}><option value="">Select invoice</option>{invoices.map(r => <option key={r.id} value={r.id}>{r.document_number} · {r.client_name} · {r.currency} {money(r.outstanding)} open</option>)}</select></div>
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-amount">Amount received</label><input className="tw-cwin" id="cr-amount" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-currency">Invoice currency</label><input className="tw-in" id="cr-currency" value={row?.currency ?? "Select invoice"} readOnly /></div>
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-method">Payment method</label><select className="tw-in" id="cr-method" value={method} onChange={e => setMethod(e.target.value)}>{[["bank_transfer", "Bank transfer"], ["wire", "Wire transfer"], ["check", "Cheque"], ["credit_card", "Credit card"], ["debit_card", "Debit card"], ["paypal", "PayPal"], ["other", "Other"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-date">Value date</label><input className="tw-in" id="cr-date" type="date" value={date} max={asOf.slice(0, 10)} onChange={e => setDate(e.target.value)} /></div>
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-ref">Bank reference</label><input className="tw-in" id="cr-ref" maxLength={120} value={reference} onChange={e => setReference(e.target.value)} /></div>
      <div className="tw-f"><label className="tw-lbl" htmlFor="cr-notes">Notes or proof link</label><input className="tw-in" id="cr-notes" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </div>
    <div className="tw-po">{[["Invoice total", row?.total], ["Already received", row?.amount_paid], ["This receipt", amount ? value : undefined], ["Remaining after", row ? row.outstanding - (Number.isFinite(value) ? value : 0) : undefined]].map(([label, v]) => <div key={String(label)}><i>{label}</i><b className={!v ? "z" : ""}>{typeof v === "number" ? money(v) : "—"}</b></div>)}</div>
    {row && value > row.outstanding && <div className="tw-note wrn">This receipt exceeds the open balance. Adjust the amount before recording it.</div>}
    <div className="tw-ch"><span className="tw-hint">Amounts stay in the invoice currency. No automatic conversion.</span><span className="tw-sp" /><button className="tw-b" onClick={restore}>Restore draft</button><button className="tw-b" onClick={() => { sessionStorage.setItem("collections-receipt-draft", JSON.stringify({ id, amount, method, date, reference, notes })); toast.success("Draft saved in this browser session."); }}>Save draft</button><button className="tw-b pri" disabled={pending || !row || !date || !Number.isFinite(value) || value <= 0 || value > row.outstanding} onClick={submit}>{pending ? "Recording…" : "Record payment"}</button></div>
  </div>;
}

export function CollectionsRedesign({ data }: { data: CollectionsPageData }) {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<CollectionsTab>(collectionTab(params.get("tab")));
  const [client, setClient] = useState(params.get("client") ?? "");
  const currencies = [...new Set(data.invoices.map(r => r.currency))].sort();
  const [currency, setCurrency] = useState(params.get("currency") ?? (currencies.includes("EGP") ? "EGP" : currencies[0] ?? "EGP"));
  const [statementSearch, setStatementSearch] = useState("");
  const [statementAll, setStatementAll] = useState(false);
  const [statementClient, setStatementClient] = useState(params.get("client") ?? "");
  const [preferredInvoice, setPreferredInvoice] = useState("");
  const [bucket, setBucket] = useState("all");
  const [followUp, setFollowUp] = useState<{ kind: "contact" | "due"; id: string; label: string } | null>(null);
  const [followDate, setFollowDate] = useState(data.asOf.slice(0, 10));
  const [followNotes, setFollowNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const followPanel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (followUp) { followPanel.current?.scrollIntoView({ behavior: "smooth", block: "center" }); followPanel.current?.focus(); } }, [followUp]);
  const [pending, start] = useTransition();
  useEffect(() => { setTab(collectionTab(params.get("tab"))); setClient(params.get("client") ?? ""); }, [params]);
  function navigate(next: CollectionsTab, nextClient = client, nextCurrency = currency) {
    setTab(next); setClient(nextClient); setCurrency(nextCurrency);
    const query = new URLSearchParams({ tab: next });
    if (nextClient) query.set("client", nextClient);
    if (nextCurrency) query.set("currency", nextCurrency);
    window.history.pushState(null, "", `/collections?${query}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const allInvoices = data.invoices.filter(r => !client || r.client_id === client);
  const invoices = allInvoices.filter(r => r.currency === currency);
  const open = invoices.filter(r => r.outstanding > 0);
  const summary = summarizeInvoices(invoices, data.asOf);
  const overdue = open.filter(r => (daysOverdue(r.due_date, data.asOf) ?? 0) > 0);
  const shownOverdue = overdue.filter(r => bucket === "all" || String(bucketIndex(r.due_date, data.asOf)) === bucket);
  const clients = data.clients.filter(r => !client || r.id === client);
  const receipts = data.receipts.filter(r => r.currency === currency && (!client || r.client_id === client));
  const collected = receipts.reduce((sum, r) => sum + r.amount, 0);
  const clientList = statementClientList(clients, allInvoices, currency, statementAll, statementSearch);
  const selectedClient = clientList.visible.some(c => c.id === statementClient) ? statementClient : clientList.visible[0]?.id || "";
  const statement = allInvoices.filter(r => r.client_id === selectedClient);
  const concentration = clients.map(c => ({ name: c.name, total: open.filter(r => r.client_id === c.id).reduce((s, r) => s + r.outstanding, 0) })).sort((a, b) => b.total - a.total)[0];
  function record(id: string) { setPreferredInvoice(id); navigate("record"); }
  function editFollowUp(kind: "contact" | "due", id: string, label: string) { setFollowUp({ kind, id, label }); setFollowDate(data.asOf.slice(0, 10)); setFollowNotes(""); setConfirmed(false); }
  const lastContact = Object.entries(data.contacts).filter(([id]) => allInvoices.some(r => r.id === id)).map(([, date]) => date).sort().at(-1);
  return <div className="collections-suite" style={{ minWidth: 0, maxWidth: "100%", fontFamily: "var(--font-sans, Geist), sans-serif" }}>
    <div className="tw-mast">
      <div className="tw-mh"><span className="id">A/R</span><h1>Collections</h1><span className="sub">Aging, receivables and collection performance · aged from the <b>due date</b>, as of {dateLabel(data.asOf)}</span><span className="tw-sp" /><span className="st">{currency} presentation</span></div>
      <div className="tw-mb"><span className="lb">{overdue.length ? "Blocker" : "A/R status"}</span><span><span className="msg">{summary.percent === 100 ? "Every open balance is past due" : overdue.length ? `${summary.percent?.toFixed(0)}% of open balances are past due` : "No overdue balances"}</span><br /><span className="sub">{summary.total ? summary.buckets.filter(b => b.amount > 0).map(b => `${(b.amount / summary.total * 100).toFixed(0)}% of A/R sits in ${BUCKETS[summary.buckets.indexOf(b)]}${summary.buckets.indexOf(b) ? " days" : ""}`).join(" · ") : "No open balance in this currency."}</span></span><span className="tw-sp" /><button className="go" onClick={() => navigate("aging")}>Open A/R aging</button></div>
      <div className="tw-mr" role="tablist" aria-label="Collections sections">{COLLECTION_TABS.map(([key, label]) => <button key={key} id={`tab-${key}`} role="tab" aria-controls={`panel-${key}`} aria-selected={tab === key} className={`tw-b sm${tab === key ? " pri" : ""}`} data-s={key} onClick={() => navigate(key)}>{label}{(key === "aging" || key === "overdue") && <span className="tw-cc">{key === "aging" ? open.length : overdue.length}</span>}</button>)}<span className="tw-sp" />
        <select className="tw-in" aria-label="Client" style={{ width: 150, height: 27 }} value={client} onChange={e => { setStatementClient(e.target.value);  navigate(tab, e.target.value); }}><option value="">All clients</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="tw-in" aria-label="A/R currency" style={{ width: 85, height: 27 }} value={currency} onChange={e => navigate(tab, client, e.target.value)}>{(currencies.length ? currencies : [currency]).map(c => <option key={c}>{c}</option>)}</select>
        <button className="tw-b sm" onClick={() => { setBucket("all");   navigate(tab, ""); }}>Reset</button>
      </div>
      <div className="tw-ms2">{[
        ["Total outstanding", summary.count ? money(summary.total) : "—", ""], ["Overdue", overdue.length ? money(summary.overdue) : "—", "r"], ["Current", summary.buckets[0].count ? money(summary.buckets[0].amount) : "—", "s"], ["Collected MTD", receipts.length ? money(collected) : "—", "s"], ["Expected", summary.buckets[0].count ? money(summary.buckets[0].amount) : "—", "s"], ["DSO days", "—", "s"], ["Bad debt 90+", summary.buckets[4].count ? money(summary.buckets[4].amount) : "—", "s"], ["Open invoices", String(summary.count), ""],
      ].map(([label, value, tone]) => <div key={label}><i>{label}</i><b className={tone}>{value}</b></div>)}</div>
    </div>
    {data.warnings.map(w => <div key={w} className="tw-note bad" role="alert">{w}</div>)}
    {summary.undated > 0 && <div className="tw-note wrn">{summary.undated} open invoices have no due date. Set their due dates before aging them; they are included in total A/R, not Current.</div>}
    <section data-p="dash" id="panel-dash" role="tabpanel" aria-labelledby="tab-dash" hidden={tab !== "dash"}>
      <div className="tw-deck">
        <div className={`tw-dc2 ${overdue.length ? "alert" : "n"}`}><div className="tw-dc2__h"><div><b>Overdue receivables</b><u>{summary.percent === null ? "No open balances" : `${summary.percent.toFixed(0)}% of outstanding A/R is past due`}</u></div></div><div className="tw-pad"><div className="tw-st"><span><i>Past due · {currency}</i><b className="bad">{overdue.length ? money(summary.overdue) : "—"}</b></span><span><i>Invoices</i><b>{overdue.length}</b></span></div><p className="tw-hint">Aging is calculated from invoice due dates as of {dateLabel(data.asOf)}.</p></div></div>
        <div className="tw-dc2 n"><div className="tw-dc2__h"><div><b>Client concentration</b><u>{concentration?.total ? `${concentration.name} carries the largest balance` : "No open balance"}</u></div></div><div className="tw-pad"><div className="tw-st"><span><i>Largest share of {currency} A/R</i><b>{summary.total ? `${((concentration?.total ?? 0) / summary.total * 100).toFixed(0)}%` : "—"}</b></span><span><i>Clients</i><b>{clients.length}</b></span></div><p className="tw-hint">Shares are calculated within the selected currency.</p></div></div>
        <div className="tw-dc2 n"><div className="tw-dc2__h"><div><b>Collection activity</b><u>{receipts.length ? `${receipts.length} receipts recorded this month` : "Nothing recorded this month"}</u></div></div><div className="tw-pad"><div className="tw-st"><span><i>Collected MTD · {currency}</i><b>{receipts.length ? money(collected) : "—"}</b></span><span><i>Last contact</i><b>{dateLabel(lastContact)}</b></span></div><p className="tw-hint">Contact history records confirmed follow-up. Receipts represent completed payments.</p></div></div>
      </div>
      <div className="tw-c"><Head title="A/R aging" subtitle={`Totals by bucket · ${currency}`}><button className="tw-b sm" onClick={() => navigate("aging")}>Open A/R aging</button><Link className="tw-b sm" href="/treasury">Open treasury dashboard</Link></Head><Scroll width={1000}><Grid type="aging" variant="tw-hr" cells={[<Empty />, "All clients", ...BUCKETS, "Total A/R", "% overdue"]} /><Grid type="aging" variant="tw-ft" cells={[<Empty />, `${clients.length} clients · ${summary.count} open invoices`, ...summary.buckets.map((b, i) => <Value key={i} amount={b.amount} empty={!b.count} />), <Value amount={summary.total} empty={!summary.count} />, summary.percent === null ? "—" : `${summary.percent.toFixed(0)}%`]} /></Scroll></div>
    </section>
    <section data-p="aging" id="panel-aging" role="tabpanel" aria-labelledby="tab-aging" hidden={tab !== "aging"}><div className="tw-c"><Head title="A/R aging" subtitle={`Aged from due date · ${currency} · reference ${dateLabel(data.asOf)}`}><button className="tw-b sm" onClick={() => invoiceCsv(invoices)}>Export CSV</button></Head><AgingTree invoices={invoices} clients={clients} asOf={data.asOf} code={currency} /><div className="tw-note">Empty buckets show —. Current remains visible. Invoice and client balances use the same currency and reference date.</div></div></section>
    <section data-p="overdue" id="panel-overdue" role="tabpanel" aria-labelledby="tab-overdue" hidden={tab !== "overdue"}><div className="tw-c"><Head title="Overdue management" subtitle={`${overdue.length} invoices · ${currency} ${money(summary.overdue)} past due`}><span className="tw-seg">{[["all", "All"], ["1", "1–30"], ["2", "31–60"], ["3", "61–90"], ["4", "90+"]].map(([key, label]) => <button key={key} aria-pressed={bucket === key} onClick={() => setBucket(key)}>{label}</button>)}</span><button className="tw-b sm" onClick={() => invoiceCsv(shownOverdue)}>Export CSV</button></Head>
      <Scroll width={1040}><Grid type="overdue" variant="tw-hr" cells={["Invoice", "Client", "Issued", "Due", "Days", "Bucket", "Outstanding", "Last contact", <Empty />]} />{shownOverdue.map(r => <Grid key={r.id} type="overdue" variant="tw-r wrn" cells={[<span className="tw-code">{r.document_number}</span>, r.client_name, dateLabel(r.issue_date), dateLabel(r.due_date), daysOverdue(r.due_date, data.asOf), <span className="tw-p p-y">{BUCKETS[bucketIndex(r.due_date, data.asOf) ?? 0]} days</span>, <Value amount={r.outstanding} />, <span className={data.contacts[r.id] ? "tw-t" : "tw-miss"}>{dateLabel(data.contacts[r.id])}</span>, <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><button className="tw-b sm" title="Log a reminder already sent" onClick={() => editFollowUp("contact", r.id, r.document_number ?? r.id)}>Remind</button><button className="tw-b sm" onClick={() => record(r.id)}>Record</button><Link className="tw-b sm pri" href={`/billing/invoices/${r.id}`}>Open</Link></span>]} />)}<Grid type="overdue" variant="tw-ft" cells={[`${shownOverdue.length} invoices`, <Empty />, <Empty />, <Empty />, <Empty />, currency, <Value amount={shownOverdue.reduce((s, r) => s + r.outstanding, 0)} empty={!shownOverdue.length} />, <Empty />, <Empty />]} /></Scroll>
      {!shownOverdue.length && <div className="tw-note">No overdue invoices in this currency and bucket. Choose All to review other overdue buckets.</div>}
    </div></section>
    <section data-p="stmt" id="panel-stmt" role="tabpanel" aria-labelledby="tab-stmt" hidden={tab !== "stmt"}><div className="tw-c"><Head title="Client statements" subtitle={`${clients.length} clients · ${clientList.withBalance} with an open balance`} /><div className="tw-stmt2"><div className="tw-stmt2__l"><div className="tw-stmt2__t"><input className="tw-in" aria-label="Find client" placeholder="Find client" value={statementSearch} onChange={e => setStatementSearch(e.target.value)} /><span className="tw-seg" style={{ marginTop: 7 }}><button aria-pressed={!statementAll} onClick={() => setStatementAll(false)}>With balance <em>{clientList.withBalance}</em></button><button aria-pressed={statementAll} onClick={() => setStatementAll(true)}>All <em>{clients.length}</em></button></span></div><div className="tw-stmt2__s">{clientList.visible.map(c => <button key={c.id} className={`tw-g tw-r${selectedClient === c.id ? " sel" : ""}`} style={{ "--cols": COLLECTION_COLS.client } as CSSProperties} aria-pressed={selectedClient === c.id} onClick={() => setStatementClient(c.id)}><span className="tw-t"><b>{c.name}</b><u>{c.rows.length ? `${c.rows.length} invoice${c.rows.length === 1 ? "" : "s"}` : "No invoice issued"}</u></span><span>{groupCurrency(c.rows).map(([code, rows]) => <span key={code} style={{ display: "block" }}><span className="tw-hint">{code}</span><Value amount={rows.reduce((sum, row) => sum + row.outstanding, 0)} /></span>)}{!c.rows.length && <Value amount={0} empty />}</span></button>)}{!clientList.visible.length && <div className="tw-note">No clients match. Clear the search or choose All.</div>}</div><div className="tw-stmt2__f">Sorted by outstanding in {currency}; other currencies stay separate. {!statementAll ? `${clients.length - clientList.withBalance} clients with no open balance are hidden. Switch to All to see them.` : "All clients are included."}</div></div><div className="tw-stmt2__r">
      <Head title={`${data.clients.find(c => c.id === selectedClient)?.name ?? "Select client"} — statement of account`} subtitle={`as of ${dateLabel(data.asOf)}`}><button className="tw-b sm" disabled={!statement.length} onClick={() => invoiceCsv(statement)}>Export CSV</button><button className="tw-b sm pri" disabled={!statement.length} onClick={() => window.print()}>Print / Save PDF</button></Head>
      {groupCurrency(statement).map(([code, rows]) => <div key={code}><div className="tw-note"><span className="tw-cc">{code}</span></div><Scroll width={920}><Grid type="statement" variant="tw-hr" cells={["Invoice", "Issued", "Due", "Campaign", "Days", "Invoiced", "Open"]} />{rows.map(r => <Grid key={r.id} type="statement" variant="tw-r" cells={[<Link className="tw-code" href={`/billing/invoices/${r.id}`}>{r.document_number}</Link>, dateLabel(r.issue_date), dateLabel(r.due_date), r.campaign_name, <span className="tw-v">{daysOverdue(r.due_date, data.asOf) ?? "not set"}</span>, <Value amount={r.total} />, <Value amount={r.outstanding} />]} />)}<Grid type="statement" variant="tw-ft" cells={[`${rows.length} invoices`, <Empty />, <Empty />, code, <Empty />, <Value amount={rows.reduce((s, r) => s + r.total, 0)} />, <Value amount={rows.reduce((s, r) => s + r.outstanding, 0)} />]} /></Scroll></div>)}{!statement.length && <div className="tw-note">No invoice has been issued for this client. A statement will be available after the first invoice is issued.</div>}
    </div></div></div></section>
    <section data-p="fcast" id="panel-fcast" role="tabpanel" aria-labelledby="tab-fcast" hidden={tab !== "fcast"}><div className="tw-c"><Head title="Collections & cashflow forecast" subtitle={`From open ${currency} A/R due dates · no prediction`} />{(() => {
      const weeks = Array.from({ length: 8 }, (_, i) => ({ amount: 0, count: 0, start: new Date(Date.parse(data.asOf.slice(0, 10)) + i * 7 * 86400000).toISOString().slice(0, 10) }));
      for (const row of open) { if (!row.due_date) continue; const days = Math.floor((Date.parse(row.due_date) - Date.parse(data.asOf.slice(0, 10))) / 86400000); if (days >= 0 && days < 56) { weeks[Math.floor(days / 7)].amount += row.outstanding; weeks[Math.floor(days / 7)].count++; } }
      const max = Math.max(1, ...weeks.map(w => w.amount));
      return <><div className="tw-fc">{weeks.map((w, i) => <div key={i} className="tw-fc__b"><s style={{ height: `${w.amount / max * 100}%` }} /><b>Wk {i + 1} · {dateLabel(w.start)}</b><em>{w.count ? money(w.amount) : "—"}</em></div>)}</div><div className="tw-note wrn">{overdue.length ? `${currency} ${money(summary.overdue)} is already past due. It is excluded from future receipt dates until a recovery date is agreed.` : "Future receipts use invoice due dates; they are not a prediction of when a client will pay."} No instalments or recovery dates are invented.</div></>;
    })()}</div></section>
    <section data-p="record" id="panel-record" role="tabpanel" aria-labelledby="tab-record" hidden={tab !== "record"}><ReceiptForm invoices={allInvoices.filter(r => r.outstanding > 0)} preferred={preferredInvoice} asOf={data.asOf} /></section>
    {followUp && <div ref={followPanel} tabIndex={-1} onKeyDown={e => { if (e.key === "Escape") setFollowUp(null); }} className="tw-c" role="dialog" aria-modal="false" aria-label={followUp.kind === "contact" ? "Log reminder contact" : "Schedule payable"}><Head title={followUp.kind === "contact" ? "Log a reminder already sent" : "Schedule payable due date"} subtitle={followUp.label}><button className="tw-b sm" onClick={() => setFollowUp(null)}>Cancel</button></Head><div className="tw-form"><div className="tw-f"><label className="tw-lbl" htmlFor="follow-date">{followUp.kind === "contact" ? "Contact date" : "Due date"}</label><input className="tw-in" id="follow-date" type="date" value={followDate} max={followUp.kind === "contact" ? data.asOf.slice(0, 10) : undefined} onChange={e => setFollowDate(e.target.value)} /></div><div className="tw-f"><label className="tw-lbl" htmlFor="follow-notes">Notes</label><input className="tw-in" id="follow-notes" value={followNotes} maxLength={1000} onChange={e => setFollowNotes(e.target.value)} /></div></div><div className="tw-ch">{followUp.kind === "contact" && <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I confirm this contact occurred. This action only records history.</label>}<span className="tw-sp" /><button className="tw-b pri" disabled={pending || !followDate || (followUp.kind === "contact" && !confirmed)} onClick={() => start(async () => { const result = await saveCollectionFollowUp({ kind: followUp.kind, id: followUp.id, date: followDate, notes: followNotes }); if (!result.ok) toast.error(result.error); else { toast.success("Follow-up saved."); setFollowUp(null); router.refresh(); } })}>{pending ? "Saving…" : "Save"}</button></div></div>}
  </div>;
}
