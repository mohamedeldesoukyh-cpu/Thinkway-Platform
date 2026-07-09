import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RequestContext = {
  requestId: string;
  service?: string;
  workflow?: string;
  conversationId?: string;
  campaignId?: string;
  userId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const parent = storage.getStore();
  const requestId =
    context.requestId ?? parent?.requestId ?? randomUUID().slice(0, 12);
  return storage.run({ ...parent, ...context, requestId }, fn);
}

export function resolveRequestId(request: Request): string {
  const header =
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id");
  return header?.trim() || randomUUID().slice(0, 12);
}

export function mergeRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
