"use client";
import { EntranceGate } from "@/features/client-workspace/components/client-entrance-frame";
export default function ReviewError({ unstable_retry }: {
    error: Error & {
        digest?: string;
    };
    unstable_retry: () => void;
}) {
    return <EntranceGate title="We couldn’t open your workspace">
    <p>Please try again. If this continues, contact your Thinkway team.</p>
    <div className="tw-gate__a"><button className="tw-b tw-b--pri" onClick={unstable_retry}>Try again</button></div>
  </EntranceGate>;
}
