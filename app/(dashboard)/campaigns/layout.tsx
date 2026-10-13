import "@/app/styles/campaign-workspace.css";
import "@/app/styles/campaigns-list-suite.css";
import { WorkspaceRedesign } from "@/components/workspace/workspace-redesign";

export default function CampaignsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <WorkspaceRedesign>{children}</WorkspaceRedesign>;
}
