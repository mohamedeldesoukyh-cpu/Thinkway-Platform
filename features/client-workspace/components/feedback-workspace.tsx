"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { addReviewCommentAction } from "../actions/client-workspace-actions";
import type { ClientCommentTargetType } from "../constants";
import type { ClientWorkspaceView } from "../types";
import { Panel, StatusPill } from "./media-plan-ui";

export function FeedbackWorkspace({
  view,
  token,
}: {
  view: ClientWorkspaceView;
  token: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<ClientCommentTargetType>("campaign");
  const [creatorId, setCreatorId] = useState(view.creators[0]?.creatorId ?? "");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const openCount = view.comments.filter((comment) => comment.status === "open").length;
  const resolvedCount = view.comments.filter((comment) => comment.status === "resolved").length;
  const threads = useMemo(() => {
    return view.comments.filter((comment) => filter === "all" || comment.status === filter);
  }, [filter, view.comments]);

  return (
    <div className="space-y-5">
      <Panel eyebrow="Feedback & change requests" title="Collaborate on this proposal">
        <div className="grid grid-cols-3 gap-3">
          <SummaryStat label="Open" value={openCount} />
          <SummaryStat label="Resolved" value={resolvedCount} />
          <SummaryStat label="Pending" value={openCount} />
        </div>
      </Panel>

      {view.canDecide ? (
        <Panel title="Create a request">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Category</span>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as ClientCommentTargetType)}
              >
                <option value="campaign">Campaign</option>
                <option value="creator">Creator</option>
                <option value="content">Content</option>
                <option value="commercial">Commercial</option>
              </select>
            </label>
            {targetType === "creator" ? (
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">Creator</span>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  value={creatorId}
                  onChange={(event) => setCreatorId(event.target.value)}
                >
                  {view.creators.map((creator) => (
                    <option key={creator.creatorId} value={creator.creatorId}>
                      {creator.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <textarea
            className="mt-3 min-h-28 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the change you would like Thinkway to make."
          />
          <Button
            className="mt-3 bg-[#1D9E75] hover:bg-[#178A65]"
            disabled={pending || !message.trim()}
            onClick={() =>
              startTransition(async () => {
                await addReviewCommentAction({
                  token,
                  targetType,
                  targetId: targetType === "creator" ? creatorId : undefined,
                  message,
                });
                setMessage("");
                router.refresh();
              })
            }
          >
            Send request
          </Button>
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "resolved"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={
              filter === item
                ? "rounded-full bg-zinc-900 px-3 py-1 text-sm text-white"
                : "rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600"
            }
          >
            {item === "all" ? "All" : item === "open" ? "Open" : "Resolved"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {threads.map((comment) => (
          <article
            key={comment.id}
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {comment.authorKind === "client" ? "Client" : "Thinkway"}
                <span className="ml-2 font-normal text-zinc-500">
                  {comment.targetType}
                  {comment.targetId
                    ? ` · ${view.creators.find((creator) => creator.creatorId === comment.targetId)?.displayName ?? ""}`
                    : ""}
                </span>
              </p>
              <StatusPill tone={comment.status === "open" ? "warning" : "positive"}>
                {comment.status === "open" ? "Open" : "Resolved"}
              </StatusPill>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-800">{comment.message}</p>
            {comment.authorKind === "client" ? (
              <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                Thinkway: Request received
              </p>
            ) : null}
            <p className="mt-2 text-xs text-zinc-400">{new Date(comment.createdAt).toLocaleString()}</p>
          </article>
        ))}
        {threads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            No feedback yet. Requests will appear here as a conversation with Thinkway.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
