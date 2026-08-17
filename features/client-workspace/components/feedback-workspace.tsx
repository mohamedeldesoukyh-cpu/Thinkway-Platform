"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addReviewCommentAction } from "../actions/client-workspace-actions";
import type { ClientCommentTargetType } from "../constants";
import type { ClientWorkspaceView } from "../types";

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
    <>
      <div className="fstats">
        <div className="fstat open">
          <p className="l">Open</p>
          <p className="v">{openCount}</p>
        </div>
        <div className="fstat">
          <p className="l">Resolved</p>
          <p className="v">{resolvedCount}</p>
        </div>
        <div className="fstat">
          <p className="l">Pending</p>
          <p className="v">{openCount}</p>
        </div>
      </div>

      {view.canDecide ? (
        <div className="card">
          <p className="ck">Feedback & change requests</p>
          <h2>Create a request</h2>
          <div className="duo" style={{ marginBottom: 14 }}>
            <label className="fl">
              Category
              <select
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
              <label className="fl">
                Creator
                <select value={creatorId} onChange={(event) => setCreatorId(event.target.value)}>
                  {view.creators.map((creator) => (
                    <option key={creator.creatorId} value={creator.creatorId}>
                      {creator.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="fl">Request</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the change you would like Thinkway to make."
          />
          <div className="dt-acts" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn primary"
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
            </button>
          </div>
        </div>
      ) : null}

      <div className="filters">
        {(["all", "open", "resolved"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? "fbtn active" : "fbtn"}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "All" : item === "open" ? "Open" : "Resolved"}
          </button>
        ))}
      </div>

      {threads.map((comment) => (
        <div className="card" key={comment.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p className="ck" style={{ margin: 0 }}>
              {comment.authorKind === "client" ? "Client" : "Thinkway"}
              {comment.targetType === "creator" && comment.targetId
                ? ` · ${view.creators.find((creator) => creator.creatorId === comment.targetId)?.displayName ?? ""}`
                : ` · ${comment.targetType}`}
            </p>
            <span className={comment.status === "open" ? "sc" : "sc ok"}>
              {comment.status === "open" ? "Open" : "Resolved"}
            </span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, margin: "12px 0 0" }}>{comment.message}</p>
          {comment.authorKind === "client" ? (
            <p className="note" style={{ margin: "12px 0 0" }}>
              Thinkway: Request received
            </p>
          ) : null}
          <p className="unavailable" style={{ marginTop: 10 }}>
            {new Date(comment.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
      {threads.length === 0 ? (
        <div className="card">
          <p className="unavailable">No feedback yet. Requests will appear here as a conversation with Thinkway.</p>
        </div>
      ) : null}
    </>
  );
}
