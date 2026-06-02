"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markPortalNotificationReadAction } from "@/features/portals/actions";
import type { PortalNotificationRow } from "@/features/portals/types";

const INITIAL_STATE = { ok: false } as const;

export function PortalNotificationList({
  notifications,
  audienceType,
}: {
  notifications: PortalNotificationRow[];
  audienceType: "creator" | "client";
}) {
  const [state, action, pending] = useActionState(markPortalNotificationReadAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {notifications.map((notification) => (
        <Card key={notification.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{notification.title}</p>
              <p className="text-sm text-muted-foreground">{notification.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
            <form action={action} className="shrink-0">
              <input type="hidden" name="notification_id" value={notification.id} />
              <input type="hidden" name="audience_type" value={audienceType} />
              <Button size="sm" variant="outline" disabled={pending || notification.is_read}>
                {notification.is_read ? "Read" : "Mark read"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
