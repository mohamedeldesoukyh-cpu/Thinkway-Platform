"use client";

import { useState } from "react";

import {
  CLIENT_WORKSPACE_ACCESS_REQUESTED_BODY,
  CLIENT_WORKSPACE_ACCESS_REQUESTED_TITLE,
  CLIENT_WORKSPACE_EXPIRED_BODY,
  CLIENT_WORKSPACE_EXPIRED_TITLE,
  CLIENT_WORKSPACE_REQUEST_ACCESS_LABEL,
  CLIENT_WORKSPACE_REQUEST_ACCESS_LEAD,
} from "../expired-access";
import { LogoMark } from "./review-icons";

type Props = {
  reviewId: string;
  token: string;
};

export function ClientWorkspaceAccessRequest({ reviewId, token }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/review/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, token, name, email, note }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? payload?.error ?? "Could not send your request. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="cx-expired-card" role="dialog" aria-labelledby="cx-expired-title" aria-modal="true">
      <div className="cx-expired-card__brand">
        <LogoMark />
        <span className="wm">
          THINK<b>WAY</b>
        </span>
      </div>
      <div className="cx-expired-card__body">
        {sent ? (
          <>
            <span className="cx-expired-card__seal cx-expired-card__seal--ok" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <p className="ck">Client Workspace</p>
            <h2 id="cx-expired-title">{CLIENT_WORKSPACE_ACCESS_REQUESTED_TITLE}</h2>
            <p className="note">{CLIENT_WORKSPACE_ACCESS_REQUESTED_BODY}</p>
          </>
        ) : (
          <>
            <span className="cx-expired-card__seal" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <p className="ck">Client Workspace</p>
            <h2 id="cx-expired-title">{CLIENT_WORKSPACE_EXPIRED_TITLE}</h2>
            <p className="note">{CLIENT_WORKSPACE_EXPIRED_BODY}</p>
            <p className="cx-expired-card__lead">{CLIENT_WORKSPACE_REQUEST_ACCESS_LEAD}</p>
            {open ? (
              <form className="cx-expired-form" onSubmit={(event) => void onSubmit(event)}>
                <label className="fl" htmlFor="cx-access-name">
                  Name
                </label>
                <input
                  id="cx-access-name"
                  className="noteinput"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={120}
                />
                <label className="fl" htmlFor="cx-access-email">
                  Work email
                </label>
                <input
                  id="cx-access-email"
                  className="noteinput"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={180}
                />
                <label className="fl" htmlFor="cx-access-note">
                  Message <span className="cx-expired-optional">optional</span>
                </label>
                <textarea
                  id="cx-access-note"
                  className="noteinput"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  rows={3}
                />
                {error ? <p className="cx-expired-error">{error}</p> : null}
                <div className="cx-expired-acts">
                  <button type="submit" className="btn primary" disabled={pending}>
                    {pending ? "Sending…" : "Send request"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="cx-expired-acts">
                <button type="button" className="btn primary" onClick={() => setOpen(true)}>
                  {CLIENT_WORKSPACE_REQUEST_ACCESS_LABEL}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
