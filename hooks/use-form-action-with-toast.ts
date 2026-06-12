"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback } from "react";
import { toast } from "sonner";

export type FormActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

type UseFormActionWithToastOptions = {
  successDuration?: number;
  refreshOnSuccess?: boolean;
};

/** Wraps a server form action with Sonner toasts that fire as soon as the action returns. */
export function useFormActionWithToast(
  action: (
    prev: FormActionResult,
    formData: FormData
  ) => Promise<FormActionResult>,
  initialState: FormActionResult,
  options: UseFormActionWithToastOptions = {}
) {
  const router = useRouter();
  const { successDuration = 4000, refreshOnSuccess = true } = options;

  const wrappedAction = useCallback(
    async (prev: FormActionResult, formData: FormData): Promise<FormActionResult> => {
      const result = await action(prev, formData);

      if (result.message) {
        if (result.ok) {
          toast.success(result.message, { duration: successDuration });
          if (refreshOnSuccess) {
            router.refresh();
          }
        } else {
          toast.error(result.message, { duration: 5000 });
        }
      }

      return result;
    },
    [action, router, successDuration, refreshOnSuccess]
  );

  return useActionState(wrappedAction, initialState);
}
