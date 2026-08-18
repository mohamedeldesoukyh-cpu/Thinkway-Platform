import "@/features/client-workspace/styles/client-review-ref.css";

export default function ClientWorkspaceRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="tw-review-root h-full min-h-0 flex-1 overflow-hidden">{children}</div>;
}
