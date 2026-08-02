"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type TabErrorBoundaryProps = {
  tabName: string;
  children: ReactNode;
  fallback?: ReactNode;
};

type TabErrorBoundaryState = {
  error: Error | null;
};

export class TabErrorBoundary extends Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  state: TabErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const digest =
      "digest" in error ? String((error as Error & { digest?: string }).digest) : undefined;
    console.error(`[${this.props.tabName}] tab render failed`, {
      message: error.message,
      digest,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    if (this.props.tabName === "Assignments") {
      console.error("[Assignments] tab error boundary caught failure", {
        digest,
        message: error.message,
      });
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const message = this.state.error.message || "";
      const looksLikeRefresh =
        /refresh|network|timeout|failed to fetch|load/i.test(message);
      const headline = looksLikeRefresh
        ? `Unable to refresh ${this.props.tabName} list`
        : `${this.props.tabName} hit a display error`;
      const guidance = looksLikeRefresh
        ? "Bulk updates may already be saved. Retry refresh — completed work is not rolled back."
        : message.includes("Server Components render")
          ? "A rendering error occurred after data refresh. Completed mutations are kept — reload the page."
          : message;

      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">{headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {process.env.NODE_ENV === "development" ? message : guidance}
          </p>
          {"digest" in this.state.error && this.state.error.digest ? (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              Ref: {String(this.state.error.digest)}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-3 text-xs font-medium underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
