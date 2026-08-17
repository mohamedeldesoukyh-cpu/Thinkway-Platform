"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CLIENT_WORKSPACE_SECTION_LABEL } from "../constants";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceView } from "../types";
import { CampaignHeader } from "./campaign-header";

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

  return (
    <div className="min-h-screen bg-[#F4F5F3] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-5 sm:px-6">
          <CampaignHeader view={view} token={token} />
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
                      ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }
                >
                  {CLIENT_WORKSPACE_SECTION_LABEL[section]}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
