import Link from "next/link";

export type HomeWorkspaceNavTab = "overview" | "finance" | "campaigns" | "clients";

const WORKSPACE_NAV_TABS: Array<{
  id: HomeWorkspaceNavTab;
  href: string;
  label: string;
}> = [
  { id: "overview", href: "/", label: "Overview" },
  { id: "finance", href: "/dashboard", label: "Finance" },
  { id: "campaigns", href: "/campaigns", label: "Campaigns" },
  { id: "clients", href: "/clients", label: "Clients" },
];

export function HomeWorkspaceNavTabs({ active }: { active: HomeWorkspaceNavTab }) {
  return (
    <div className="platform-v6-hs-nav-center" role="tablist" aria-label="Workspace sections">
      {WORKSPACE_NAV_TABS.map((tab) =>
        tab.id === active ? (
          <span
            key={tab.id}
            className="platform-v6-hs-nav-tab active"
            role="tab"
            aria-selected="true"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.id}
            href={tab.href}
            className="platform-v6-hs-nav-tab"
            role="tab"
            aria-selected="false"
          >
            {tab.label}
          </Link>
        )
      )}
    </div>
  );
}
