/** Exact stroked glyphs from docs/architecture/sidebar.html (stroke 1.7). */

export type SidebarIconKey =
  | "home"
  | "exec"
  | "camp"
  | "studio"
  | "ai"
  | "grp"
  | "client"
  | "brand"
  | "doc"
  | "quote"
  | "vendor"
  | "search"
  | "list"
  | "match"
  | "imp"
  | "bill"
  | "po"
  | "cn"
  | "dn"
  | "coll"
  | "trez"
  | "post"
  | "vat"
  | "fx"
  | "per"
  | "plan"
  | "move"
  | "reas"
  | "rep"
  | "link"
  | "ops"
  | "users"
  | "sec"
  | "role"
  | "perm"
  | "acc"
  | "mail"
  | "info"
  | "heart"
  | "gauge"
  | "pin"
  | "collapse"
  | "chevron";

const PATHS: Record<SidebarIconKey, string> = {
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  exec: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  camp: '<path d="M4 9v6h4l6 4V5L8 9z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
  studio:
    '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M9 9l4 2.5L9 14z"/>',
  ai: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/>',
  grp: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 20a5 5 0 0 1 10 0M12 20a5 5 0 0 1 10 0"/>',
  client:
    '<circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0M17 11h4M19 9v4"/>',
  brand:
    '<path d="M3 8.5 12 3l9 5.5v7L12 21l-9-5.5z"/><path d="M12 12v9M3 8.5 12 14l9-5.5"/>',
  doc: '<path d="M5 20V5a1 1 0 0 1 1-1h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M14 4v5h5M9 13h6M9 16h4"/>',
  quote: '<path d="M4 6h16M4 11h16M4 16h9"/><circle cx="18" cy="17" r="3"/>',
  vendor:
    '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  match: '<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>',
  imp: '<path d="M12 3v12M8 11l4 4 4-4M4 20h16"/>',
  bill: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  po: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M9 12h6M9 16h4"/>',
  cn: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 12h8M12 9v6"/>',
  dn: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 12h8"/>',
  coll: '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  trez: '<path d="M4 20V9l8-5 8 5v11"/><path d="M4 20h16M9 20v-6h6v6"/>',
  post: '<path d="M4 12h16M4 6h16M4 18h9"/><circle cx="18" cy="18" r="3"/>',
  vat: '<circle cx="8" cy="8" r="2.4"/><circle cx="16" cy="16" r="2.4"/><path d="M18 6 6 18"/>',
  fx: '<path d="M4 8h12l-3-3M20 16H8l3 3"/>',
  per: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15h6"/>',
  plan: '<path d="M4 19V5M4 19h16M8 15l3-4 3 3 5-7"/>',
  move: '<path d="M7 8h10l-3-3M17 16H7l3 3"/><rect x="2" y="3" width="4" height="18" rx="1"/><rect x="18" y="3" width="4" height="18" rx="1"/>',
  reas: '<path d="M4 7h9a4 4 0 0 1 0 8H8l3 3M20 17h-4"/>',
  rep: '<path d="M5 20V4h14v16z"/><path d="M9 16v-4M12 16V8M15 16v-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  ops: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M16.9 16.9l2.1 2.1M4.9 19.1l2.1-2.1M16.9 7.1l2.1-2.1"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3.2 3.2 0 0 1 0 6M17 20a5 5 0 0 0-1.5-3.5"/>',
  sec: '<path d="M12 3 5 6v6c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  role: '<circle cx="12" cy="8" r="3.4"/><path d="M6 20a6 6 0 0 1 12 0"/><path d="M12 2v1.5M12 12.5V14"/>',
  perm: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  acc: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  heart: '<path d="M3 12h4l2-5 3 10 2-6 2 3h5"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-4"/>',
  pin: '<path d="M9 4h6l-1 6 4 3v2H6v-2l4-3z"/><path d="M12 15v5"/>',
  collapse:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};

export function SidebarSuiteIcon({
  name,
  className,
}: {
  name: SidebarIconKey;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? PATHS.doc }}
    />
  );
}
