import Link from "next/link";

export function CreatorApproveVendorIoForm({ vendorIoId }: { vendorIoId: string }) {
  return <Link href={`/io-approval/vendor?io=${encodeURIComponent(vendorIoId)}`}
    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
    Review &amp; Sign
  </Link>;
}
