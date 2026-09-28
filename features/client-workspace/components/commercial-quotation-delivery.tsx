"use client";

import { CommercialReveal, CommercialViewIcon } from "./commercial-motion";
import { useState, useTransition } from "react";

import { sendClientQuotationAction } from "../actions/client-workspace-actions";
import { normalizeClientDeliveryEmail } from "../client-quotation-delivery";
import type { ClientWorkspaceView } from "../types";

export function CommercialQuotationDelivery({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const saved = view.clientEmails ?? [];
  const [customEmail, setCustomEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const downloadHref = `/api/review/quotation?sign=${encodeURIComponent(token)}`;

  async function download() {
    setDownloading(true); setError(null);
    try {
      const response = await fetch(downloadHref, { cache: "no-store" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Download failed."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "Quotation.pdf";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not download quotation."); }
    finally { setDownloading(false); }
  }

  function send(email: string) {
    const normalized = normalizeClientDeliveryEmail(email);
    if (!normalized) {
      setError("Enter a valid email address.");
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await sendClientQuotationAction({ token, email: normalized });
      if (result.ok) {
        setMessage(result.message);
        setCustomEmail("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <CommercialReveal className="cm-doc">
      <p className="ck">Quotation</p>
      <h2>{view.quotation?.serialNumber ?? "Current quotation"}</h2>
      <p className="cm-meta"><bdi>{view.quotation?.name}</bdi>{view.quotation?.version ? ` · Version ${view.quotation.version}` : ""}</p>
      <span className="cm-pill info">Current quotation</span>
      <p className="note">
        Uses the current Thinkway quotation. Download the PDF, send it to a saved email, or add an
        address.
      </p>
      <div className="sumbar-cta" style={{ marginTop: 12 }}>
        <a className="btn sec cm-icon" aria-label="View quotation" title="View quotation" href={`${downloadHref}&view=1`} target="_blank" rel="noopener noreferrer"><CommercialViewIcon /></a>
        <button type="button" className="btn pri" onClick={() => void download()} disabled={downloading}>
          {downloading ? "Preparing quotation…" : "Download PDF"}
        </button>
      </div>
      {saved.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <p className="l">Saved emails</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
            {saved.map((email) => (
              <li
                key={email}
                className="send-row"
              >
                <span>{email}</span>
                <button
                  type="button"
                  className="btn sec"
                  disabled={pending}
                  onClick={() => send(email)}
                >
                  {pending ? "Sending…" : "Send"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="note" style={{ marginTop: 12 }}>
          No saved client email. Add an address below to send this quotation.
        </p>
      )}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          id="commercial-quotation-email"
          className="noteinput"
          value={customEmail}
          placeholder="Add an email address"
          aria-label="Add an email address"
          onChange={(event) => setCustomEmail(event.target.value)}
          style={{ minWidth: 0, flex: 1 }}
        />
        <button
          type="button"
          className="btn sec"
          disabled={pending}
          onClick={() => send(customEmail)}
        >
          Send quotation
        </button>
      </div>
      {error ? <p className="sumbar-msg">{error}</p> : null}
      {message ? <p className="sumbar-msg">{message}</p> : null}
    </CommercialReveal>
  );
}
