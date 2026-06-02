"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { BarChart3Icon } from "lucide-react";

type AnalyticsResilienceBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type State = { error: Error | null };

export class AnalyticsResilienceBoundary extends Component<
  AnalyticsResilienceBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[dashboard-resilience] boundary caught render error", {
        message: error.message,
        componentStack: info.componentStack,
      });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center"
          role="alert"
        >
          <BarChart3Icon className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            {this.props.title ?? "Analytics temporarily unavailable"}
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Core operations are still available. Analytics will resume when schema
            enrichment is restored.
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-medium underline"
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
