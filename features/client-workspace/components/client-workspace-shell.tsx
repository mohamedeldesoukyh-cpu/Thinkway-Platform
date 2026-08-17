"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";

export function ClientWorkspaceShell({
  view,
  token,
  children,
}: {
  view: ClientWorkspaceView;
  token: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const newer = view.newerReviewNumber;

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {view.overview.brandName}
              </p>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {view.overview.campaignName}
              </h1>
            </div>
            <p className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              Proposal v{view.review.reviewNumber}
              {newer ? " · New version available" : ` · ${view.creators.length} creators`}
            </p>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {view.visibleSections.map((section) => {
              const href = buildClientReviewPath(view.review.id, token, section);
              const active = pathname?.includes(`/${section}`);
              return (
                <Link
                  key={section}
                  href={href}
                  className={
                    active
                      ? "rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-zinc-200"
                      : "rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900"
                  }
                >
                  {CLIENT_WORKSPACE_SECTION_LABEL[section]}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
