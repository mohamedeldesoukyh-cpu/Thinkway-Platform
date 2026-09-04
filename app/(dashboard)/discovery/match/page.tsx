import { redirect } from "next/navigation";

/** Pack route `/discovery/match` → live nav path. */
export default function DiscoveryMatchAliasPage() {
  redirect("/discovery/campaign-match");
}
