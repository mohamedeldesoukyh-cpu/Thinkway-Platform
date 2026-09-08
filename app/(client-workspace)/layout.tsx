import "@/features/client-workspace/styles/client-review-ref.css";
import { ClientWorkspaceDocScroll } from "@/features/client-workspace/components/client-workspace-doc-scroll";

export default function ClientWorkspaceRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Do not put Tailwind overflow-hidden here — nested overflow on iOS locks Shortlist
  // scrolling. Scroll policy lives in client-review-ref.css (desktop nested /
  // mobile document-chain unlock).
  return (
    <div className="tw-review-root">
      <ClientWorkspaceDocScroll />
      {children}
    </div>
  );
}
