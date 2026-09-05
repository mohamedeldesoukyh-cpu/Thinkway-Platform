"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type HomeDashboardPageKey = "home" | "dash";

const DEST = [
  {
    key: "home",
    href: "/",
    icon: "◧",
    title: "Home",
    hint: "Command centre — what needs you today",
  },
  {
    key: "dash",
    href: "/dashboard",
    icon: "◲",
    title: "Executive dashboard",
    hint: "CFO-grade finance monitoring",
  },
  {
    key: "camp",
    href: "/campaigns",
    icon: "✦",
    title: "Campaigns",
    hint: "Plans, IO, performance",
  },
  {
    key: "cli",
    href: "/clients",
    icon: "▣",
    title: "Clients",
    hint: "Accounts, legal, brands",
  },
  {
    key: "ven",
    href: "/vendors",
    icon: "●",
    title: "Vendors",
    hint: "Creators, payouts, stats",
  },
  {
    key: "disc",
    href: "/discovery/search",
    icon: "◇",
    title: "Discovery",
    hint: "Search, shortlists, quotations",
  },
] as const;

export function HomeDashboardPageSwitcher({
  page,
}: {
  page: HomeDashboardPageKey;
}) {
  const [open, setOpen] = useState(false);
  const current = DEST.find((item) => item.key === page) ?? DEST[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className={open ? "tw-psw on" : "tw-psw"}>
      {open ? (
        <button
          type="button"
          className="tw-scrim"
          aria-label="Close page switcher"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <button
        type="button"
        className="tw-pswb"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <h1>{current.title}</h1>
        <span aria-hidden>▼</span>
      </button>
      {open ? (
        <span className="tw-pswm" role="menu">
          <span className="tw-pswh">Go to</span>
          {DEST.map((item) => {
            const isCurrent = item.key === page;
            return (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                className={isCurrent ? "tw-pswi on" : "tw-pswi"}
                onClick={() => setOpen(false)}
              >
                <span className="ic">{item.icon}</span>
                <span>
                  <b>{item.title}</b>
                  <u>{item.hint}</u>
                </span>
                {isCurrent ? <em>current</em> : null}
              </Link>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
