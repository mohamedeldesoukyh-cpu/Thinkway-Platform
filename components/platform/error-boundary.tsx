"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { AsyncErrorState } from "@/components/platform/async-error-state";
import { errorLog } from "@/lib/platform/logger";

export type PlatformSurface =
  | "dashboard"
  | "billing"
  | "campaigns"
  | "ios"
  | "planning"
  | "invoices"
  | "finance"
  | "analytics"
  | "executive"
  | "collections"
  | "treasury"
  | "generic";

const SURFACE_COPY: Record<
  PlatformSurface,
  { title: string; description: string }
> = {
  dashboard: {
    title: "Dashboard temporarily unavailable",
    description:
      "Home and navigation still work. Retry or continue via Billing and Campaigns.",
  },
  billing: {
    title: "Billing view encountered an error",
    description:
      "Invoicing, queue actions, and operational billing run on isolated queries. Refresh to retry this panel.",
  },
  campaigns: {
    title: "Campaign workspace encountered an error",
    description:
      "Campaign data may still save. Retry or open another tab (Overview, Lines, Billing).",
  },
  ios: {
    title: "IO workspace encountered an error",
    description:
      "Campaign execution is unaffected. Retry this IO panel or continue in campaign workspace.",
  },
  planning: {
    title: "Planning view temporarily unavailable",
    description: "Budget and forecast modules are optional — ERP operations are unaffected.",
  },
  invoices: {
    title: "Invoice view encountered an error",
    description:
      "Invoice creation and collections use dedicated queries. Refresh to reload this invoice.",
  },
  finance: {
    title: "Finance module encountered an error",
    description:
      "Credit notes, debit notes, and posting use isolated queries. Refresh to retry this panel.",
  },
  analytics: {
    title: "Analytics temporarily unavailable",
    description:
      "KPI and chart enrichment is optional. Billing, campaigns, and invoices continue normally.",
  },
  executive: {
    title: "Executive dashboard temporarily unavailable",
    description:
      "Finance monitoring charts are optional enrichment. Use Billing for operational control.",
  },
  collections: {
    title: "Collections view temporarily unavailable",
    description:
      "Billing, invoicing, and campaigns are unaffected. Retry or record payments from Billing.",
  },
  treasury: {
    title: "Treasury view temporarily unavailable",
    description:
      "Cashflow panels are optional enrichment. Collections and billing continue normally.",
  },
  generic: {
    title: "Something went wrong",
    description: "Operational ERP workflows are isolated from this panel failure.",
  },
};

type PlatformErrorBoundaryProps = {
  children: ReactNode;
  surface?: PlatformSurface;
  title?: string;
  description?: string;
};

type State = {
  error: Error | null;
};

export class PlatformErrorBoundary extends Component<
  PlatformErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const surface = this.props.surface ?? "generic";
    errorLog("platform-health", `boundary:${surface}`, {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const surface = this.props.surface ?? "generic";
      const copy = SURFACE_COPY[surface];
      const isDev = process.env.NODE_ENV === "development";

      return (
        <AsyncErrorState
          title={this.props.title ?? copy.title}
          message={this.props.description ?? copy.description}
          scope={isDev ? this.state.error.message : undefined}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/** @deprecated Use PlatformErrorBoundary — analytics-specific alias. */
export function AnalyticsResilienceBoundary({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <PlatformErrorBoundary surface="analytics" title={title}>
      {children}
    </PlatformErrorBoundary>
  );
}
