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
    console.error(`[${this.props.tabName}] tab render failed`, {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
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
            {this.state.error.message}
          </p>
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
