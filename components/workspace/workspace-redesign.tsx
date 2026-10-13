import type { ReactNode } from "react";
import "@/app/styles/workspace-redesign.css";
import "@/app/styles/workspace-controls.css";
import "@/app/styles/workspace-bodies.css";
import "@/app/styles/workspace-details.css";
import "@/app/styles/workspace-reference-layout.css";

/** Presentation boundary: existing pages retain their data, actions and state. */
export function WorkspaceRedesign({ children }: { children: ReactNode }) {
  return <div className="workspace-redesign">{children}</div>;
}

export function WorkspaceContextHeader({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="wr-context-header">
      <div className="wr-context-heading">
        <h1>{title}</h1>
        <div className="wr-context-actions">{actions}</div>
      </div>
      {description ? <p className="wr-context-description">{description}</p> : null}
      {children}
    </header>
  );
}
