import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CREATOR_WORKSPACE_SOCIAL_PLATFORMS } from "@/features/creator-workspace/social-availability";

export function CreatorSocialAvailableSoon() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Get more from Thinkway</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Connecting social accounts is optional. You can use Creator Workspace without
          connecting anything. When a platform is ready, it will appear here as Available
          soon until it is active.
        </p>
        <div className="flex flex-wrap gap-2">
          {CREATOR_WORKSPACE_SOCIAL_PLATFORMS.map((platform) => (
            <span
              key={platform}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {platform} · Available soon
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
