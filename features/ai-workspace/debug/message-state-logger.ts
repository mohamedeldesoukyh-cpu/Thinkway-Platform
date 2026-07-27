import type { Dispatch, SetStateAction } from "react";

import type { AiMessage } from "../types";

const LOG_PREFIX = "[message-state]";
const ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEBUG_MESSAGE_STATE === "1";

export function logMessageStateEvent(
  event: string,
  detail?: Record<string, unknown>
): void {
  if (!ENABLED) return;
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.log(`${LOG_PREFIX} ${event}${payload}`);
}

export function createLoggedSetMessages(
  setMessages: Dispatch<SetStateAction<AiMessage[]>>
): (action: SetStateAction<AiMessage[]>, caller: string) => void {
  return (action, caller) => {
    if (!ENABLED) {
      setMessages(action);
      return;
    }

    const stack = new Error().stack ?? "(no stack)";

    setMessages((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      const before = prev.length;
      const after = next.length;

      console.log(
        [
          `${LOG_PREFIX} setMessages`,
          `before: ${before}`,
          `after: ${after}`,
          `caller: ${caller}`,
          `roles: [${next.map((m) => m.role).join(", ")}]`,
          `ids: [${next.map((m) => m.id.slice(0, 12)).join(", ")}]`,
          `stack:\n${stack}`,
        ].join("\n")
      );

      if (before >= 2 && after === 1) {
        console.warn(
          `${LOG_PREFIX} *** REGRESSION: messages dropped from ${before} to ${after} *** caller=${caller}`
        );
      }

      return next;
    });
  };
}
