"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { CreatorPlatformMark } from "@/features/creator-workspace/components/creator-platform-mark";
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
  const connectedCount = providers.filter((provider) => provider.connection).length;

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
    <section className="card">
      <p className="ck">Social accounts</p>
      <h2 className="sec">Connected platforms</h2>
      <p className="note">
        {CREATOR_SOCIAL_OPTIONAL_INTRO} Available soon platforms cannot be connected yet.
      </p>
      {notice ? <p className="note">{notice}</p> : null}
      <p className="note" style={{ marginTop: 8 }}>
        {connectedCount
          ? `${connectedCount} account${connectedCount === 1 ? "" : "s"} connected`
          : "No accounts connected"}
      </p>
      <div className="soc">
        {providers.map((provider) => {
          const connected = provider.connection;
          const on = Boolean(connected);
          const label = connected
            ? "Connected"
            : provider.configured
              ? "Connect"
              : "Soon";
          return (
            <button
              key={provider.providerId}
              type="button"
              className="soc__i"
              data-on={on}
              disabled={pending}
              onClick={() => {
                if (connected) {
                  startTransition(async () => {
                    const result = await syncCreatorSocialConnectionAction({
                      connectionId: connected.id,
                    });
                    if (!result.ok) toast.error(result.message);
                    else toast.success("Sync started");
                  });
                  return;
                }
                if (provider.configured) setConsentProvider(provider.providerId);
              }}
            >
              <CreatorPlatformMark platform={provider.providerId} size={26} />
              <span className="soc__n">
                {provider.displayName}
                {connected?.handle ? (
                  <>
                    <br />
                    <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--cw-green-text)" }}>
                      {connected.handle}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="soc__s">{label}</span>
            </button>
          );
        })}
      </div>
      {providers.some((provider) => provider.connection) ? (
        <p className="note" style={{ marginTop: 12 }}>
          Connected accounts sync on tap. Disconnect from the confirmation if you need to remove access.
        </p>
      ) : null}

      <Dialog
        open={Boolean(consentProvider)}
        onOpenChange={(open) => !open && setConsentProvider(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {providers.find((item) => item.providerId === consentProvider)?.displayName}
            </DialogTitle>
            <DialogDescription>{CREATOR_SOCIAL_CONSENT}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {consentProvider &&
            providers.find((item) => item.providerId === consentProvider)?.connection ? null : null}
            <button type="button" className="btn" onClick={() => setConsentProvider(null)}>
              Not now
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !consentProvider}
              onClick={() => consentProvider && connect(consentProvider)}
            >
              Continue
            </button>
            {consentProvider &&
            providers.find((p) => p.providerId === consentProvider)?.connection ? (
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => {
                  const connection = providers.find((p) => p.providerId === consentProvider)?.connection;
                  if (!connection) return;
                  startTransition(async () => {
                    const result = await disconnectCreatorSocialConnectionAction({
                      connectionId: connection.id,
                    });
                    if (!result.ok) toast.error(result.message);
                    else toast.success("Disconnected");
                    setConsentProvider(null);
                  });
                }}
              >
                Disconnect
              </button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
