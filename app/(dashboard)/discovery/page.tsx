import { redirect } from "next/navigation";

/** Legacy crawler hub — permanently routed to Creator Search. */
export default function DiscoveryPage() {
  redirect("/discovery/search");
}
