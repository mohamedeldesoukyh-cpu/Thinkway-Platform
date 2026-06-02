import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCreatorScope } from "@/features/portals/scope";

export default async function CreatorPortalProfilePage() {
  const { supabase, scope } = await requireCreatorScope("creator_portal.read");

  const [{ data: influencer }, { data: profile }] = await Promise.all([
    supabase
      .from("influencers")
      .select("display_name, email, phone, country_code, city")
      .eq("id", scope.influencerId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", scope.userId)
      .maybeSingle(),
  ]);

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <span className="font-medium">Name: </span>
            {(influencer as any)?.display_name ?? profile?.full_name ?? "—"}
          </p>
          <p>
            <span className="font-medium">Email: </span>
            {(influencer as any)?.email ?? profile?.email ?? "—"}
          </p>
          <p>
            <span className="font-medium">Phone: </span>
            {(influencer as any)?.phone ?? "—"}
          </p>
          <p>
            <span className="font-medium">Country: </span>
            {(influencer as any)?.country_code ?? "—"}
          </p>
          <p>
            <span className="font-medium">City: </span>
            {(influencer as any)?.city ?? "—"}
          </p>
        </CardContent>
      </Card>
    </PlatformErrorBoundary>
  );
}
