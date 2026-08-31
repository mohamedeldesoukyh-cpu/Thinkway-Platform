import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CREATOR_SOCIAL_OPTIONAL_INTRO } from "@/lib/creator-social/copy";
import { listSocialProviders } from "@/lib/creator-social/providers/registry";

export function CreatorSocialAvailableSoon() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Social accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{CREATOR_SOCIAL_OPTIONAL_INTRO}</p>
        <p className="text-sm text-muted-foreground">
          Manage connections on{" "}
          <Link href="/creator-portal/profile" className="font-medium underline underline-offset-4">
            Profile
          </Link>
          . Platforms that are not ready yet stay Available soon.
        </p>
        <div className="flex flex-wrap gap-2">
          {listSocialProviders().map((provider) => (
            <span
              key={provider.id}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {provider.displayName}
              {provider.isConfigured() ? "" : " · Available soon"}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
