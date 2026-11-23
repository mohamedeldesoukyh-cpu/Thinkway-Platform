"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FinanceReply } from "./contracts";
import { FinanceMailWorkspace } from "./mail-workspace";

type Message = { role: "user" | "assistant"; content: string; reply?: FinanceReply };
const suggestions = ["Show the P&L for the selected fiscal year", "هات كشف حساب عميل", "What can you help me with?"];

export function FinanceAssistantWorkspace({companyId,yearId}:{companyId:string;yearId:string|null}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const message = draft.trim();
    if (!message || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    const next: Message[] = [...messages, { role: "user", content: message }];
    try {
      const response = await fetch("/api/accounting/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, yearId, message, history: messages.slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 6000) })) }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Unable to retrieve an answer.");
      setMessages([...next, { role: "assistant", content: data.content, reply: data }]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      inFlight.current = false; setBusy(false); input.current?.focus();
    }
  }

  return <><div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
    <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-6" aria-label="Finance conversation">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Ask Amgad / اسأل أمجد</h2><p className="text-sm text-muted-foreground">AI Finance Assistant · Thinkway</p></div>
        <Button variant="outline" className="min-h-11" disabled={busy || !messages.length} onClick={() => { setMessages([]); setError(null); }}>New chat</Button>
      </div>
      {!messages.length && <div className="mb-8 space-y-4"><p className="text-base leading-relaxed">Ask for a client statement, explore your accounting P&L, or discuss an accounting question. I use the company and fiscal year selected in TW Accounting.</p>
        <div className="flex flex-col items-start gap-2">{suggestions.map((text) => <button type="button" key={text} dir="auto" className="min-h-11 max-w-full rounded-lg border px-4 py-2 text-start text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { setDraft(text); input.current?.focus(); }}>{text}</button>)}</div>
      </div>}
      <div className="space-y-5" role="log" aria-label="Messages" aria-live="polite" aria-busy={busy}>
        {messages.map((message, index) => <article key={index} className={`rounded-lg p-4 ${message.role === "user" ? "bg-muted" : "border"}`}>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{message.role === "user" ? "You" : "Amgad · AI Finance Assistant"}</p>
          <p dir="auto" className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.content}</p>
          {message.reply?.sources.map((source) => <div key={source.href} className="mt-4 border-t pt-3">
            <Link className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4" href={source.href}>{source.title}</Link>
            <p className="text-sm text-muted-foreground">{source.scope}</p>
            {source.tables?.map((table,tableIndex)=><div key={tableIndex} className="mt-4 overflow-x-auto rounded-lg border" role="region" aria-label={table.heading} tabIndex={0} dir="ltr"><table className="w-full text-left text-sm"><caption className="p-3 text-left font-semibold">{table.heading}</caption><thead className="bg-muted"><tr>{table.columns.map((column,i)=><th key={i} scope="col" className="whitespace-nowrap px-3 py-2">{column}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i} className="border-t">{row.map((cell,j)=><td key={j} className="px-3 py-2 tabular-nums" dir="auto">{cell}</td>)}</tr>)}</tbody></table></div>)}
            <details className="mt-2"><summary className="cursor-pointer py-2 text-sm">Verified report data</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs" dir="ltr">{JSON.stringify(source.facts, null, 2)}</pre></details>
          </div>)}
        </article>)}
      </div>
      <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="finance-request" className="block text-sm font-medium">Your request / طلبك</label>
        <Textarea ref={input} id="finance-request" dir="auto" value={draft} maxLength={4000} disabled={busy} onChange={(event) => setDraft(event.target.value)} placeholder="Ask in Arabic or English…" className="min-h-28 text-base" aria-describedby={error ? "finance-error" : undefined} />
        {error && <p id="finance-error" role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Chat lasts for this page session.</p><Button type="submit" disabled={busy || !draft.trim()} className="min-h-11">{busy ? "Checking your request…" : "Ask Finance"}</Button></div>
      </form>
    </section>
    <aside className="space-y-5 text-sm">
      <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Connected to TW Accounting</h2><p className="mt-2 leading-relaxed text-muted-foreground">Client account statements and ledger-based P&L. Reports include posted, unlocked entries and use journal dates. Source details show the exact scope.</p></section>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Google Workspace + Resend</h2><p className="mt-2 break-words">amgad@thinkwaymedia.com</p><p className="mt-2 leading-relaxed text-muted-foreground">Forwarding is configured with Gmail copies retained. Use the inbox below to check connectivity and prepare replies for the approved finance team.</p></section>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">First release</h2><p className="mt-2 leading-relaxed text-muted-foreground">Reports and explanations are available. Document uploads, voice, transaction approval and maintained IFRS references are next.</p></section>
    </aside>
  </div><FinanceMailWorkspace key={`${companyId}:${yearId}`} companyId={companyId} yearId={yearId}/></>;
}
