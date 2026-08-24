import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

export default function ClientWorkspaceSectionLoading() {
  return (
    <div
      className="tw-review tw-review-loading-overlay"
      role="status"
      aria-live="polite"
      aria-label="Loading campaign review"
    >
      <ThinkwayPageLoader label="Loading campaign review" />
    </div>
  );
}
