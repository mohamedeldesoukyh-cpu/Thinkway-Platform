import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

export default function ClientWorkspaceSectionLoading() {
  return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f6f8fc" }}>
    <ThinkwayPageLoader label="Opening your campaign" />
  </div>;
}
