import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PortalNotificationList } from "@/features/portals/components/portal-notification-list";
import { getClientNotifications } from "@/features/portals/queries";

export default async function ClientPortalNotificationsPage() {
  const notifications = await getClientNotifications();

  return (
    <PlatformErrorBoundary surface="generic">
      <PortalNotificationList notifications={notifications} audienceType="client" />
    </PlatformErrorBoundary>
  );
}
