"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

import {
  addReviewCommentAction,
  decideReviewAction,
  requestReviewChangesAction,
} from "../actions/client-workspace-actions";
import { CLIENT_CHANGE_AREAS, type ClientChangeArea, type ClientWorkspaceSectionId } from "../constants";
import type { ClientWorkspaceView } from "../types";
import { CreatorsWorkspace } from "./creators-workspace";

export function ClientWorkspaceSectionView({
  section,
  view,
  token,
}: {
  section: ClientWorkspaceSectionId;
  view: ClientWorkspaceView;
  token: string;
}) {
  if (section === "creators") return <CreatorsWorkspace view={view} token={token} />;
  if (section === "overview") return <OverviewSection view={view} />;
  if (section === "strategy") return <StrategySection view={view} />;
  if (section === "content") return <ContentSection view={view} />;
  if (section === "commercial") return <CommercialSection view={view} />;
  if (section === "quotation") return <QuotationSection view={view} />;
  if (section === "timeline") return <TimelineSection view={view} />;
  if (section === "feedback") return <FeedbackSection view={view} token={token} />;
  return <ApprovalSection view={view} token={token} />;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OverviewSection({ view }: { view: ClientWorkspaceView }) {
  const o = view.overview;
  return (
    <div className="space-y-4">
      <Card title="What is being proposed">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><dt className="text-zinc-500">Campaign</dt><dd className="font-medium">{o.campaignName}</dd></div>
          <div><dt className="text-zinc-500">Objective</dt><dd>{o.objective ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Audience</dt><dd>{o.audience ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Market</dt><dd>{o.market ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Duration</dt><dd>{o.durationLabel ?? "—"}</dd></div>
          <div><dt className="text-zinc-500">Platforms</dt><dd>{o.platforms.join(", ") || "—"}</dd></div>
          <div><dt className="text-zinc-500">Deliverables</dt><dd>{o.deliverables.join(", ") || "—"}</dd></div>
          <div><dt className="text-zinc-500">Creators</dt><dd>{o.creatorCount}</dd></div>
          <div>
            <dt className="text-zinc-500">Investment</dt>
            <dd>{formatMoneyKpi(o.commercial.totalInvestment, o.commercial.currency)}</dd>
          </div>
        </dl>
      </Card>
      <Card title="Why this approach">
        <p className="text-sm leading-relaxed text-zinc-700">{o.whyThisApproach}</p>
      </Card>
    </div>
  );
}

function StrategySection({ view }: { view: ClientWorkspaceView }) {
  return (
    <Card title="Strategy">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
        {view.strategyBody?.trim() || view.overview.whyThisApproach}
      </p>
    </Card>
  );
}

function QuotationSection({ view }: { view: ClientWorkspaceView }) {
  const quotation = view.quotation;
  if (!quotation) {
    return <Card title="Quotation"><p className="text-sm text-zinc-500">Quotation details are not part of this review.</p></Card>;
  }
  return (
    <Card title={quotation.serialNumber ? `${quotation.serialNumber} · ${quotation.name}` : quotation.name}>
      {quotation.version ? (
        <p className="mb-3 text-sm text-zinc-500">Version {quotation.version}</p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {quotation.lines.map((line) => (
          <li key={`${line.creatorId}-${line.label}`} className="flex justify-between gap-4">
            <span>{line.label}</span>
            <span>{formatMoneyKpi(line.amount, view.commercial.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex justify-between border-t border-zinc-100 pt-3 text-sm font-semibold">
        <span>Total</span>
        <span>{formatMoneyKpi(view.commercial.totalInvestment, view.commercial.currency)}</span>
      </p>
    </Card>
  );
}

function ContentSection({ view }: { view: ClientWorkspaceView }) {
  if (view.content.length === 0) {
    return <Card title="Content"><p className="text-sm text-zinc-500">Content plan will appear from the approved Studio package.</p></Card>;
  }
  return (
    <div className="space-y-3">
      {view.content.map((row, index) => (
        <Card key={`${row.creatorId ?? row.creatorName}-${index}`} title={row.creatorName}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-zinc-500">Platform</dt><dd>{row.platform}</dd></div>
            <div><dt className="text-zinc-500">Deliverable</dt><dd>{row.deliverable}</dd></div>
            <div className="sm:col-span-2"><dt className="text-zinc-500">Concept</dt><dd>{row.contentConcept ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">Key message</dt><dd>{row.keyMessage ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">Hook</dt><dd>{row.hook ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">CTA</dt><dd>{row.cta ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">Timing</dt><dd>{row.timing ?? "—"}</dd></div>
          </dl>
        </Card>
      ))}
    </div>
  );
}

function CommercialSection({ view }: { view: ClientWorkspaceView }) {
  return (
    <Card title="Campaign investment">
      <ul className="space-y-2 text-sm">
        {view.commercial.lines.map((line) => (
          <li key={line.label} className="flex justify-between gap-4">
            <span>{line.label}</span>
            <span>{line.amount != null ? formatMoneyKpi(line.amount, view.commercial.currency) : "—"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex justify-between border-t border-zinc-100 pt-3 text-sm font-semibold">
        <span>Total campaign investment</span>
        <span>{formatMoneyKpi(view.commercial.totalInvestment, view.commercial.currency)}</span>
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Based on {view.commercial.selectedCount} of {view.commercial.totalCount} creators.
      </p>
    </Card>
  );
}

function TimelineSection({ view }: { view: ClientWorkspaceView }) {
  return (
    <Card title="Campaign timeline">
      <p className="text-sm text-zinc-600">Campaign duration: {view.timeline.durationLabel}</p>
      <ol className="mt-4 space-y-3">
        {view.timeline.phases.map((phase) => (
          <li key={phase.week} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm">
            <p className="font-medium">Week {phase.week} — {phase.label}</p>
            {phase.activities.length > 0 ? (
              <p className="text-zinc-500">{phase.activities.join(" · ")}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function FeedbackSection({ view, token }: { view: ClientWorkspaceView; token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"campaign" | "creator" | "content" | "commercial">("campaign");

  return (
    <div className="space-y-4">
      {view.canDecide ? (
        <Card title="Add feedback">
          <select
            className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={targetType}
            onChange={(event) => setTargetType(event.target.value as typeof targetType)}
          >
            <option value="campaign">Campaign</option>
            <option value="creator">Creator</option>
            <option value="content">Content</option>
            <option value="commercial">Commercial</option>
          </select>
          <textarea
            className="min-h-28 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Request a change or leave a comment"
          />
          <Button
            className="mt-3"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await addReviewCommentAction({ token, targetType, message });
                setMessage("");
                router.refresh();
              })
            }
          >
            Add comment
          </Button>
        </Card>
      ) : null}
      <Card title="Activity">
        <ul className="space-y-3 text-sm">
          {view.comments.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="font-medium">{comment.authorLabel} · {comment.status}</p>
              <p className="text-zinc-600">{comment.message}</p>
              <p className="text-xs text-zinc-400">{new Date(comment.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {view.activity.map((event) => (
            <li key={event.id} className="text-zinc-600">
              {event.summary}
              <span className="ml-2 text-xs text-zinc-400">{new Date(event.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ApprovalSection({ view, token }: { view: ClientWorkspaceView; token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState("");
  const [areas, setAreas] = useState<ClientChangeArea[]>(["creator"]);

  function toggle(area: ClientChangeArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Approval">
        <p className="text-sm text-zinc-600">
          Approving locks Proposal v{view.review.reviewNumber}. A later package version requires a separate approval.
        </p>
        {view.canDecide ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="bg-[#1D9E75] hover:bg-[#178A65]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await decideReviewAction({ token, decision: "approved" });
                  router.refresh();
                })
              }
            >
              Approve
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await decideReviewAction({ token, decision: "rejected" });
                  router.refresh();
                })
              }
            >
              Reject
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium">{view.review.status.replaceAll("_", " ")}</p>
        )}
      </Card>
      {view.canDecide ? (
        <Card title="Request changes">
          <div className="mb-3 flex flex-wrap gap-2">
            {CLIENT_CHANGE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggle(area)}
                className={
                  areas.includes(area)
                    ? "rounded-full bg-zinc-900 px-3 py-1 text-xs text-white"
                    : "rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600"
                }
              >
                {area}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What needs to change?"
          />
          <Button
            className="mt-3"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await requestReviewChangesAction({ token, summary, areas });
                router.refresh();
              })
            }
          >
            Request changes
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
