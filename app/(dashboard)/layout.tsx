import { DashboardProviders } from "@/components/layout/dashboard-providers";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardProviders>{children}</DashboardProviders>;
}
