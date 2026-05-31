import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VendorProfile } from "@/features/vendors/components/vendor-profile";
import { getVendorById } from "@/features/vendors/queries";

type VendorProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendorProfilePage({
  params,
}: VendorProfilePageProps) {
  const { id } = await params;

  let vendor;
  let errorMessage: string | null = null;

  try {
    vendor = await getVendorById(id);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendor.";
  }

  if (!vendor && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Vendor profile"
      description="Creator details, platforms, and campaign assignment history."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : vendor ? (
        <VendorProfile vendor={vendor} />
      ) : null}
    </DashboardShell>
  );
}
