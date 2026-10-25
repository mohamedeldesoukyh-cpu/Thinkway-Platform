"use client";

import { useMemo, useState, type ReactNode } from "react";
import { omitReportPages, reportPages } from "./report-page-selection";

import { RemovedPagesContext } from "./report-page-selection-context";

import { DocumentPreviewShell } from "./document-preview-shell";

type Props = {
  allowPageRemoval?: boolean;
  contained?: boolean;
  html?: string;
  src?: string;
  sandbox?: string;
  title: string;
  creatorCount?: number;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  paginationReadyAttr?: string;
  paginationReadyValue?: string;
};

/** Client boundary for preview chrome around server-rendered HTML. */
export function DocumentPreviewClient(props: Props) {
  return <EditablePreview key={props.html ?? props.src} {...props} />;
}

function EditablePreview(props: Props) {
  const [removed, setRemoved] = useState<number[]>([]);
  const pageIds = useMemo(() => reportPages(props.html ?? "").map((_, i) => i + 1).filter(id => !removed.includes(id)), [props.html, removed]);
  const html = useMemo(() => omitReportPages(props.html ?? "", removed), [props.html, removed]);
  const enabled = props.allowPageRemoval && pageIds.length > 0;
  return <RemovedPagesContext.Provider value={removed}>
    <DocumentPreviewShell {...props} html={props.html === undefined ? undefined : html}
      pageActions={enabled ? {
        remove: index => setRemoved(previous => [...previous, pageIds[index]!]),
        undo: () => setRemoved(previous => previous.slice(0, -1)),
        restore: () => setRemoved([]),
        removedCount: removed.length,
      } : undefined} />
  </RemovedPagesContext.Provider>;
}
