"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  disconnectCreatorSocialConnectionAction,
  startCreatorSocialConnectAction,
  syncCreatorSocialConnectionAction,
} from "@/features/creator-workspace/social-actions";
import {
  CREATOR_SOCIAL_CONSENT,
  CREATOR_SOCIAL_OPTIONAL_INTRO,
} from "@/lib/creator-social/copy";
import type { CreatorSocialProviderView } from "@/lib/creator-social/views";
import type { SocialProviderId } from "@/lib/creator-social/ids";

export function CreatorSocialAccountsCard({
  providers,
  notice,
}: {
  providers: CreatorSocialProviderView[];
  notice?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [consentProvider, setConsentProvider] = useState<SocialProviderId | null>(null);

  function connect(providerId: SocialProviderId) {
    startTransition(async () => {
      const result = await startCreatorSocialConnectAction({ provider: providerId });
      if (!result.ok) {
        toast.error(result.message);
        setConsentProvider(null);
        return;
      }
      window.location.assign(result.data.authorizeUrl);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Social Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{CREATOR_SOCIAL_OPTIONAL_INTRO}</p>
        {notice ? (
          <p className="rounded-xl border border-border px-3 py-2 text-sm">{notice}</p>
        ) : null}
        <ul className="space-y-2">
          {providers.map((provider) => {
            const connected = provider.connection;
            return (
              <li
                key={provider.providerId}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{provider.displayName}</p>
                  {connected ? (
                    <>
                      {connected.handle ? (
                        <p className="text-xs text-muted-foreground">{connected.handle}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{connected.statusLabel}</p>
                      {connected.syncLine ? (
                        <p className="text-xs text-muted-foreground">{connected.syncLine}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {connected ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await syncCreatorSocialConnectionAction({
                              connectionId: connected.id,
                            });
                            if (!result.ok) toast.error(result.message);
                            else toast.success("Sync started");
                          })
                        }
                      >
                        Sync now
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await disconnectCreatorSocialConnectionAction({
                              connectionId: connected.id,
                            });
                            if (!result.ok) toast.error(result.message);
                            else toast.success("Disconnected");
                          })
                        }
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : provider.configured ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-9"
                      disabled={pending}
                      onClick={() => setConsentProvider(provider.providerId)}
                    >
                      Connect
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      Available soon
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <Dialog
        open={Boolean(consentProvider)}
        onOpenChange={(open) => !open && setConsentProvider(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {providers.find((item) => item.providerId === consentProvider)?.displayName}</DialogTitle>
            <DialogDescription>{CREATOR_SOCIAL_CONSENT}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConsentProvider(null)}
            >
              Not now
            </Button>
            <Button
              type="button"
              disabled={pending || !consentProvider}
              onClick={() => consentProvider && connect(consentProvider)}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
