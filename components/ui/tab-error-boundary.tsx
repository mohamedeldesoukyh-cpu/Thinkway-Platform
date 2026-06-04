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
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            {this.props.tabName} could not load completely
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {process.env.NODE_ENV === "development"
              ? this.state.error.message
              : this.state.error.message.includes("Server Components render")
                ? "A rendering error occurred. Refresh the page or redeploy the latest build. In development, the full error is logged to the console."
                : this.state.error.message}
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
