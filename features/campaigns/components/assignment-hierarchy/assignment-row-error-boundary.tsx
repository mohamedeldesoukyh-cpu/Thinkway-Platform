"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { TableCell, TableRow } from "@/components/ui/table";

type AssignmentRowErrorBoundaryProps = {
  lineId: string;
  colSpan: number;
  children: ReactNode;
};

type AssignmentRowErrorBoundaryState = {
  error: Error | null;
};

export class AssignmentRowErrorBoundary extends Component<
  AssignmentRowErrorBoundaryProps,
  AssignmentRowErrorBoundaryState
> {
  state: AssignmentRowErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AssignmentRowErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[assignment-hierarchy] row render failed — skipped", {
      lineId: this.props.lineId,
      message: error.message,
      digest: "digest" in error ? String((error as Error & { digest?: string }).digest) : undefined,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <TableRow className="bg-destructive/5 text-[11px]">
          <TableCell colSpan={this.props.colSpan} className="px-3 py-2 text-destructive">
            Assignment {this.props.lineId.slice(0, 8)}… could not render (
            {this.state.error.message || "unknown error"}). Other rows still load.
          </TableCell>
        </TableRow>
      );
    }
    return this.props.children;
  }
}
