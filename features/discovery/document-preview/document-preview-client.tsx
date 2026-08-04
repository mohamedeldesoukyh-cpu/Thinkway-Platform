"use client";

import type { ReactNode } from "react";

import { DocumentPreviewShell } from "./document-preview-shell";

type Props = {
  html: string;
  title: string;
  creatorCount: number;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  paginationReadyAttr?: string;
  paginationReadyValue?: string;
};

/** Client boundary for preview chrome around server-rendered HTML. */
export function DocumentPreviewClient(props: Props) {
  return <DocumentPreviewShell {...props} />;
}
