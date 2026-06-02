import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PortalNotificationList } from "@/features/portals/components/portal-notification-list";
import { getCreatorNotifications } from "@/features/portals/queries";

export default async function CreatorPortalNotificationsPage() {
  const notifications = await getCreatorNotifications();

  return (
    <PlatformErrorBoundary surface="generic">
      <PortalNotificationList notifications={notifications} audienceType="creator" />
    </PlatformErrorBoundary>
  );
}
