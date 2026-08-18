import "@/features/client-workspace/styles/client-review-ref.css";

export default function ClientWorkspaceRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="tw-review-root">{children}</div>;
}
